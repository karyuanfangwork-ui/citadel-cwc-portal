import { Request, Response } from 'express';
import { notify } from '../services/notification.service';
import { auditLog } from '../utils/audit';
import { transitionRequest } from '../services/requestTransition.service';
import prisma from '../utils/prisma';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Extract common transition options from an Express request. */
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
        source: overrides?.source || 'esm-workflow',
        requestPatch: overrides?.requestPatch,
        actor: {
            userId: user?.id || 'system',
            roles: userRoles,
            executiveRole: user?.executiveRole ?? null,
        },
    };
}

/**
 * Find the CEO user for the requester's entity (or the first active CEO).
 * Priority: CEO of the requester's entity → any active CEO.
 */
async function findCeoForRequest(requesterId: string): Promise<string | undefined> {
    const requester = await prisma.user.findUnique({
        where: { id: requesterId },
        select: { entityId: true },
    });
    if (requester?.entityId) {
        const entityCeo = await prisma.user.findFirst({
            where: { isActive: true, executiveRole: 'CEO', entityId: requester.entityId },
            select: { id: true },
        });
        if (entityCeo) return entityCeo.id;
    }
    const anyCeo = await prisma.user.findFirst({
        where: { isActive: true, executiveRole: 'CEO' },
        select: { id: true },
    });
    return anyCeo?.id;
}

/**
 * Find the GROUP_DCEO user.
 */
async function findGroupDceo(): Promise<string | undefined> {
    const dceo = await prisma.user.findFirst({
        where: { isActive: true, executiveRole: 'GROUP_DCEO' },
        select: { id: true },
    });
    return dceo?.id;
}

/**
 * Find a CFO user for the finance approval step.
 * Priority: CFO of the requester's entity → any active CFO.
 */
async function findCfo(): Promise<string | undefined> {
    const cfo = await prisma.user.findFirst({
        where: { isActive: true, executiveRole: 'CFO' },
        select: { id: true },
    });
    if (cfo) return cfo.id;

    // Fallback: any user with CFO role
    const cfoRole = await prisma.role.findUnique({ where: { name: 'CFO' } });
    if (cfoRole) {
        const cfoUser = await prisma.user.findFirst({
            where: { isActive: true, roles: { some: { roleId: cfoRole.id } } },
            select: { id: true },
        });
        if (cfoUser) return cfoUser.id;
    }

    // Final fallback: finance desk agent
    const financeDesk = await prisma.serviceDesk.findFirst({
        where: { code: 'FINANCE', isActive: true },
    });
    if (financeDesk) {
        const financeAgent = await prisma.user.findFirst({
            where: { isActive: true, agentTeam: 'FINANCE' },
            select: { id: true },
        });
        if (financeAgent) return financeAgent.id;
    }

    return undefined;
}

/**
 * Find a Finance desk agent for acknowledgement.
 * Prefers agents with the AGENT role on the FINANCE team.
 * Falls back to any active FINANCE agent, then any admin.
 */
async function findFinanceAgent(): Promise<string | undefined> {
    // Prefer active finance agents with AGENT role
    const financeAgentWithRole = await prisma.user.findFirst({
        where: { isActive: true, agentTeam: 'FINANCE', roles: { some: { role: { name: 'AGENT' } } } },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
    });
    if (financeAgentWithRole) return financeAgentWithRole.id;

    // Fallback: any active finance team member
    const financeAgent = await prisma.user.findFirst({
        where: { isActive: true, agentTeam: 'FINANCE' },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
    });
    if (financeAgent) return financeAgent.id;

    // Final fallback: any admin
    const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
    if (adminRole) {
        const admin = await prisma.user.findFirst({
            where: { isActive: true, roles: { some: { roleId: adminRole.id } } },
            select: { id: true },
        });
        if (admin) return admin.id;
    }

    return undefined;
}

async function validateTravelExecutiveApprover(approverId: string) {
    const approver = await prisma.user.findUnique({
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

    const roleNames = approver?.roles.map((r) => r.role.name) ?? [];
    const canApproveTravel = approver?.executiveRole === 'CEO'
        || approver?.executiveRole === 'GROUP_DCEO'
        || roleNames.includes('CEO')
        || roleNames.includes('GROUP_DCEO');

    if (!approver || !approver.isActive || !canApproveTravel) {
        return null;
    }

    return approver;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/**
 * POST /esm-workflow/requests/:id/submit-for-ceo
 *
 * Employee submits a CWC Travel Request for CEO approval.
 * SUBMITTED → PENDING_CEO_APPROVAL
 */
export const submitForCeoApproval = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { notes } = req.body;

        const request = await prisma.request.findUnique({
            where: { id },
            include: { requestType: true },
        });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (request.status !== 'SUBMITTED') {
            res.status(400).json({ status: 'error', message: 'Request must be in SUBMITTED status to submit for CEO approval' });
            return;
        }

        // Use the CEO selected by the requester (required field), fall back to auto-detection
        const customFields = (request.customFields as Record<string, unknown>) || {};
        let ceoId = String(customFields.ceoApproverId || '');

        if (!ceoId) {
            console.warn(`[ESM-Workflow] No CEO approver selected for request ${id}, falling back to auto-detection`);
            ceoId = (await findCeoForRequest(request.requesterId)) || '';
        }

        // Validate that the selected user is actually a CEO
        if (ceoId) {
            const ceoUser = await prisma.user.findUnique({
                where: { id: ceoId },
                select: {
                    id: true,
                    executiveRole: true,
                    isActive: true,
                    roles: { select: { role: { select: { name: true } } } },
                },
            });
            const selectedRoleNames = ceoUser?.roles.map((r) => r.role.name) ?? [];
            const canApproveTravel = ceoUser?.executiveRole === 'CEO'
                || ceoUser?.executiveRole === 'GROUP_DCEO'
                || selectedRoleNames.includes('CEO')
                || selectedRoleNames.includes('GROUP_DCEO');

            if (!ceoUser || !ceoUser.isActive || !canApproveTravel) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Selected CEO approver is not an active CEO or Group DCEO. Please select a valid approver.',
                });
            }
        }

        // Transition: SUBMITTED → PENDING_CEO_APPROVAL
        await transitionRequest(id, 'PENDING_CEO_APPROVAL', transitionOpts(req, {
            comment: notes || 'Submitted for CEO approval',
            source: 'esm-workflow/submit-for-ceo',
            ...(ceoId ? { requestPatch: { assignedToId: ceoId, assignedTeam: 'ESM' } } : {}),
        }));

        if (ceoId) {

            // Create CEO approval record
            await prisma.requestApproval.create({
                data: { requestId: id, approverType: 'CEO', approverId: ceoId, status: 'PENDING', comments: notes || null },
            });

            // Notify CEO
            await notify({ userId: ceoId, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'CEO' }, relatedRequestId: id });
        } else {
            console.warn(`[ESM-Workflow] No active CEO found for request ${id}`);
        }

        // Notify requester
        await notify({ userId: request.requesterId, eventType: 'STATUS_CHANGED', variables: { referenceNumber: request.referenceNumber, newStatus: 'PENDING_CEO_APPROVAL' }, relatedRequestId: id });

        // Pause SLA during approval
        const { pauseSla } = await import('../services/sla-pause.service');
        await pauseSla(id);

        await auditLog(req as any, 'ESM_SUBMITTED_CEO', 'request', id, {
            status: 'PENDING_CEO_APPROVAL',
            previousStatus: request.status,
            notes: notes || null,
        }, { status: request.status });

        res.json({ status: 'success', message: 'Travel request submitted for CEO approval' });
    } catch (error: any) {
        console.error('submitForCeoApproval error:', error);
        if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Failed to submit for CEO approval' });
    }
};

/**
 * POST /esm-workflow/requests/:id/reassign-ceo-approver
 * Requester/Admin changes the selected CEO/GROUP_DCEO while pending CEO approval.
 */
export const reassignCeoApprover = async (req: Request, res: Response) => {
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
                requestType: true,
                assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
                approvals: { where: { approverType: 'CEO', status: 'PENDING' } },
            },
        });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (request.requestType?.code !== 'CWC_TRAVEL_REQUEST') {
            res.status(400).json({ status: 'error', message: 'Only CWC Travel Request approvers can be reassigned here' });
            return;
        }

        if (request.status !== 'PENDING_CEO_APPROVAL') {
            res.status(400).json({ status: 'error', message: 'CEO approver can only be changed while request is pending CEO approval' });
            return;
        }

        const isRequester = request.requesterId === user?.id;
        const isAdmin = userRoles.includes('ADMIN');
        if (!isRequester && !isAdmin) {
            res.status(403).json({ status: 'error', message: 'Only the requester or an admin can change the CEO approver' });
            return;
        }

        const newApprover = await validateTravelExecutiveApprover(approverId);
        if (!newApprover) {
            res.status(400).json({ status: 'error', message: 'Selected approver is not an active CEO or Group DCEO' });
            return;
        }

        const pendingApproval = request.approvals[0];
        const oldApproverId = pendingApproval?.approverId || request.assignedToId || null;
        if (oldApproverId === newApprover.id) {
            res.status(400).json({ status: 'error', message: 'Selected approver is already assigned to this travel request' });
            return;
        }

        const oldApprover = oldApproverId
            ? await prisma.user.findUnique({
                where: { id: oldApproverId },
                select: { firstName: true, lastName: true, email: true },
            })
            : null;

        const existingCustomFields = (request.customFields as Record<string, unknown>) || {};
        const updatedRequest = await prisma.$transaction(async (tx) => {
            if (pendingApproval) {
                await tx.requestApproval.update({
                    where: { id: pendingApproval.id },
                    data: {
                        approverId: newApprover.id,
                        comments: notes || pendingApproval.comments || null,
                    },
                });
            } else {
                await tx.requestApproval.create({
                    data: {
                        requestId: id,
                        approverType: 'CEO',
                        approverId: newApprover.id,
                        status: 'PENDING',
                        comments: notes || null,
                    },
                });
            }

            await tx.requestActivity.create({
                data: {
                    requestId: id,
                    authorId: user?.id || null,
                    authorName: user?.firstName || user?.email || 'System',
                    activityType: 'ASSIGNMENT',
                    message: `CEO approver changed from ${oldApprover ? `${oldApprover.firstName} ${oldApprover.lastName}`.trim() : 'Unassigned'} to ${newApprover.firstName} ${newApprover.lastName}${notes ? `: ${notes}` : ''}`,
                    isSystemGenerated: false,
                    metadata: {
                        previousApproverId: oldApproverId,
                        newApproverId: newApprover.id,
                        changedByRole: isAdmin ? 'ADMIN' : 'REQUESTER',
                    },
                },
            });

            return tx.request.update({
                where: { id },
                data: {
                    assignedToId: newApprover.id,
                    assignedTeam: 'ESM',
                    customFields: {
                        ...existingCustomFields,
                        ceoApproverId: newApprover.id,
                    },
                },
                include: {
                    assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
                    approvals: { include: { approver: { select: { id: true, firstName: true, lastName: true, email: true } } } },
                },
            });
        });

        await notify({
            userId: newApprover.id,
            eventType: 'APPROVAL_REQUIRED',
            variables: { requestId: id, role: newApprover.executiveRole === 'GROUP_DCEO' ? 'Group Deputy CEO' : 'CEO' },
            relatedRequestId: id,
        });

        await auditLog(req as any, 'ESM_CEO_APPROVER_REASSIGNED', 'request', id, {
            previousApproverId: oldApproverId,
            newApproverId: newApprover.id,
            referenceNumber: request.referenceNumber,
            notes: notes || null,
        }, { assignedToId: request.assignedToId });

        res.json({
            status: 'success',
            message: 'CEO approver reassigned successfully',
            data: { request: updatedRequest },
        });
    } catch (error: any) {
        console.error('reassignCeoApprover error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to reassign CEO approver' });
    }
};

/**
 * POST /esm-workflow/requests/:id/ceo-decision
 *
 * CEO approves or rejects a travel request.
 * On approval: always routes to GROUP_DCEO_APPROVAL (threshold bypass removed).
 * On rejection: CEO_REJECTED → REJECTED (terminal).
 */
export const ceoDecision = async (req: Request, res: Response) => {
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
            include: { requestType: true, approvals: { where: { approverType: 'CEO', status: 'PENDING' } } },
        });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (request.status !== 'PENDING_CEO_APPROVAL') {
            res.status(400).json({ status: 'error', message: 'Request is not pending CEO approval' });
            return;
        }

        const pendingCeoApproval = request.approvals[0];
        const isSelectedCeo = pendingCeoApproval?.approverId === userId || request.assignedToId === userId;
        if (!isSelectedCeo) {
            res.status(403).json({
                status: 'error',
                message: 'Only the selected CEO approver can review this travel request.',
            });
            return;
        }

        if (decision === 'REJECTED') {
            // PENDING_CEO_APPROVAL → CEO_REJECTED → REJECTED (terminal)
            await transitionRequest(id, 'CEO_REJECTED', transitionOpts(req, {
                comment: comments || 'CEO rejected the travel request',
                source: 'esm-workflow/ceo-reject',
            }));
            await transitionRequest(id, 'REJECTED', transitionOpts(req, {
                comment: comments || 'Travel request rejected',
                source: 'esm-workflow/ceo-reject-terminal',
                requestPatch: { assignedToId: request.requesterId, assignedTeam: null },
            }));

            // Update approval record
            if (pendingCeoApproval) {
                await prisma.requestApproval.update({
                    where: { id: pendingCeoApproval.id },
                    data: { status: 'REJECTED', approverId: userId, comments: comments || null },
                });
            }

            // Reassign back to requester for visibility
            await logActivity(id, `CEO rejected the travel request${comments ? ': ' + comments : ''}`, userId);
            await notify({ userId: request.requesterId, eventType: 'STATUS_CHANGED', variables: { referenceNumber: request.referenceNumber, newStatus: 'REJECTED' }, relatedRequestId: id });

            const { resumeSla } = await import('../services/sla-pause.service');
            await resumeSla(id);

            await auditLog(req as any, 'ESM_CEO_DECISION', 'request', id, {
                decision,
                approverType: 'CEO',
                newStatus: 'REJECTED',
                previousStatus: request.status,
                comments: comments || null,
            }, { status: request.status });

            res.json({ status: 'success', message: 'Travel request rejected by CEO' });
            return;
        }

        // ── CEO APPROVED ──
        // If the selected CEO approver is the GROUP_DCEO (i.e. same person holds both roles),
        // skip GROUP_DCEO approval and route directly to Finance acknowledgement.
        const ceoApprover = await prisma.user.findUnique({
            where: { id: userId },
            select: { executiveRole: true, roles: { select: { role: { select: { name: true } } } } },
        });
        const ceoApproverRoles = ceoApprover?.roles.map(r => r.role.name) ?? [];
        const isGroupDceoApprover = ceoApprover?.executiveRole === 'GROUP_DCEO' || ceoApproverRoles.includes('GROUP_DCEO');

        // Update/create CEO approval record
        if (pendingCeoApproval) {
            await prisma.requestApproval.update({
                where: { id: pendingCeoApproval.id },
                data: { status: 'APPROVED', approverId: userId, comments: comments || null },
            });
        } else {
            await prisma.requestApproval.create({
                data: { requestId: id, approverType: 'CEO', approverId: userId, status: 'APPROVED', comments: comments || null },
            });
        }

        if (isGroupDceoApprover) {
            // ── GROUP_DCEO acted as CEO approver → skip GROUP_DCEO stage ──
            // Record automatic GROUP_DCEO approval since the same person already approved
            await prisma.requestApproval.create({
                data: { requestId: id, approverType: 'GROUP_DCEO', approverId: userId, status: 'APPROVED', comments: 'Auto-approved: same approver holds GROUP_DCEO role' },
            });

            // CEO_APPROVED → GROUP_DCEO_APPROVED → FINANCE_ACKNOWLEDGED
            const financeAgentId = await findFinanceAgent();
            await transitionRequest(id, 'CEO_APPROVED', transitionOpts(req, {
                comment: comments || 'CEO/Group Deputy CEO approved — routing directly to Finance',
                source: 'esm-workflow/ceo-approve',
            }));
            await transitionRequest(id, 'GROUP_DCEO_APPROVED', transitionOpts(req, {
                comment: 'Auto-approved: CEO approver holds GROUP_DCEO role',
                source: 'esm-workflow/auto-dceo-approve',
            }));
            await transitionRequest(id, 'FINANCE_ACKNOWLEDGED', transitionOpts(req, {
                source: 'esm-workflow/ceo-approve',
                ...(financeAgentId ? { requestPatch: { assignedToId: financeAgentId, assignedTeam: 'FINANCE' } } : {}),
            }));

            if (financeAgentId) {
                await notify({ userId: financeAgentId, eventType: 'STATUS_CHANGED', variables: { referenceNumber: request.referenceNumber, newStatus: 'FINANCE_ACKNOWLEDGED' }, relatedRequestId: id });
            } else {
                console.warn(`[ESM-Workflow] No Finance agent found for request ${id}`);
            }

            await logActivity(id, `CEO/Group Deputy CEO approved — skipping Group Deputy CEO stage, routing directly to Finance${comments ? ': ' + comments : ''}`, userId);
            await notify({ userId: request.requesterId, eventType: 'STATUS_CHANGED', variables: { referenceNumber: request.referenceNumber, newStatus: 'FINANCE_ACKNOWLEDGED' }, relatedRequestId: id });

            const { resumeSla } = await import('../services/sla-pause.service');
            await resumeSla(id);

            await auditLog(req as any, 'ESM_CEO_DECISION', 'request', id, {
                decision,
                approverType: 'CEO',
                newStatus: 'FINANCE_ACKNOWLEDGED',
                previousStatus: request.status,
                comments: comments || null,
                skipGroupDceo: true,
            }, { status: request.status });

            res.json({ status: 'success', message: 'CEO/Group Deputy CEO approved — routing directly to Finance for acknowledgement' });
        } else {
            // ── Standard flow: CEO approved → route to GROUP_DCEO ──
            // CEO_APPROVED → PENDING_GROUP_DCEO_APPROVAL
            await transitionRequest(id, 'CEO_APPROVED', transitionOpts(req, {
                comment: comments || 'CEO approved — routing to Group Deputy CEO for approval',
                source: 'esm-workflow/ceo-approve',
            }));
            // Find GROUP_DCEO before transitioning
            const groupDceoId = await findGroupDceo();
            await transitionRequest(id, 'PENDING_GROUP_DCEO_APPROVAL', transitionOpts(req, {
                source: 'esm-workflow/ceo-approve',
                ...(groupDceoId ? { requestPatch: { assignedToId: groupDceoId, assignedTeam: 'ESM' } } : {}),
            }));

            // Find and create GROUP_DCEO approval record
            if (groupDceoId) {
                await prisma.requestApproval.create({
                    data: { requestId: id, approverType: 'GROUP_DCEO', approverId: groupDceoId, status: 'PENDING', comments: null },
                });

                await notify({ userId: groupDceoId, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'Group Deputy CEO' }, relatedRequestId: id });
            } else {
                console.warn(`[ESM-Workflow] No active Group DCEO found for request ${id}`);
            }

            await logActivity(id, `CEO approved — routing to Group Deputy CEO for approval${comments ? ': ' + comments : ''}`, userId);
            await notify({ userId: request.requesterId, eventType: 'STATUS_CHANGED', variables: { referenceNumber: request.referenceNumber, newStatus: 'PENDING_GROUP_DCEO_APPROVAL' }, relatedRequestId: id });

            await auditLog(req as any, 'ESM_CEO_DECISION', 'request', id, {
                decision,
                approverType: 'CEO',
                newStatus: 'PENDING_GROUP_DCEO_APPROVAL',
                previousStatus: request.status,
                comments: comments || null,
            }, { status: request.status });

            res.json({ status: 'success', message: 'CEO approved — routing to Group Deputy CEO for approval' });
        }
    } catch (error: any) {
        console.error('ceoDecision error:', error);
        if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Failed to process CEO decision' });
    }
};

/**
 * POST /esm-workflow/requests/:id/group-dceo-decision
 *
 * GROUP_DCEO approves or rejects.
 * Approved → FINANCE_ACKNOWLEDGED (assign to Finance agent).
 * Rejected → GROUP_DCEO_REJECTED → REJECTED (terminal).
 */
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
            include: { approvals: { where: { approverType: 'GROUP_DCEO', status: 'PENDING' } } },
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

        if (decision === 'REJECTED') {
            // PENDING_GROUP_DCEO_APPROVAL → GROUP_DCEO_REJECTED → REJECTED
            await transitionRequest(id, 'GROUP_DCEO_REJECTED', transitionOpts(req, {
                comment: comments || 'Group Deputy CEO rejected the travel request',
                source: 'esm-workflow/group-dceo-reject',
            }));
            await transitionRequest(id, 'REJECTED', transitionOpts(req, {
                source: 'esm-workflow/group-dceo-reject-terminal',
                requestPatch: { assignedToId: request.requesterId, assignedTeam: null },
            }));

            if (pendingApproval) {
                await prisma.requestApproval.update({
                    where: { id: pendingApproval.id },
                    data: { status: 'REJECTED', approverId: userId, comments: comments || null },
                });
            }

            // Reassign back to requester (handled via requestPatch above)
            await logActivity(id, `Group Deputy CEO rejected the travel request${comments ? ': ' + comments : ''}`, userId);
            await notify({ userId: request.requesterId, eventType: 'STATUS_CHANGED', variables: { referenceNumber: request.referenceNumber, newStatus: 'REJECTED' }, relatedRequestId: id });

            const { resumeSla } = await import('../services/sla-pause.service');
            await resumeSla(id);

            await auditLog(req as any, 'ESM_GROUP_DCEO_DECISION', 'request', id, {
                decision,
                approverType: 'GROUP_DCEO',
                newStatus: 'REJECTED',
                previousStatus: request.status,
                comments: comments || null,
            }, { status: request.status });

            res.json({ status: 'success', message: 'Travel request rejected by Group Deputy CEO' });
            return;
        }

        // ── GROUP_DCEO APPROVED ──
        // PENDING_GROUP_DCEO_APPROVAL → GROUP_DCEO_APPROVED → FINANCE_ACKNOWLEDGED
        const financeAgentId = await findFinanceAgent();
        await transitionRequest(id, 'GROUP_DCEO_APPROVED', transitionOpts(req, {
            comment: comments || undefined,
            source: 'esm-workflow/group-dceo-approve',
        }));
        await transitionRequest(id, 'FINANCE_ACKNOWLEDGED', transitionOpts(req, {
            source: 'esm-workflow/group-dceo-approve',
            ...(financeAgentId ? { requestPatch: { assignedToId: financeAgentId, assignedTeam: 'FINANCE' } } : {}),
        }));

        if (pendingApproval) {
            await prisma.requestApproval.update({
                where: { id: pendingApproval.id },
                data: { status: 'APPROVED', approverId: userId, comments: comments || null },
            });
        }

        if (financeAgentId) {
            await notify({ userId: financeAgentId, eventType: 'STATUS_CHANGED', variables: { referenceNumber: request.referenceNumber, newStatus: 'FINANCE_ACKNOWLEDGED' }, relatedRequestId: id });
        } else {
            console.warn(`[ESM-Workflow] No Finance agent found for request ${id}`);
        }

        await logActivity(id, `Group Deputy CEO approved — routing to Finance for acknowledgement${comments ? ': ' + comments : ''}`, userId);
        await notify({ userId: request.requesterId, eventType: 'STATUS_CHANGED', variables: { referenceNumber: request.referenceNumber, newStatus: 'FINANCE_ACKNOWLEDGED' }, relatedRequestId: id });

        const { resumeSla } = await import('../services/sla-pause.service');
        await resumeSla(id);

        await auditLog(req as any, 'ESM_GROUP_DCEO_DECISION', 'request', id, {
            decision,
            approverType: 'GROUP_DCEO',
            newStatus: 'FINANCE_ACKNOWLEDGED',
            previousStatus: request.status,
            comments: comments || null,
        }, { status: request.status });

        res.json({ status: 'success', message: 'Group Deputy CEO approved — routing to Finance for acknowledgement' });
    } catch (error: any) {
        console.error('groupDceoDecision error:', error);
        if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Failed to process Group Deputy CEO decision' });
    }
};

/**
 * POST /esm-workflow/requests/:id/finance-acknowledge
 *
 * Finance Agent acknowledges the travel request and routes it to CFO.
 * FINANCE_ACKNOWLEDGED → PENDING_CFO_APPROVAL_FIN
 */
export const financeAcknowledge = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { notes } = req.body;
        const userId = (req as any).user?.id;

        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (request.status !== 'FINANCE_ACKNOWLEDGED') {
            res.status(400).json({ status: 'error', message: 'Request must be in FINANCE_ACKNOWLEDGED status to acknowledge' });
            return;
        }

        // Transition: FINANCE_ACKNOWLEDGED → PENDING_CFO_APPROVAL_FIN
        const cfoId = await findCfo();
        await transitionRequest(id, 'PENDING_CFO_APPROVAL_FIN', transitionOpts(req, {
            comment: notes || 'Finance acknowledged — routing to CFO for approval',
            source: 'esm-workflow/finance-acknowledge',
            ...(cfoId ? { requestPatch: { assignedToId: cfoId, assignedTeam: 'FINANCE' } } : {}),
        }));

        // Find and create CFO approval record
        if (cfoId) {
            await prisma.requestApproval.create({
                data: { requestId: id, approverType: 'CFO', approverId: cfoId, status: 'PENDING', comments: notes || null },
            });

            await notify({ userId: cfoId, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'CFO' }, relatedRequestId: id });
        } else {
            console.warn(`[ESM-Workflow] No active CFO found for request ${id}`);
        }

        // Pause SLA during CFO approval
        const { pauseSla } = await import('../services/sla-pause.service');
        await pauseSla(id);

        await logActivity(id, `Finance acknowledged — routing to CFO for approval${notes ? ': ' + notes : ''}`, userId);
        await notify({ userId: request.requesterId, eventType: 'STATUS_CHANGED', variables: { referenceNumber: request.referenceNumber, newStatus: 'PENDING_CFO_APPROVAL' }, relatedRequestId: id });

        await auditLog(req as any, 'ESM_FINANCE_ACKNOWLEDGE', 'request', id, {
            newStatus: 'PENDING_CFO_APPROVAL_FIN',
            previousStatus: request.status,
            notes: notes || null,
        }, { status: request.status });

        res.json({ status: 'success', message: 'Finance acknowledged — routing to CFO for approval' });
    } catch (error: any) {
        console.error('financeAcknowledge error:', error);
        if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Failed to acknowledge travel request' });
    }
};

/**
 * POST /esm-workflow/requests/:id/cfo-decision
 *
 * CFO approves or rejects the travel request.
 * Approved → CFO_APPROVED_FIN → COMPLETED (reassigned to requester).
 * Rejected → CFO_REJECTED_FIN → REJECTED (terminal).
 */
export const cfoDecisionTravel = async (req: Request, res: Response) => {
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
            include: { approvals: { where: { approverType: 'CFO', status: 'PENDING' } } },
        });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (request.status !== 'PENDING_CFO_APPROVAL_FIN') {
            res.status(400).json({ status: 'error', message: 'Request is not pending CFO approval' });
            return;
        }

        const pendingCfoApproval = request.approvals[0];

        if (decision === 'REJECTED') {
            // PENDING_CFO_APPROVAL_FIN → CFO_REJECTED_FIN → REJECTED (terminal)
            await transitionRequest(id, 'CFO_REJECTED_FIN', transitionOpts(req, {
                comment: comments || 'CFO rejected the travel request',
                source: 'esm-workflow/cfo-reject',
            }));
            await transitionRequest(id, 'REJECTED', transitionOpts(req, {
                comment: comments || 'Travel request rejected by CFO',
                source: 'esm-workflow/cfo-reject-terminal',
                requestPatch: { assignedToId: request.requesterId, assignedTeam: null },
            }));

            if (pendingCfoApproval) {
                await prisma.requestApproval.update({
                    where: { id: pendingCfoApproval.id },
                    data: { status: 'REJECTED', approverId: userId, comments: comments || null },
                });
            }

            // Reassign back to requester (handled via requestPatch above)
            await logActivity(id, `CFO rejected the travel request${comments ? ': ' + comments : ''}`, userId);
            await notify({ userId: request.requesterId, eventType: 'STATUS_CHANGED', variables: { referenceNumber: request.referenceNumber, newStatus: 'REJECTED' }, relatedRequestId: id });

            const { resumeSla } = await import('../services/sla-pause.service');
            await resumeSla(id);

            await auditLog(req as any, 'ESM_CFO_DECISION', 'request', id, {
                decision,
                approverType: 'CFO',
                newStatus: 'REJECTED',
                previousStatus: request.status,
                comments: comments || null,
            }, { status: request.status });

            res.json({ status: 'success', message: 'Travel request rejected by CFO' });
            return;
        }

        // ── CFO APPROVED ──
        // CFO_APPROVED_FIN → COMPLETED
        if (pendingCfoApproval) {
            await prisma.requestApproval.update({
                where: { id: pendingCfoApproval.id },
                data: { status: 'APPROVED', approverId: userId, comments: comments || null },
            });
        } else {
            await prisma.requestApproval.create({
                data: { requestId: id, approverType: 'CFO', approverId: userId, status: 'APPROVED', comments: comments || null },
            });
        }

        await transitionRequest(id, 'CFO_APPROVED_FIN', transitionOpts(req, {
            comment: comments || 'CFO approved the travel request',
            source: 'esm-workflow/cfo-approve',
        }));
        await transitionRequest(id, 'COMPLETED', transitionOpts(req, {
            comment: 'Travel request approved — all approvals completed',
            source: 'esm-workflow/cfo-approve-complete',
            requestPatch: { assignedToId: request.requesterId, assignedTeam: null },
        }));

        await logActivity(id, `CFO approved the travel request — all approvals completed${comments ? ': ' + comments : ''}`, userId);
        await notify({ userId: request.requesterId, eventType: 'STATUS_CHANGED', variables: { referenceNumber: request.referenceNumber, newStatus: 'COMPLETED' }, relatedRequestId: id });

        const { resumeSla } = await import('../services/sla-pause.service');
        await resumeSla(id);

        await auditLog(req as any, 'ESM_CFO_DECISION', 'request', id, {
            decision,
            approverType: 'CFO',
            newStatus: 'COMPLETED',
            previousStatus: request.status,
            comments: comments || null,
        }, { status: request.status });

        res.json({ status: 'success', message: 'CFO approved — travel request completed' });
    } catch (error: any) {
        console.error('cfoDecisionTravel error:', error);
        if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Failed to process CFO decision' });
    }
};

/**
 * POST /esm-workflow/requests/:id/close
 *
 * Admin/Agent closes a completed travel request.
 * COMPLETED → RESOLVED
 */
export const closeTicket = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { notes } = req.body;

        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (request.status !== 'COMPLETED') {
            res.status(400).json({ status: 'error', message: 'Request must be in COMPLETED status to close' });
            return;
        }

        // COMPLETED → RESOLVED
        await transitionRequest(id, 'RESOLVED', transitionOpts(req, {
            comment: notes || 'Travel request closed',
            source: 'esm-workflow/close',
        }));

        await logActivity(id, `Travel request closed and resolved${notes ? ': ' + notes : ''}`, (req as any).user?.id);
        await auditLog(req as any, 'ESM_TICKET_CLOSED', 'request', id, {
            newStatus: 'RESOLVED',
            previousStatus: request.status,
            notes: notes || null,
        }, { status: request.status });

        res.json({ status: 'success', message: 'Travel request closed' });
    } catch (error: any) {
        console.error('closeTicket error:', error);
        if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Failed to close travel request' });
    }
};