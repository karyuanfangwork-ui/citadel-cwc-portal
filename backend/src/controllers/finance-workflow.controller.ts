import { Request, Response } from 'express';
import path from 'path';
import { PrismaClient, RequestStatus } from '@prisma/client';
import { notify } from '../services/notification.service';
import { auditLog } from '../utils/audit';
import { reassignToTeam } from '../services/reassign.service';
import { pauseSla, resumeSla } from '../services/sla-pause.service';

const prisma = new PrismaClient();

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

/** POST /finance-workflow/requests/:id/acknowledge */
export const acknowledge = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { notes } = req.body;
        
        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        const updated = await prisma.request.update({
            where: { id },
            data: { status: RequestStatus.FINANCE_ACKNOWLEDGED },
        });

        await logActivity(id, `Finance agent acknowledged request${notes ? ': ' + notes : ''}`);
        await auditLog(req as any, 'FINANCE_ACKNOWLEDGED', 'request', id, {
            status: RequestStatus.FINANCE_ACKNOWLEDGED,
            previousStatus: request.status,
            notes: notes || null,
        }, { status: request.status });
        await notify({ userId: request.requesterId, eventType: 'FINANCE_ACKNOWLEDGED', variables: { requestId: id }, relatedRequestId: id });

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('acknowledge error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to acknowledge request' });
    }
};

/** POST /finance-workflow/requests/:id/route-to-cfo
 *  Simple route-to-CFO for Budget Proposals (no finalized amount or invoice required).
 */
export const routeToCfo = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { notes } = req.body;

        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        // Find CFO user for assignee reassignment
        const cfoPendingApproval = await prisma.requestApproval.findFirst({
            where: { requestId: id, approverType: 'CFO', status: 'PENDING' },
            select: { approverId: true },
        });
        const cfoUserId = cfoPendingApproval?.approverId ?? (await prisma.user.findFirst({
            where: { executiveRole: 'CFO', isActive: true },
            select: { id: true },
        }))?.id;

        const updateData: any = {
            status: RequestStatus.PENDING_CFO_APPROVAL_FIN,
        };
        if (cfoUserId) {
            updateData.assignedToId = cfoUserId;
        }

        const updated = await prisma.request.update({
            where: { id },
            data: updateData,
        });

        await logActivity(id, `Routed to CFO for approval${notes ? ': ' + notes : ''}`);
        await auditLog(req as any, 'FINANCE_ROUTED_CFO', 'request', id, {
            status: RequestStatus.PENDING_CFO_APPROVAL_FIN,
            previousStatus: request.status,
            notes: notes || null,
        }, { status: request.status });
        await notify({ userId: request.requesterId, eventType: 'FINANCE_ROUTED_CFO', variables: { requestId: id }, relatedRequestId: id });

        if (cfoUserId) {
            await notify({ userId: cfoUserId, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'CFO' }, relatedRequestId: id });
        }

        await pauseSla(id);

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('routeToCfo error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to route to CFO' });
    }
};

/** POST /finance-workflow/requests/:id/set-finalized-amount-and-route-cfo */
export const setFinalizedAmountAndRouteCfo = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        // Multer parses multipart fields into req.body; JSON body stays as-is
        const finalizedAmount = req.body.finalizedAmount ? Number(req.body.finalizedAmount) : NaN;
        const notes = req.body.notes || undefined;
        const invoiceFiles = (req as any).files as Express.Multer.File[] | undefined;
        const currentUser = (req as any).user;

        if (isNaN(finalizedAmount) || finalizedAmount <= 0) {
            res.status(400).json({ status: 'error', message: 'finalizedAmount must be a positive number' });
            return;
        }

        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        const existingFields = (request.customFields as Record<string, unknown>) || {};

        // Find CFO user for assignee reassignment
        const cfoPendingApproval = await prisma.requestApproval.findFirst({
            where: { requestId: id, approverType: 'CFO', status: 'PENDING' },
            select: { approverId: true },
        });
        const cfoUserId = cfoPendingApproval?.approverId ?? (await prisma.user.findFirst({
            where: { executiveRole: 'CFO', isActive: true },
            select: { id: true },
        }))?.id;

        const updateData: any = {
            status: RequestStatus.PENDING_CFO_APPROVAL_FIN,
            customFields: { ...existingFields, finalizedAmount },
        };
        // Reassign to CFO so ticket shows under CFO's dashboard
        if (cfoUserId) {
            updateData.assignedToId = cfoUserId;
        }

        const updated = await prisma.request.update({
            where: { id },
            data: updateData,
        });

        // Create a system activity and link invoice attachments to it
        // so they appear in the ActivityFeed for all stakeholders
        const activity = await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: currentUser?.id || null,
                authorName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'System',
                activityType: 'STATUS_CHANGE',
                message: `Finalized amount set to MYR ${finalizedAmount}. Routed to CFO for approval${notes ? ': ' + notes : ''}${invoiceFiles && invoiceFiles.length > 0 ? ` (${invoiceFiles.length} invoice${invoiceFiles.length > 1 ? 's' : ''} attached)` : ''}`,
                isSystemGenerated: true,
            },
        });

        // Save invoice attachments if provided, linked to the activity
        if (invoiceFiles && invoiceFiles.length > 0) {
            for (const f of invoiceFiles) {
                await prisma.requestAttachment.create({
                    data: {
                        requestId: id,
                        uploadedById: currentUser?.id || null,
                        activityId: activity.id,
                        fileName: f.originalname,
                        fileSize: BigInt(f.size),
                        mimeType: f.mimetype,
                        fileType: path.extname(f.originalname).replace('.', ''),
                        storagePath: (f as any).key,
                        storageUrl: (f as any).key,
                    },
                });
            }
        }
        await auditLog(req as any, 'FINANCE_ROUTED_CFO', 'request', id, {
            status: RequestStatus.PENDING_CFO_APPROVAL_FIN,
            previousStatus: request.status,
            finalizedAmount,
            notes: notes || null,
        }, { status: request.status });
        await notify({ userId: request.requesterId, eventType: 'FINANCE_ROUTED_CFO', variables: { requestId: id }, relatedRequestId: id });

        // Notify the CFO who was assigned this approval
        if (cfoUserId) {
            await notify({ userId: cfoUserId, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'CFO' }, relatedRequestId: id });
        }

        await pauseSla(id);

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('setFinalizedAmountAndRouteCfo error:', error);
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

        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        let newStatus: RequestStatus;
        if (decision === 'REJECTED') {
            newStatus = RequestStatus.CFO_REJECTED_FIN;
        } else {
            // Budget Proposals go to FINANCE_IN_PROGRESS (no payment phase, no Group DCEO)
            // Purchase Requisitions go to PAYMENT_PROCESSING_FIN or PENDING_GROUP_DCEO_APPROVAL
            // Determine request type to decide routing
            const requestType = await prisma.requestType.findFirst({
                where: { id: request.requestTypeId! },
                select: { code: true },
            });
            const isBudgetProposal = requestType?.code === 'BUDGET_PROPOSAL';

            if (isBudgetProposal) {
                // Budget Proposals: CFO approval → Finance Updating (no Group DCEO, no payment)
                newStatus = RequestStatus.FINANCE_IN_PROGRESS;
            } else {
                // Purchase Requisitions: CFO approval → Group Deputy CEO (all amounts)
                newStatus = RequestStatus.PENDING_GROUP_DCEO_APPROVAL;
            }
        }

        const cfoUpdateData: any = { status: newStatus };
        // Resolve Group Deputy CEO ID (needed for both assignment and notification)
        let groupDceoId: string | undefined;
        if (newStatus === RequestStatus.PENDING_GROUP_DCEO_APPROVAL) {
            // When routing to Group Deputy CEO, reassign to them and create PENDING approval record
            const existingGroupDceoApproval = await prisma.requestApproval.findFirst({
                where: { requestId: id, approverType: 'GROUP_DCEO', status: 'PENDING' },
                select: { approverId: true },
            });
            if (existingGroupDceoApproval?.approverId) {
                groupDceoId = existingGroupDceoApproval.approverId;
            } else {
                const groupDceoUser = await prisma.user.findFirst({
                    where: { isActive: true, executiveRole: 'GROUP_DCEO' },
                    select: { id: true },
                });
                groupDceoId = groupDceoUser?.id;
            }
            if (groupDceoId) {
                cfoUpdateData.assignedToId = groupDceoId;
                // Create the PENDING GROUP_DCEO approval record if it doesn't exist yet
                if (!existingGroupDceoApproval) {
                    await prisma.requestApproval.create({
                        data: {
                            requestId: id,
                            approverType: 'GROUP_DCEO',
                            approverId: groupDceoId,
                            status: 'PENDING',
                            comments: null,
                        },
                    });
                }
            }
        } else {
            // CFO approved (payment processing / budget) or rejected — reassign back to Finance agent using shared reassignToTeam
            await reassignToTeam(id, (await prisma.request.findUnique({ where: { id } }))!.referenceNumber, 'FINANCE', 'Finance-Workflow');
        }

        const updated = await prisma.request.update({ where: { id }, data: cfoUpdateData });

        await prisma.requestApproval.create({
            data: { requestId: id, approverType: 'CFO', approverId: userId, status: decision, comments: comments || null },
        });

        const verb = decision === 'REJECTED' ? 'rejected' : `approved — routed to ${newStatus === RequestStatus.PENDING_GROUP_DCEO_APPROVAL ? 'Group Deputy CEO' : newStatus === RequestStatus.FINANCE_IN_PROGRESS ? 'Finance Updating (budget adopted)' : 'payment processing'}`;
        await logActivity(id, `CFO ${verb}${comments ? ': ' + comments : ''}`, userId);
        await auditLog(req as any, 'APPROVAL_DECISION', 'request', id, {
            decision,
            approverType: 'CFO',
            newStatus,
            previousStatus: request.status,
            comments: comments || null,
        }, { status: request.status });
        await notify({ userId: request.requesterId, eventType: 'FINANCE_CFO_DECISION', variables: { requestId: id, decision }, relatedRequestId: id });

        // If routed to Group Deputy CEO for approval, notify them
        if (newStatus === RequestStatus.PENDING_GROUP_DCEO_APPROVAL) {
            // Use the groupDceoId already resolved above if available, otherwise look it up
            const gCeoIdForNotify = groupDceoId ?? (await prisma.user.findFirst({
                where: { isActive: true, executiveRole: 'GROUP_DCEO' },
                select: { id: true },
            }))?.id;
            if (gCeoIdForNotify) {
                await notify({ userId: gCeoIdForNotify, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'Group Deputy CEO' }, relatedRequestId: id });
            }
        }

        await resumeSla(id);

        // If routed to Group Deputy CEO, pause SLA again for approval wait
        if (newStatus === RequestStatus.PENDING_GROUP_DCEO_APPROVAL) {
            await pauseSla(id);
        }

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('cfoDecision error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to process CFO decision' });
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

        const newStatus = decision === 'APPROVED' ? RequestStatus.PAYMENT_PROCESSING_FIN : RequestStatus.GROUP_DCEO_REJECTED;

        // Reassign back to Finance agent using shared reassignToTeam (no entity-scoping)
        await reassignToTeam(id, request.referenceNumber, 'FINANCE', 'Finance-Workflow');
        const gCeoUpdateData: any = { status: newStatus };

        const updated = await prisma.request.update({ where: { id }, data: gCeoUpdateData });

        // Update the existing PENDING approval record (don't create a duplicate)
        await prisma.requestApproval.update({
            where: { id: pendingApproval.id },
            data: {
                status: decision,
                approverId: userId,
                comments: comments || null,
            },
        });

        const verb = decision === 'APPROVED' ? 'approved — routed to payment processing' : 'rejected';
        await logActivity(id, `Group Deputy CEO ${verb}${comments ? ': ' + comments : ''}`, userId);
        await auditLog(req as any, 'APPROVAL_DECISION', 'request', id, {
            decision,
            approverType: 'GROUP_DCEO',
            newStatus,
            previousStatus: request.status,
            comments: comments || null,
        }, { status: request.status });
        await notify({ userId: request.requesterId, eventType: 'FINANCE_GROUP_DCEO_DECISION', variables: { requestId: id, decision }, relatedRequestId: id });

        // Resume SLA — leaving PENDING_GROUP_DCEO_APPROVAL
        await resumeSla(id);

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('groupDceoDecision error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to process Group Deputy CEO decision' });
    }
};

/** POST /finance-workflow/requests/:id/mark-payment-complete */
export const markPaymentComplete = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { paymentReference, notes } = req.body;

        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        const existingFields = (request.customFields as Record<string, unknown>) || {};
        const updated = await prisma.request.update({
            where: { id },
            data: {
                status: RequestStatus.AWAITING_PAYMENT_CONFIRMATION,
                customFields: { ...existingFields, paymentReference: paymentReference || null },
            },
        });

        await logActivity(id, `Payment marked complete${paymentReference ? ' (Ref: ' + paymentReference + ')' : ''}${notes ? ': ' + notes : ''}`);
        await auditLog(req as any, 'FINANCE_PAYMENT_COMPLETE', 'request', id, {
            status: RequestStatus.AWAITING_PAYMENT_CONFIRMATION,
            previousStatus: request.status,
            paymentReference: paymentReference || null,
        }, { status: request.status });
        await notify({ userId: request.requesterId, eventType: 'FINANCE_PAYMENT_COMPLETE', variables: { requestId: id }, relatedRequestId: id });

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('markPaymentComplete error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to mark payment complete' });
    }
};

/** POST /finance-workflow/requests/:id/close */
export const closeTicket = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);

        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        const updated = await prisma.request.update({
            where: { id },
            data: { status: RequestStatus.TICKET_CLOSED_FIN, resolvedAt: new Date(), completedAt: new Date() },
        });

        await logActivity(id, 'Ticket closed by Finance Agent');
        await auditLog(req as any, 'FINANCE_TICKET_CLOSED', 'request', id, {
            status: RequestStatus.TICKET_CLOSED_FIN,
            previousStatus: request.status,
            resolvedAt: new Date().toISOString(),
        }, { status: request.status });
        await notify({ userId: request.requesterId, eventType: 'FINANCE_TICKET_CLOSED', variables: { requestId: id }, relatedRequestId: id });

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('closeTicket error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to close ticket' });
    }
};

/** POST /finance-workflow/requests/:id/update-and-close-budget */
export const updateAndCloseBudget = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { notes } = req.body;
        const userId = (req as any).user?.id;

        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (request.status !== 'FINANCE_IN_PROGRESS') {
            res.status(400).json({ status: 'error', message: 'Request must be in Finance Updating status to close' });
            return;
        }

        const updated = await prisma.request.update({
            where: { id },
            data: { status: RequestStatus.TICKET_CLOSED_FIN, resolvedAt: new Date(), completedAt: new Date() },
        });

        await logActivity(id, `Budget proposal closed by Finance Agent${notes ? ': ' + notes : ''}`, userId);
        await auditLog(req as any, 'BUDGET_PROPOSAL_CLOSED', 'request', id, {
            status: RequestStatus.TICKET_CLOSED_FIN,
            previousStatus: request.status,
            notes: notes || null,
        }, { status: request.status });
        await notify({ userId: request.requesterId, eventType: 'FINANCE_TICKET_CLOSED', variables: { requestId: id }, relatedRequestId: id });

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('updateAndCloseBudget error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to update and close budget proposal' });
    }
};

// ─── Expense Reimbursement Workflow Endpoints ───

/** POST /finance-workflow/requests/:id/manager-approve-expense */
export const managerApproveExpense = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { comments } = req.body;
        const userId = (req as any).user?.id;

        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (request.status !== RequestStatus.PENDING_MANAGER_APPROVAL_FIN) {
            res.status(400).json({ status: 'error', message: 'Request is not pending manager approval' });
            return;
        }

        const updated = await prisma.request.update({
            where: { id },
            data: { status: RequestStatus.MANAGER_APPROVED_FIN },
        });

        await prisma.requestApproval.create({
            data: { requestId: id, approverType: 'MANAGER', approverId: userId, status: 'APPROVED', comments: comments || null },
        });

        await logActivity(id, `Manager approved expense claim — routed to Finance Head${comments ? ': ' + comments : ''}`, userId);
        await auditLog(req as any, 'EXPENSE_MANAGER_APPROVED', 'request', id, {
            status: RequestStatus.MANAGER_APPROVED_FIN,
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

        await resumeSla(id);

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('managerApproveExpense error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to approve expense claim' });
    }
};

/** POST /finance-workflow/requests/:id/manager-reject-expense */
export const managerRejectExpense = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { comments } = req.body;
        const userId = (req as any).user?.id;

        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (request.status !== RequestStatus.PENDING_MANAGER_APPROVAL_FIN) {
            res.status(400).json({ status: 'error', message: 'Request is not pending manager approval' });
            return;
        }

        const updated = await prisma.request.update({
            where: { id },
            data: { status: RequestStatus.MANAGER_REJECTED_FIN },
        });

        await prisma.requestApproval.create({
            data: { requestId: id, approverType: 'MANAGER', approverId: userId, status: 'REJECTED', comments: comments || null },
        });

        await logActivity(id, `Manager rejected expense claim — returned to requester${comments ? ': ' + comments : ''}`, userId);
        await auditLog(req as any, 'EXPENSE_MANAGER_REJECTED', 'request', id, {
            status: RequestStatus.MANAGER_REJECTED_FIN,
            previousStatus: request.status,
            comments: comments || null,
        }, { status: request.status });
        await notify({ userId: request.requesterId, eventType: 'EXPENSE_MANAGER_REJECTED', variables: { requestId: id }, relatedRequestId: id });

        await resumeSla(id);

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('managerRejectExpense error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to reject expense claim' });
    }
};

/** POST /finance-workflow/requests/:id/finance-head-approve-expense */
export const financeHeadApproveExpense = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { comments } = req.body;
        const userId = (req as any).user?.id;

        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (request.status !== RequestStatus.PENDING_FINANCE_HEAD_APPROVAL) {
            res.status(400).json({ status: 'error', message: 'Request is not pending Finance Head approval' });
            return;
        }

        const updated = await prisma.request.update({
            where: { id },
            data: { status: RequestStatus.FINANCE_HEAD_APPROVED },
        });

        await prisma.requestApproval.create({
            data: { requestId: id, approverType: 'FINANCE_HEAD', approverId: userId, status: 'APPROVED', comments: comments || null },
        });

        await logActivity(id, `Finance Head approved expense claim — routed to payment processing${comments ? ': ' + comments : ''}`, userId);
        await auditLog(req as any, 'EXPENSE_FINANCE_HEAD_APPROVED', 'request', id, {
            status: RequestStatus.FINANCE_HEAD_APPROVED,
            previousStatus: request.status,
            comments: comments || null,
        }, { status: request.status });
        await notify({ userId: request.requesterId, eventType: 'EXPENSE_FINANCE_HEAD_APPROVED', variables: { requestId: id }, relatedRequestId: id });

        await resumeSla(id);

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('financeHeadApproveExpense error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to approve expense claim' });
    }
};

/** POST /finance-workflow/requests/:id/finance-head-reject-expense */
export const financeHeadRejectExpense = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { comments } = req.body;
        const userId = (req as any).user?.id;

        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (request.status !== RequestStatus.PENDING_FINANCE_HEAD_APPROVAL) {
            res.status(400).json({ status: 'error', message: 'Request is not pending Finance Head approval' });
            return;
        }

        const updated = await prisma.request.update({
            where: { id },
            data: { status: RequestStatus.FINANCE_HEAD_REJECTED },
        });

        await prisma.requestApproval.create({
            data: { requestId: id, approverType: 'FINANCE_HEAD', approverId: userId, status: 'REJECTED', comments: comments || null },
        });

        await logActivity(id, `Finance Head rejected expense claim — returned to requester${comments ? ': ' + comments : ''}`, userId);
        await auditLog(req as any, 'EXPENSE_FINANCE_HEAD_REJECTED', 'request', id, {
            status: RequestStatus.FINANCE_HEAD_REJECTED,
            previousStatus: request.status,
            comments: comments || null,
        }, { status: request.status });
        await notify({ userId: request.requesterId, eventType: 'EXPENSE_FINANCE_HEAD_REJECTED', variables: { requestId: id }, relatedRequestId: id });

        await resumeSla(id);

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('financeHeadRejectExpense error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to reject expense claim' });
    }
};

/** POST /finance-workflow/requests/:id/mark-expense-payment-complete */
export const markExpensePaymentComplete = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { paymentReference, notes } = req.body;

        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (request.status !== RequestStatus.PAYMENT_PROCESSING) {
            res.status(400).json({ status: 'error', message: 'Request is not in payment processing' });
            return;
        }

        const existingFields = (request.customFields as Record<string, unknown>) || {};
        const updated = await prisma.request.update({
            where: { id },
            data: {
                status: RequestStatus.PAYMENT_COMPLETED,
                customFields: { ...existingFields, paymentReference: paymentReference || null },
            },
        });

        // auto-close the reimbursement after payment is marked complete
        await prisma.request.update({
            where: { id },
            data: { status: RequestStatus.REIMBURSEMENT_CLOSED, resolvedAt: new Date(), completedAt: new Date() },
        });

        await logActivity(id, `Expense payment completed${paymentReference ? ' (Ref: ' + paymentReference + ')' : ''}${notes ? ': ' + notes : ''}`);
        await auditLog(req as any, 'EXPENSE_PAYMENT_COMPLETE', 'request', id, {
            status: RequestStatus.REIMBURSEMENT_CLOSED,
            previousStatus: request.status,
            paymentReference: paymentReference || null,
        }, { status: request.status });
        await notify({ userId: request.requesterId, eventType: 'EXPENSE_PAYMENT_COMPLETE', variables: { requestId: id }, relatedRequestId: id });

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('markExpensePaymentComplete error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to mark expense payment complete' });
    }
};