import { Request, Response } from 'express';
import { PrismaClient, RequestStatus } from '@prisma/client';
import { notify } from '../services/notification.service';
import { auditLog } from '../utils/audit';
import { config } from '../config';
import { pauseSla, resumeSla } from '../services/sla-pause.service';

const prisma = new PrismaClient();

// Get threshold from config (configurable via GROUP_CEO_APPROVAL_THRESHOLD env var)
const GROUP_CEO_THRESHOLD = config.groupCeoApprovalThreshold;

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

/** POST /finance-workflow/requests/:id/set-finalized-amount */
export const setFinalizedAmountAndRouteCfo = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { finalizedAmount, notes } = req.body;

        if (finalizedAmount === undefined || isNaN(Number(finalizedAmount)) || Number(finalizedAmount) <= 0) {
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
            customFields: { ...existingFields, finalizedAmount: Number(finalizedAmount) },
        };
        // Reassign to CFO so ticket shows under CFO's dashboard
        if (cfoUserId) {
            updateData.assignedToId = cfoUserId;
        }

        const updated = await prisma.request.update({
            where: { id },
            data: updateData,
        });

        await logActivity(id, `Finalized amount set to MYR ${finalizedAmount}. Routed to CFO for approval${notes ? ': ' + notes : ''}`);
        await auditLog(req as any, 'FINANCE_ROUTED_CFO', 'request', id, {
            status: RequestStatus.PENDING_CFO_APPROVAL_FIN,
            previousStatus: request.status,
            finalizedAmount: Number(finalizedAmount),
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
            const fields = (request.customFields as Record<string, unknown>) || {};
            const amount = Number(fields.finalizedAmount ?? 0);
            newStatus = amount > GROUP_CEO_THRESHOLD ? RequestStatus.PENDING_GROUP_CEO_APPROVAL : RequestStatus.PAYMENT_PROCESSING_FIN;
        }

        const cfoUpdateData: any = { status: newStatus };
        if (newStatus === RequestStatus.PENDING_GROUP_CEO_APPROVAL) {
            // When routing to Group CEO, reassign to them
            const groupCeoApprovalLookup = await prisma.requestApproval.findFirst({
                where: { requestId: id, approverType: 'GROUP_CEO', status: 'PENDING' },
                select: { approverId: true },
            });
            const groupCeoId = groupCeoApprovalLookup?.approverId ?? (await prisma.user.findFirst({
                where: { isActive: true, roles: { some: { role: { name: 'GROUP_CEO' } } } },
                select: { id: true },
            }))?.id;
            if (groupCeoId) {
                cfoUpdateData.assignedToId = groupCeoId;
            }
        } else {
            // CFO approved (payment processing) or rejected — reassign back to Finance agent (AGENT/ADMIN role only)
            const requestWithRequester = await prisma.request.findUnique({ where: { id }, include: { requester: true } });
            const entityFilter = requestWithRequester?.requester?.entityId ? { entityId: requestWithRequester.requester.entityId } : {};
            const financeAgent = await prisma.user.findFirst({
                where: { OR: [{ agentTeam: 'FINANCE' }, { agentTeam: 'Finance' }], isActive: true, ...entityFilter, roles: { some: { role: { name: { in: ['AGENT', 'ADMIN'] } } } } },
            });
            if (financeAgent) {
                cfoUpdateData.assignedToId = financeAgent.id;
            }
        }

        const updated = await prisma.request.update({ where: { id }, data: cfoUpdateData });

        await prisma.requestApproval.create({
            data: { requestId: id, approverType: 'CFO', approverId: userId, status: decision, comments: comments || null },
        });

        const verb = decision === 'REJECTED' ? 'rejected' : `approved — routed to ${newStatus === RequestStatus.PENDING_GROUP_CEO_APPROVAL ? 'Group CEO (amount > MYR ' + GROUP_CEO_THRESHOLD + ')' : 'payment processing'}`;
        await logActivity(id, `CFO ${verb}${comments ? ': ' + comments : ''}`, userId);
        await auditLog(req as any, 'APPROVAL_DECISION', 'request', id, {
            decision,
            approverType: 'CFO',
            newStatus,
            previousStatus: request.status,
            comments: comments || null,
        }, { status: request.status });
        await notify({ userId: request.requesterId, eventType: 'FINANCE_CFO_DECISION', variables: { requestId: id, decision }, relatedRequestId: id });

        // If routed to Group CEO for approval, notify them
        if (newStatus === RequestStatus.PENDING_GROUP_CEO_APPROVAL) {
            const groupCeoApproval = await prisma.requestApproval.findFirst({
                where: { requestId: id, approverType: 'GROUP_CEO', status: 'PENDING' },
                select: { approverId: true },
            });
            const groupCeoId = groupCeoApproval?.approverId ?? (await prisma.user.findFirst({
                where: { isActive: true, roles: { some: { role: { name: 'GROUP_CEO' } } } },
                select: { id: true },
            }))?.id;
            if (groupCeoId) {
                await notify({ userId: groupCeoId, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'Group CEO' }, relatedRequestId: id });
            }
        }

        await resumeSla(id);

        // If routed to Group CEO, pause SLA again for PENDING_GROUP_CEO_APPROVAL
        if (newStatus === RequestStatus.PENDING_GROUP_CEO_APPROVAL) {
            await pauseSla(id);
        }

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('cfoDecision error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to process CFO decision' });
    }
};

/** POST /finance-workflow/requests/:id/group-ceo-decision */
export const groupCeoDecision = async (req: Request, res: Response) => {
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

        const newStatus = decision === 'APPROVED' ? RequestStatus.PAYMENT_PROCESSING_FIN : RequestStatus.GROUP_CEO_REJECTED;

        // Reassign back to Finance agent after Group CEO decision (AGENT/ADMIN role only)
        const requestWithRequester = await prisma.request.findUnique({ where: { id }, include: { requester: true } });
        const entityFilter = requestWithRequester?.requester?.entityId ? { entityId: requestWithRequester.requester.entityId } : {};
        const financeAgent = await prisma.user.findFirst({
            where: { OR: [{ agentTeam: 'FINANCE' }, { agentTeam: 'Finance' }], isActive: true, ...entityFilter, roles: { some: { role: { name: { in: ['AGENT', 'ADMIN'] } } } } },
        });
        const gCeoUpdateData: any = { status: newStatus };
        if (financeAgent) {
            gCeoUpdateData.assignedToId = financeAgent.id;
        }

        const updated = await prisma.request.update({ where: { id }, data: gCeoUpdateData });

        await prisma.requestApproval.create({
            data: { requestId: id, approverType: 'GROUP_CEO', approverId: userId, status: decision, comments: comments || null },
        });

        const verb = decision === 'APPROVED' ? 'approved — routed to payment processing' : 'rejected';
        await logActivity(id, `Group CEO ${verb}${comments ? ': ' + comments : ''}`, userId);
        await auditLog(req as any, 'APPROVAL_DECISION', 'request', id, {
            decision,
            approverType: 'GROUP_CEO',
            newStatus,
            previousStatus: request.status,
            comments: comments || null,
        }, { status: request.status });
        await notify({ userId: request.requesterId, eventType: 'FINANCE_GROUP_CEO_DECISION', variables: { requestId: id, decision }, relatedRequestId: id });

        // Resume SLA — leaving PENDING_GROUP_CEO_APPROVAL
        await resumeSla(id);

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('groupCeoDecision error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to process Group CEO decision' });
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