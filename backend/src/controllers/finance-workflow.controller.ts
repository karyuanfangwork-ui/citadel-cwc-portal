import { Request, Response } from 'express';
import { RequestStatus } from '@prisma/client';
import { notify } from '../services/notification.service';
import { registerUpload } from '../services/attachmentAccess.service';
import { auditLog } from '../utils/audit';
import { reassignToTeam } from '../services/reassign.service';
import { transitionRequest } from '../services/requestTransition.service';
import prisma from '../utils/prisma';
import { principalFromAuth } from '../security/resource-scope.service';
import { runPurchaseRequisitionApprovalShadow } from '../services/purchaseRequisitionApprovalShadow.service';

// Group Deputy CEO approval threshold — no longer used for routing (all amounts go to GROUP_DCEO)
// Config import removed; threshold not needed after DCEO→GROUP_DCEO merge.

async function logActivity(requestId: string, message: string, authorId?: string) {
    await prisma.requestActivity.create({
        data: {
            requestId,
            authorId: authorId || null,
            authorName: 'System',
            activityType: 'STATUS_CHANGE',
            message,
            isSystemGenerated: true,
        },
    });
}

/** Helper: extract common transition options from Express request. */
function transitionOpts(req: Request, overrides?: { comment?: string; skipNotifications?: boolean; source?: string; metadata?: Record<string, unknown>; requestPatch?: Record<string, unknown> }) {
    const user = (req as any).user;
    const userRoles: string[] = user?.roles || [];
    return {
        userId: user?.id || 'system',
        userName: user?.firstName || user?.email || 'System',
        userRole: userRoles[0] || undefined,
        metadata: { userRoles, ...overrides?.metadata },
        skipNotifications: overrides?.skipNotifications ?? true,
        skipAutoAssignment: true, // Controllers manage assignment explicitly
        skipSlaPause: true,       // Controllers manage SLA pause/resume explicitly
        comment: overrides?.comment,
        source: overrides?.source || 'finance-workflow',
        requestPatch: overrides?.requestPatch,
        actor: {
            userId: user?.id || 'system',
            roles: userRoles,
            executiveRole: user?.executiveRole ?? null,
        },
    };
}

async function findFinanceCfo(tenantId: string | null | undefined): Promise<string | undefined> {
    const cfo = await prisma.user.findFirst({
        where: {
            isActive: true,
            ...(tenantId ? { tenantId } : {}),
            OR: [
                { executiveRole: 'CFO' },
                { roles: { some: { role: { name: 'CFO' } } } },
            ],
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
    });
    return cfo?.id;
}

async function findConfiguredGroupDceo(
    tenantId: string | null | undefined,
    requestTypeId: string | null | undefined,
): Promise<string | undefined> {
    if (tenantId && requestTypeId) {
        const policy = await (prisma as any).approvalPolicy.findFirst({
            where: {
                tenantId,
                requestTypeId,
                name: 'Purchase Requisition Approval Runtime',
                isActive: true,
            },
            include: {
                versions: {
                    where: { status: 'PUBLISHED' },
                    orderBy: { versionNumber: 'desc' },
                    take: 1,
                },
            },
        });
        const definition = policy?.versions?.[0]?.definition as Array<{ stepOrder?: number; approverType?: string; approverId?: string | null }> | undefined;
        const configuredStep = definition?.find((step) => step.stepOrder === 2);
        if (configuredStep?.approverType === 'USER' && configuredStep.approverId) {
            const configuredUser = await prisma.user.findFirst({
                where: { id: configuredStep.approverId, tenantId, isActive: true },
                select: { id: true },
            });
            if (configuredUser) return configuredUser.id;
        }
    }

    const groupDceo = await prisma.user.findFirst({
        where: {
            isActive: true,
            ...(tenantId ? { tenantId } : {}),
            OR: [
                { executiveRole: 'GROUP_DCEO' },
                { roles: { some: { role: { name: 'GROUP_DCEO' } } } },
            ],
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
    });
    return groupDceo?.id;
}

// ─── Purchase Requisition / Budget Proposal Workflow ───────────────────────

/** POST /finance-workflow/requests/:id/acknowledge */
export const acknowledge = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { notes } = req.body;

        const request = await prisma.request.findUnique({ where: { id }, include: { serviceDesk: true } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        // Transition: SUBMITTED → FINANCE_ACKNOWLEDGED (guard checks FINANCE service desk)
        await transitionRequest(id, 'FINANCE_ACKNOWLEDGED', transitionOpts(req, {
            comment: notes || undefined,
            source: 'finance-workflow/acknowledge',
        }));

        await auditLog(req as any, 'FINANCE_ACKNOWLEDGED', 'request', id, {
            status: 'FINANCE_ACKNOWLEDGED',
            previousStatus: request.status,
            notes: notes || null,
        }, { status: request.status });

        res.json({ status: 'success', message: 'Request acknowledged by Finance' });
    } catch (error: any) {
        console.error('acknowledge error:', error);
        if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Failed to acknowledge request' });
    }
};

/** POST /finance-workflow/requests/:id/route-to-cfo */
export const routeToCfo = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { notes } = req.body;

        const request = await prisma.request.findUnique({ where: { id }, include: { serviceDesk: true } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        // Find CFO user for assignment
        const cfoPendingApproval = await prisma.requestApproval.findFirst({
            where: { requestId: id, approverType: 'CFO', status: 'PENDING' },
            select: { approverId: true },
        });
        const cfoUserId = cfoPendingApproval?.approverId ?? await findFinanceCfo(request.tenantId);
        if (!cfoUserId) {
            res.status(409).json({ status: 'error', message: 'No active CFO approver is configured for this tenant' });
            return;
        }

        // Transition: * → PENDING_CFO_APPROVAL_FIN (guard checks FINANCE desk + CFO role context)
        await transitionRequest(id, 'PENDING_CFO_APPROVAL_FIN', transitionOpts(req, {
            comment: notes || undefined,
            source: 'finance-workflow/route-cfo',
            ...(cfoUserId ? { requestPatch: { assignedToId: cfoUserId } } : {}),
        }));

        // Create CFO approval record
        if (!cfoPendingApproval) {
            await prisma.requestApproval.create({
                data: { requestId: id, approverType: 'CFO', approverId: cfoUserId || 'system', status: 'PENDING', comments: notes || null },
            });
        }

        if (request.tenantId && request.requestTypeId) {
            void runPurchaseRequisitionApprovalShadow({
                requestId: id,
                tenantId: request.tenantId,
                requestTypeId: request.requestTypeId,
                actorId: (req as any).user?.id || 'system',
            });
        }

        await auditLog(req as any, 'FINANCE_ROUTED_CFO', 'request', id, {
            status: 'PENDING_CFO_APPROVAL_FIN',
            previousStatus: request.status,
            notes: notes || null,
        }, { status: request.status });

        await notify({ userId: request.requesterId, eventType: 'FINANCE_ROUTED_CFO', variables: { requestId: id }, relatedRequestId: id });
        if (cfoUserId) {
            await notify({ userId: cfoUserId, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'CFO' }, relatedRequestId: id });
        }

        const { pauseSla } = await import('../services/sla-pause.service');
        await pauseSla(id);

        res.json({ status: 'success', message: 'Request routed to CFO for approval' });
    } catch (error: any) {
        console.error('routeToCfo error:', error);
        if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Failed to route to CFO' });
    }
};

/** POST /finance-workflow/requests/:id/set-finalized-amount-and-route-cfo */
export const setFinalizedAmountAndRouteCfo = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const finalizedAmount = req.body.finalizedAmount ? Number(req.body.finalizedAmount) : NaN;
        const notes = req.body.notes || undefined;
        const invoiceFiles = (req as any).files as Express.Multer.File[] | undefined;
        const currentUser = (req as any).user;

        if (isNaN(finalizedAmount) || finalizedAmount <= 0) {
            res.status(400).json({ status: 'error', message: 'finalizedAmount must be a positive number' });
            return;
        }

        const request = await prisma.request.findUnique({ where: { id }, include: { serviceDesk: true } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        const existingFields = (request.customFields as Record<string, unknown>) || {};

        // Find CFO user for assignment
        const cfoPendingApproval = await prisma.requestApproval.findFirst({
            where: { requestId: id, approverType: 'CFO', status: 'PENDING' },
            select: { approverId: true },
        });
        const cfoUserId = cfoPendingApproval?.approverId ?? await findFinanceCfo(request.tenantId);
        if (!cfoUserId) {
            res.status(409).json({ status: 'error', message: 'No active CFO approver is configured for this tenant' });
            return;
        }

        // Transition: * → PENDING_CFO_APPROVAL_FIN
        await transitionRequest(id, 'PENDING_CFO_APPROVAL_FIN', transitionOpts(req, {
            comment: `Finalized amount: MYR ${finalizedAmount}${notes ? '. ' + notes : ''}`,
            source: 'finance-workflow/set-finalized-route-cfo',
            requestPatch: { customFields: { ...existingFields, finalizedAmount }, ...(cfoUserId ? { assignedToId: cfoUserId } : {}) },
        }));

        // Create CFO approval record if not existing
        if (!cfoPendingApproval && cfoUserId) {
            await prisma.requestApproval.create({
                data: { requestId: id, approverType: 'CFO', approverId: cfoUserId, status: 'PENDING', comments: notes || null },
            });
        }

        if (request.tenantId && request.requestTypeId) {
            void runPurchaseRequisitionApprovalShadow({
                requestId: id,
                tenantId: request.tenantId,
                requestTypeId: request.requestTypeId,
                actorId: currentUser?.id || 'system',
            });
        }

        // Create activity and link invoice attachments
        const fileCount = invoiceFiles?.length || 0;
        const invoiceLabel = fileCount === 0 ? '' : ` (${fileCount} invoice${fileCount > 1 ? 's' : ''} attached)`;
        const activity = await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: currentUser?.id || null,
                authorName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'System',
                activityType: 'STATUS_CHANGE',
                message: `Finalized amount set to MYR ${finalizedAmount}. Routed to CFO for approval${notes ? ': ' + notes : ''}${invoiceLabel}`,
                isSystemGenerated: true,
            },
        });

        if (invoiceFiles && invoiceFiles.length > 0) {
            for (const f of invoiceFiles) {
                if (!currentUser?.id) throw new Error('Authenticated uploader is required');
                await registerUpload({
                    principal: principalFromAuth(currentUser),
                    requestId: id,
                    uploadedById: currentUser.id,
                    activityId: activity.id,
                    file: {
                        originalname: f.originalname,
                        mimetype: f.mimetype,
                        size: f.size,
                        buffer: f.buffer,
                        key: (f as any).key,
                    },
                });
            }
        }

        await auditLog(req as any, 'FINANCE_ROUTED_CFO', 'request', id, {
            status: 'PENDING_CFO_APPROVAL_FIN',
            previousStatus: request.status,
            finalizedAmount,
            notes: notes || null,
        }, { status: request.status });

        await notify({ userId: request.requesterId, eventType: 'FINANCE_ROUTED_CFO', variables: { requestId: id }, relatedRequestId: id });
        if (cfoUserId) {
            await notify({ userId: cfoUserId, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'CFO' }, relatedRequestId: id });
        }

        const { pauseSla } = await import('../services/sla-pause.service');
        await pauseSla(id);

        res.json({ status: 'success', message: `Finalized amount set to MYR ${finalizedAmount} and routed to CFO` });
    } catch (error: any) {
        console.error('setFinalizedAmountAndRouteCfo error:', error);
        if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Failed to route to CFO' });
    }
};

/** POST /finance-workflow/requests/:id/cfo-decision */
export const cfoDecision = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { decision, comments } = req.body;
        const userId = (req as any).user?.id;

        if (!['APPROVED', 'REJECTED'].includes(decision)) {
            res.status(400).json({ status: 'error', message: 'decision must be APPROVED or REJECTED' });
            return;
        }

        const request = await prisma.request.findUnique({ where: { id }, include: { serviceDesk: true, requestType: true } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (decision === 'REJECTED') {
            // CFO Rejection: PENDING_CFO_APPROVAL_FIN → CFO_REJECTED_FIN
            await transitionRequest(id, 'CFO_REJECTED_FIN', transitionOpts(req, {
                comment: comments || 'CFO rejected the request',
                source: 'finance-workflow/cfo-reject',
            }));

            // Reassign back to Finance agent
            await reassignToTeam(id, request.referenceNumber, 'FINANCE', 'Finance-Workflow');

            const rejectedApproval = await prisma.requestApproval.updateMany({
                where: { requestId: id, approverType: 'CFO', status: 'PENDING' },
                data: { status: 'REJECTED', comments: comments || null, approverId: userId },
            });
            if (rejectedApproval.count === 0) {
                await prisma.requestApproval.create({
                    data: { requestId: id, approverType: 'CFO', approverId: userId, status: 'REJECTED', comments: comments || null },
                });
            }

            await logActivity(id, `CFO rejected the request${comments ? ': ' + comments : ''}`, userId);
            await auditLog(req as any, 'APPROVAL_DECISION', 'request', id, {
                decision,
                approverType: 'CFO',
                newStatus: 'CFO_REJECTED_FIN',
                previousStatus: request.status,
                comments: comments || null,
            }, { status: request.status });
            await notify({ userId: request.requesterId, eventType: 'FINANCE_CFO_DECISION', variables: { requestId: id, decision }, relatedRequestId: id });

            const { resumeSla } = await import('../services/sla-pause.service');
            await resumeSla(id);

            res.json({ status: 'success', message: 'Request rejected by CFO' });
            return;
        }

        // ── CFO Approved ──
        // Determine routing: Budget Proposals → FINANCE_IN_PROGRESS, Purchase Requisitions → PENDING_GROUP_DCEO_APPROVAL
        const requestType = await prisma.requestType.findFirst({
            where: { id: request.requestTypeId! },
            select: { code: true },
        });
        const isBudgetProposal = requestType?.code === 'BUDGET_PROPOSAL';
        const newStatus = isBudgetProposal ? 'FINANCE_IN_PROGRESS' : 'PENDING_GROUP_DCEO_APPROVAL';

        // Step 1: PENDING_CFO_APPROVAL_FIN → CFO_APPROVED_FIN (guard checks CFO role)
        await transitionRequest(id, 'CFO_APPROVED_FIN', transitionOpts(req, {
            comment: comments || undefined,
            source: 'finance-workflow/cfo-approve',
        }));

        const approvedApproval = await prisma.requestApproval.updateMany({
            where: { requestId: id, approverType: 'CFO', status: 'PENDING' },
            data: { status: 'APPROVED', comments: comments || null, approverId: userId },
        });
        if (approvedApproval.count === 0) {
            await prisma.requestApproval.create({
                data: { requestId: id, approverType: 'CFO', approverId: userId, status: 'APPROVED', comments: comments || null },
            });
        }

        if (isBudgetProposal) {
            // Step 2a: CFO_APPROVED_FIN → FINANCE_IN_PROGRESS (budget adopted)
            await transitionRequest(id, 'FINANCE_IN_PROGRESS', transitionOpts(req, {
                source: 'finance-workflow/cfo-approve-budget',
            }));
            await reassignToTeam(id, request.referenceNumber, 'FINANCE', 'Finance-Workflow');
        } else {
            // Step 2b: CFO_APPROVED_FIN → PENDING_GROUP_DCEO_APPROVAL
            // Resolve Group DCEO for assignment
            let groupDceoId: string | undefined;
            const existingGroupDceoApproval = await prisma.requestApproval.findFirst({
                where: { requestId: id, approverType: 'GROUP_DCEO', status: 'PENDING' },
                select: { approverId: true },
            });
            if (existingGroupDceoApproval?.approverId) {
                groupDceoId = existingGroupDceoApproval.approverId;
            } else {
                groupDceoId = await findConfiguredGroupDceo(request.tenantId, request.requestTypeId);
            }

            await transitionRequest(id, 'PENDING_GROUP_DCEO_APPROVAL', transitionOpts(req, {
                source: 'finance-workflow/cfo-approve-purchase',
                ...(groupDceoId ? { requestPatch: { assignedToId: groupDceoId } } : {}),
            }));

            if (!existingGroupDceoApproval && groupDceoId) {
                await prisma.requestApproval.create({
                    data: { requestId: id, approverType: 'GROUP_DCEO', approverId: groupDceoId, status: 'PENDING', comments: null },
                });
            }

            if (request.tenantId && request.requestTypeId) {
                void runPurchaseRequisitionApprovalShadow({
                    requestId: id,
                    tenantId: request.tenantId,
                    requestTypeId: request.requestTypeId,
                    actorId: userId || 'system',
                });
            }

            // Notify Group DCEO
            if (groupDceoId) {
                await notify({ userId: groupDceoId, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'Group Deputy CEO' }, relatedRequestId: id });
            }
        }

        const { pauseSla, resumeSla } = await import('../services/sla-pause.service');
        await resumeSla(id);
        if (!isBudgetProposal) {
            await pauseSla(id); // Pause SLA during Group DCEO approval
        }

        const verb = `approved — routed to ${isBudgetProposal ? 'Finance Updating (budget adopted)' : 'Group Deputy CEO'}`;
        await logActivity(id, `CFO ${verb}${comments ? ': ' + comments : ''}`, userId);
        await auditLog(req as any, 'APPROVAL_DECISION', 'request', id, {
            decision,
            approverType: 'CFO',
            newStatus,
            previousStatus: request.status,
            comments: comments || null,
        }, { status: request.status });
        await notify({ userId: request.requesterId, eventType: 'FINANCE_CFO_DECISION', variables: { requestId: id, decision }, relatedRequestId: id });

        res.json({ status: 'success', message: `Request ${decision.toLowerCase()} by CFO — routed to ${isBudgetProposal ? 'Finance Updating' : 'Group Deputy CEO'}` });
    } catch (error: any) {
        console.error('cfoDecision error:', error);
        if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Failed to process CFO decision' });
    }
};

/** POST /finance-workflow/requests/:id/reassign-group-dceo-approver */
export const reassignGroupDceoApprover = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { approverId, notes } = req.body;
        const user = (req as any).user;
        const userRoles: string[] = user?.roles || [];

        if (!approverId || typeof approverId !== 'string') {
            res.status(400).json({ status: 'error', message: 'approverId is required' });
            return;
        }

        const request = await prisma.request.findUnique({
            where: { id },
            include: {
                serviceDesk: true,
                requestType: true,
                assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
                approvals: { where: { approverType: 'GROUP_DCEO', status: 'PENDING' } },
            },
        });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (request.serviceDesk?.code !== 'FINANCE' || request.requestType?.code !== 'PURCHASE_REQUISITION') {
            res.status(400).json({ status: 'error', message: 'Only Finance Purchase Requisition Group DCEO approvers can be reassigned here' });
            return;
        }

        if (request.status !== 'PENDING_GROUP_DCEO_APPROVAL') {
            res.status(400).json({ status: 'error', message: 'Group DCEO approver can only be changed while request is pending Group DCEO approval' });
            return;
        }

        const isAdmin = userRoles.includes('ADMIN');
        const isFinanceAgent = userRoles.includes('AGENT') && (user?.agentTeam || '').toUpperCase() === 'FINANCE';
        if (!isAdmin && !isFinanceAgent) {
            res.status(403).json({ status: 'error', message: 'Only Finance agents or admins can change the Group DCEO approver' });
            return;
        }

        const newApprover = await prisma.user.findUnique({
            where: { id: approverId },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                executiveRole: true,
                isActive: true,
                roles: { select: { role: { select: { name: true } } } },
            },
        });
        const roleNames = newApprover?.roles.map((r) => r.role.name) ?? [];
        const isGroupDceo = newApprover?.executiveRole === 'GROUP_DCEO' || roleNames.includes('GROUP_DCEO');
        if (!newApprover || !newApprover.isActive || !isGroupDceo) {
            res.status(400).json({ status: 'error', message: 'Selected approver is not an active Group DCEO' });
            return;
        }

        const pendingApproval = request.approvals[0];
        const oldApproverId = pendingApproval?.approverId || request.assignedToId || null;
        if (oldApproverId === newApprover.id) {
            res.status(400).json({ status: 'error', message: 'Selected Group DCEO is already assigned to this request' });
            return;
        }

        const oldApprover = oldApproverId
            ? await prisma.user.findUnique({
                where: { id: oldApproverId },
                select: { firstName: true, lastName: true, email: true },
            })
            : null;

        const updatedRequest = await prisma.$transaction(async (tx) => {
            if (pendingApproval) {
                await tx.requestApproval.update({
                    where: { id: pendingApproval.id },
                    data: { approverId: newApprover.id, comments: notes || pendingApproval.comments || null },
                });
            } else {
                await tx.requestApproval.create({
                    data: { requestId: id, approverType: 'GROUP_DCEO', approverId: newApprover.id, status: 'PENDING', comments: notes || null },
                });
            }

            await tx.requestActivity.create({
                data: {
                    requestId: id,
                    authorId: user?.id || null,
                    authorName: user ? `${user.firstName} ${user.lastName}`.trim() : 'System',
                    activityType: 'ASSIGNMENT',
                    message: `Group DCEO approver changed from ${oldApprover ? `${oldApprover.firstName} ${oldApprover.lastName}`.trim() : 'Unassigned'} to ${newApprover.firstName} ${newApprover.lastName}${notes ? `: ${notes}` : ''}`,
                    isSystemGenerated: false,
                    metadata: {
                        previousApproverId: oldApproverId,
                        newApproverId: newApprover.id,
                        changedByRole: isAdmin ? 'ADMIN' : 'FINANCE_AGENT',
                    },
                },
            });

            return tx.request.update({
                where: { id },
                data: { assignedToId: newApprover.id },
                include: {
                    assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
                    approvals: { include: { approver: { select: { id: true, firstName: true, lastName: true, email: true } } } },
                },
            });
        });

        await notify({
            userId: newApprover.id,
            eventType: 'APPROVAL_REQUIRED',
            variables: { requestId: id, role: 'Group Deputy CEO' },
            relatedRequestId: id,
        });

        await auditLog(req as any, 'FINANCE_GROUP_DCEO_APPROVER_REASSIGNED', 'request', id, {
            previousApproverId: oldApproverId,
            newApproverId: newApprover.id,
            referenceNumber: request.referenceNumber,
            notes: notes || null,
        }, { assignedToId: request.assignedToId });

        res.json({
            status: 'success',
            message: 'Group DCEO approver reassigned successfully',
            data: { request: updatedRequest },
        });
    } catch (error: any) {
        console.error('reassignGroupDceoApprover error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to reassign Group DCEO approver' });
    }
};

/** POST /finance-workflow/requests/:id/group-dceo-decision */
export const groupDceoDecision = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { decision, comments } = req.body;
        const userId = (req as any).user?.id;

        if (!['APPROVED', 'REJECTED'].includes(decision)) {
            res.status(400).json({ status: 'error', message: 'decision must be APPROVED or REJECTED' });
            return;
        }

        const request = await prisma.request.findUnique({
            where: { id },
            include: {
                approvals: {
                    where: { approverType: 'GROUP_DCEO', status: 'PENDING' },
                },
            },
        });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (request.status !== 'PENDING_GROUP_DCEO_APPROVAL') {
            res.status(400).json({ status: 'error', message: 'Request is not pending Group Deputy CEO approval' });
            return;
        }

        const pendingApproval = request.approvals[0];
        if (!pendingApproval) {
            res.status(404).json({ status: 'error', message: 'No pending Group Deputy CEO approval found for this request' });
            return;
        }

        if (decision === 'APPROVED') {
            // PENDING_GROUP_DCEO_APPROVAL → GROUP_DCEO_APPROVED (guard checks GROUP_DCEO role)
            await transitionRequest(id, 'GROUP_DCEO_APPROVED', transitionOpts(req, {
                comment: comments || undefined,
                source: 'finance-workflow/group-dceo-approve',
            }));

            // GROUP_DCEO_APPROVED → PAYMENT_PROCESSING_FIN
            await transitionRequest(id, 'PAYMENT_PROCESSING_FIN', transitionOpts(req, {
                source: 'finance-workflow/group-dceo-approve',
            }));
        } else {
            // PENDING_GROUP_DCEO_APPROVAL → GROUP_DCEO_REJECTED
            await transitionRequest(id, 'GROUP_DCEO_REJECTED', transitionOpts(req, {
                comment: comments || 'Group Deputy CEO rejected the request',
                source: 'finance-workflow/group-dceo-reject',
            }));
        }

        // Reassign back to Finance agent
        await reassignToTeam(id, request.referenceNumber, 'FINANCE', 'Finance-Workflow');

        // Update existing PENDING approval record
        await prisma.requestApproval.update({
            where: { id: pendingApproval.id },
            data: { status: decision, approverId: userId, comments: comments || null },
        });

        const verb = decision === 'APPROVED' ? 'approved — routed to payment processing' : 'rejected';
        await logActivity(id, `Group Deputy CEO ${verb}${comments ? ': ' + comments : ''}`, userId);
        await auditLog(req as any, 'APPROVAL_DECISION', 'request', id, {
            decision,
            approverType: 'GROUP_DCEO',
            newStatus: decision === 'APPROVED' ? 'PAYMENT_PROCESSING_FIN' : 'GROUP_DCEO_REJECTED',
            previousStatus: request.status,
            comments: comments || null,
        }, { status: request.status });
        await notify({ userId: request.requesterId, eventType: 'FINANCE_GROUP_DCEO_DECISION', variables: { requestId: id, decision }, relatedRequestId: id });

        const { resumeSla } = await import('../services/sla-pause.service');
        await resumeSla(id);

        res.json({ status: 'success', message: `Request ${decision.toLowerCase()} by Group Deputy CEO` });
    } catch (error: any) {
        console.error('groupDceoDecision error:', error);
        if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Failed to process Group Deputy CEO decision' });
    }
};

/** POST /finance-workflow/requests/:id/mark-payment-complete */
export const markPaymentComplete = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { paymentReference, notes } = req.body;

        const request = await prisma.request.findUnique({ where: { id }, include: { serviceDesk: true } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        // Transition: * → AWAITING_PAYMENT_CONFIRMATION (guard checks Finance desk + assignment)
        const existingFields = (request.customFields as Record<string, unknown>) || {};
        await transitionRequest(id, 'AWAITING_PAYMENT_CONFIRMATION', transitionOpts(req, {
            comment: `Payment marked complete${paymentReference ? ' (Ref: ' + paymentReference + ')' : ''}${notes ? ': ' + notes : ''}`,
            source: 'finance-workflow/payment-complete',
            requestPatch: { customFields: { ...existingFields, paymentReference: paymentReference || null } },
        }));

        await auditLog(req as any, 'FINANCE_PAYMENT_COMPLETE', 'request', id, {
            status: 'AWAITING_PAYMENT_CONFIRMATION',
            previousStatus: request.status,
            paymentReference: paymentReference || null,
        }, { status: request.status });

        await notify({ userId: request.requesterId, eventType: 'FINANCE_PAYMENT_COMPLETE', variables: { requestId: id }, relatedRequestId: id });

        res.json({ status: 'success', message: 'Payment marked complete' });
    } catch (error: any) {
        console.error('markPaymentComplete error:', error);
        if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Failed to mark payment complete' });
    }
};

/** POST /finance-workflow/requests/:id/close */
export const closeTicket = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);

        const request = await prisma.request.findUnique({ where: { id }, include: { serviceDesk: true } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        // Transition: * → TICKET_CLOSED_FIN (guard check Finance desk + assignment)
        await transitionRequest(id, 'TICKET_CLOSED_FIN', transitionOpts(req, {
            comment: 'Ticket closed by Finance Agent',
            source: 'finance-workflow/close',
            requestPatch: { completedAt: new Date() },
        }));

        await auditLog(req as any, 'FINANCE_TICKET_CLOSED', 'request', id, {
            status: 'TICKET_CLOSED_FIN',
            previousStatus: request.status,
            resolvedAt: new Date().toISOString(),
        }, { status: request.status });

        await notify({ userId: request.requesterId, eventType: 'FINANCE_TICKET_CLOSED', variables: { requestId: id }, relatedRequestId: id });

        res.json({ status: 'success', message: 'Ticket closed' });
    } catch (error: any) {
        console.error('closeTicket error:', error);
        if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Failed to close ticket' });
    }
};

/** POST /finance-workflow/requests/:id/update-and-close-budget */
export const updateAndCloseBudget = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { notes } = req.body;
        const userId = (req as any).user?.id;

        const request = await prisma.request.findUnique({ where: { id }, include: { serviceDesk: true } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (request.status !== 'FINANCE_IN_PROGRESS') {
            res.status(400).json({ status: 'error', message: 'Request must be in Finance Updating status to close' });
            return;
        }

        // Transition: FINANCE_IN_PROGRESS → TICKET_CLOSED_FIN (guard checks Finance desk + assignment)
        await transitionRequest(id, 'TICKET_CLOSED_FIN', transitionOpts(req, {
            comment: notes || 'Budget proposal closed by Finance Agent',
            source: 'finance-workflow/close-budget',
            requestPatch: { completedAt: new Date() },
        }));

        await logActivity(id, `Budget proposal closed by Finance Agent${notes ? ': ' + notes : ''}`, userId);
        await auditLog(req as any, 'BUDGET_PROPOSAL_CLOSED', 'request', id, {
            status: 'TICKET_CLOSED_FIN',
            previousStatus: request.status,
            notes: notes || null,
        }, { status: request.status });
        await notify({ userId: request.requesterId, eventType: 'FINANCE_TICKET_CLOSED', variables: { requestId: id }, relatedRequestId: id });

        res.json({ status: 'success', message: 'Budget proposal closed' });
    } catch (error: any) {
        console.error('updateAndCloseBudget error:', error);
        if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Failed to update and close budget proposal' });
    }
};

// ─── Expense Reimbursement Workflow Endpoints ──────────────────────────────

/** POST /finance-workflow/requests/:id/manager-approve-expense */
export const managerApproveExpense = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { comments } = req.body;
        const userId = (req as any).user?.id;

        const request = await prisma.request.findUnique({ where: { id }, include: { serviceDesk: true } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (request.status !== RequestStatus.PENDING_MANAGER_APPROVAL_FIN) {
            res.status(400).json({ status: 'error', message: 'Request is not pending manager approval' });
            return;
        }

        // Transition: PENDING_MANAGER_APPROVAL_FIN → MANAGER_APPROVED_FIN (guard checks Finance desk + MANAGER role)
        await transitionRequest(id, 'MANAGER_APPROVED_FIN', transitionOpts(req, {
            comment: comments || undefined,
            source: 'finance-workflow/manager-approve-expense',
        }));

        // P5-07: If a policy-based approval exists for this manager step, update it instead of creating a duplicate
        const existingManagerApproval = await prisma.requestApproval.findFirst({
            where: { requestId: id, policyId: { not: null }, stepOrder: 1, status: 'PENDING' },
        });

        if (existingManagerApproval) {
            await prisma.requestApproval.update({
                where: { id: existingManagerApproval.id },
                data: { approverId: userId, status: 'APPROVED', comments: comments || null },
            });
        } else {
            await prisma.requestApproval.create({
                data: { requestId: id, approverType: 'MANAGER', approverId: userId, status: 'APPROVED', comments: comments || null },
            });
        }

        await logActivity(id, `Manager approved expense claim — routed to Finance Head${comments ? ': ' + comments : ''}`, userId);
        await auditLog(req as any, 'EXPENSE_MANAGER_APPROVED', 'request', id, {
            status: 'MANAGER_APPROVED_FIN',
            previousStatus: request.status,
            comments: comments || null,
        }, { status: request.status });
        await notify({ userId: request.requesterId, eventType: 'EXPENSE_MANAGER_APPROVED', variables: { requestId: id }, relatedRequestId: id });

        // Notify Finance Head that expense is now pending their approval
        const financeHeadApproval = await prisma.requestApproval.findFirst({
            where: { requestId: id, approverType: 'CFO', status: 'PENDING' },
            select: { approverId: true },
        });
        const financeHeadId = financeHeadApproval?.approverId ?? (await prisma.user.findFirst({
            where: { isActive: true, roles: { some: { role: { name: 'CFO' } } } },
            select: { id: true },
        }))?.id;
        if (financeHeadId) {
            await notify({ userId: financeHeadId, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'Finance Head' }, relatedRequestId: id });
        }

        const { resumeSla } = await import('../services/sla-pause.service');
        await resumeSla(id);

        res.json({ status: 'success', message: 'Manager approved expense claim' });
    } catch (error: any) {
        console.error('managerApproveExpense error:', error);
        if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Failed to approve expense claim' });
    }
};

/** POST /finance-workflow/requests/:id/manager-reject-expense */
export const managerRejectExpense = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { comments } = req.body;
        const userId = (req as any).user?.id;

        const request = await prisma.request.findUnique({ where: { id }, include: { serviceDesk: true } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (request.status !== RequestStatus.PENDING_MANAGER_APPROVAL_FIN) {
            res.status(400).json({ status: 'error', message: 'Request is not pending manager approval' });
            return;
        }

        // Transition: PENDING_MANAGER_APPROVAL_FIN → MANAGER_REJECTED_FIN (guard checks Finance desk)
        await transitionRequest(id, 'MANAGER_REJECTED_FIN', transitionOpts(req, {
            comment: comments || 'Manager rejected the expense claim',
            source: 'finance-workflow/manager-reject-expense',
        }));

        await prisma.requestApproval.create({
            data: { requestId: id, approverType: 'MANAGER', approverId: userId, status: 'REJECTED', comments: comments || null },
        });

        await logActivity(id, `Manager rejected expense claim — returned to requester${comments ? ': ' + comments : ''}`, userId);
        await auditLog(req as any, 'EXPENSE_MANAGER_REJECTED', 'request', id, {
            status: 'MANAGER_REJECTED_FIN',
            previousStatus: request.status,
            comments: comments || null,
        }, { status: request.status });
        await notify({ userId: request.requesterId, eventType: 'EXPENSE_MANAGER_REJECTED', variables: { requestId: id }, relatedRequestId: id });

        const { resumeSla } = await import('../services/sla-pause.service');
        await resumeSla(id);

        res.json({ status: 'success', message: 'Manager rejected expense claim' });
    } catch (error: any) {
        console.error('managerRejectExpense error:', error);
        if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Failed to reject expense claim' });
    }
};

/** POST /finance-workflow/requests/:id/finance-head-approve-expense */
export const financeHeadApproveExpense = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { comments } = req.body;
        const userId = (req as any).user?.id;

        const request = await prisma.request.findUnique({ where: { id }, include: { serviceDesk: true } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (request.status !== RequestStatus.PENDING_FINANCE_HEAD_APPROVAL) {
            res.status(400).json({ status: 'error', message: 'Request is not pending Finance Head approval' });
            return;
        }

        // Transition: PENDING_FINANCE_HEAD_APPROVAL → FINANCE_HEAD_APPROVED (guard checks FINANCE_HEAD role)
        await transitionRequest(id, 'FINANCE_HEAD_APPROVED', transitionOpts(req, {
            comment: comments || undefined,
            source: 'finance-workflow/finance-head-approve',
        }));

        // P5-07: If a policy-based approval exists for this finance head step, update it instead of creating a duplicate
        const existingFinHeadApproval = await prisma.requestApproval.findFirst({
            where: { requestId: id, policyId: { not: null }, stepOrder: 2, status: 'PENDING' },
        });

        if (existingFinHeadApproval) {
            await prisma.requestApproval.update({
                where: { id: existingFinHeadApproval.id },
                data: { approverId: userId, status: 'APPROVED', comments: comments || null },
            });
        } else {
            await prisma.requestApproval.create({
                data: { requestId: id, approverType: 'FINANCE_HEAD', approverId: userId, status: 'APPROVED', comments: comments || null },
            });
        }

        await logActivity(id, `Finance Head approved expense claim — routed to payment processing${comments ? ': ' + comments : ''}`, userId);
        await auditLog(req as any, 'EXPENSE_FINANCE_HEAD_APPROVED', 'request', id, {
            status: 'FINANCE_HEAD_APPROVED',
            previousStatus: request.status,
            comments: comments || null,
        }, { status: request.status });
        await notify({ userId: request.requesterId, eventType: 'EXPENSE_FINANCE_HEAD_APPROVED', variables: { requestId: id }, relatedRequestId: id });

        const { resumeSla } = await import('../services/sla-pause.service');
        await resumeSla(id);

        res.json({ status: 'success', message: 'Finance Head approved expense claim' });
    } catch (error: any) {
        console.error('financeHeadApproveExpense error:', error);
        if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Failed to approve expense claim' });
    }
};

/** POST /finance-workflow/requests/:id/finance-head-reject-expense */
export const financeHeadRejectExpense = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { comments } = req.body;
        const userId = (req as any).user?.id;

        const request = await prisma.request.findUnique({ where: { id }, include: { serviceDesk: true } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (request.status !== RequestStatus.PENDING_FINANCE_HEAD_APPROVAL) {
            res.status(400).json({ status: 'error', message: 'Request is not pending Finance Head approval' });
            return;
        }

        // Transition: PENDING_FINANCE_HEAD_APPROVAL → FINANCE_HEAD_REJECTED (guard checks FINANCE_HEAD role)
        await transitionRequest(id, 'FINANCE_HEAD_REJECTED', transitionOpts(req, {
            comment: comments || 'Finance Head rejected the expense claim',
            source: 'finance-workflow/finance-head-reject',
        }));

        await prisma.requestApproval.create({
            data: { requestId: id, approverType: 'FINANCE_HEAD', approverId: userId, status: 'REJECTED', comments: comments || null },
        });

        await logActivity(id, `Finance Head rejected expense claim — returned to requester${comments ? ': ' + comments : ''}`, userId);
        await auditLog(req as any, 'EXPENSE_FINANCE_HEAD_REJECTED', 'request', id, {
            status: 'FINANCE_HEAD_REJECTED',
            previousStatus: request.status,
            comments: comments || null,
        }, { status: request.status });
        await notify({ userId: request.requesterId, eventType: 'EXPENSE_FINANCE_HEAD_REJECTED', variables: { requestId: id }, relatedRequestId: id });

        const { resumeSla } = await import('../services/sla-pause.service');
        await resumeSla(id);

        res.json({ status: 'success', message: 'Finance Head rejected expense claim' });
    } catch (error: any) {
        console.error('financeHeadRejectExpense error:', error);
        if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Failed to reject expense claim' });
    }
};

/** POST /finance-workflow/requests/:id/mark-expense-payment-complete */
export const markExpensePaymentComplete = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { paymentReference, notes } = req.body;

        const request = await prisma.request.findUnique({ where: { id }, include: { serviceDesk: true } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (request.status !== RequestStatus.PAYMENT_PROCESSING) {
            res.status(400).json({ status: 'error', message: 'Request is not in payment processing' });
            return;
        }

        // Step 1: PAYMENT_PROCESSING → PAYMENT_COMPLETED
        const existingFields = (request.customFields as Record<string, unknown>) || {};
        await transitionRequest(id, 'PAYMENT_COMPLETED', transitionOpts(req, {
            comment: `Expense payment completed${paymentReference ? ' (Ref: ' + paymentReference + ')' : ''}${notes ? ': ' + notes : ''}`,
            source: 'finance-workflow/expense-payment-complete',
            requestPatch: { customFields: { ...existingFields, paymentReference: paymentReference || null } },
        }));

        // Step 2: PAYMENT_COMPLETED → REIMBURSEMENT_CLOSED (auto-close)
        await transitionRequest(id, 'REIMBURSEMENT_CLOSED', transitionOpts(req, {
            comment: 'Expense reimbursement closed automatically after payment completion',
            source: 'finance-workflow/expense-payment-complete',
            requestPatch: { completedAt: new Date() },
        }));

        await auditLog(req as any, 'EXPENSE_PAYMENT_COMPLETE', 'request', id, {
            status: 'REIMBURSEMENT_CLOSED',
            previousStatus: request.status,
            paymentReference: paymentReference || null,
        }, { status: request.status });

        await notify({ userId: request.requesterId, eventType: 'EXPENSE_PAYMENT_COMPLETE', variables: { requestId: id }, relatedRequestId: id });

        res.json({ status: 'success', message: 'Expense payment completed and reimbursement closed' });
    } catch (error: any) {
        console.error('markExpensePaymentComplete error:', error);
        if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Failed to mark expense payment complete' });
    }
};