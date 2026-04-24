import { Request, Response } from 'express';
import { PrismaClient, RequestStatus } from '@prisma/client';
import { notify } from '../services/notification.service';
import { config } from '../config';

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
export const acknowledge = async (req: Request, res: Response): Promise<void> => {
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
        await notify({ userId: request.requesterId, eventType: 'FINANCE_ACKNOWLEDGED', variables: { requestId: id }, relatedRequestId: id });

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('acknowledge error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to acknowledge request' });
    }
};

/** POST /finance-workflow/requests/:id/set-finalized-amount */
export const setFinalizedAmountAndRouteCfo = async (req: Request, res: Response): Promise<void> => {
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
        const updated = await prisma.request.update({
            where: { id },
            data: {
                status: RequestStatus.PENDING_CFO_APPROVAL_FIN,
                customFields: { ...existingFields, finalizedAmount: Number(finalizedAmount) },
            },
        });

        await logActivity(id, `Finalized amount set to MYR ${finalizedAmount}. Routed to CFO for approval${notes ? ': ' + notes : ''}`);
        await notify({ userId: request.requesterId, eventType: 'FINANCE_ROUTED_CFO', variables: { requestId: id }, relatedRequestId: id });

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('setFinalizedAmountAndRouteCfo error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to route to CFO' });
    }
};

/** POST /finance-workflow/requests/:id/cfo-decision */
export const cfoDecision = async (req: Request, res: Response): Promise<void> => {
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

        const updated = await prisma.request.update({ where: { id }, data: { status: newStatus } });

        await prisma.requestApproval.create({
            data: { requestId: id, approverType: 'CFO', approverId: userId, status: decision, comments: comments || null },
        });

        const verb = decision === 'REJECTED' ? 'rejected' : `approved — routed to ${newStatus === RequestStatus.PENDING_GROUP_CEO_APPROVAL ? 'Group CEO (amount > MYR ' + GROUP_CEO_THRESHOLD + ')' : 'payment processing'}`;
        await logActivity(id, `CFO ${verb}${comments ? ': ' + comments : ''}`, userId);
        await notify({ userId: request.requesterId, eventType: 'FINANCE_CFO_DECISION', variables: { requestId: id, decision }, relatedRequestId: id });

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('cfoDecision error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to process CFO decision' });
    }
};

/** POST /finance-workflow/requests/:id/group-ceo-decision */
export const groupCeoDecision = async (req: Request, res: Response): Promise<void> => {
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
        const updated = await prisma.request.update({ where: { id }, data: { status: newStatus } });

        await prisma.requestApproval.create({
            data: { requestId: id, approverType: 'GROUP_CEO', approverId: userId, status: decision, comments: comments || null },
        });

        const verb = decision === 'APPROVED' ? 'approved — routed to payment processing' : 'rejected';
        await logActivity(id, `Group CEO ${verb}${comments ? ': ' + comments : ''}`, userId);
        await notify({ userId: request.requesterId, eventType: 'FINANCE_GROUP_CEO_DECISION', variables: { requestId: id, decision }, relatedRequestId: id });

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('groupCeoDecision error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to process Group CEO decision' });
    }
};

/** POST /finance-workflow/requests/:id/mark-payment-complete */
export const markPaymentComplete = async (req: Request, res: Response): Promise<void> => {
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
        await notify({ userId: request.requesterId, eventType: 'FINANCE_PAYMENT_COMPLETE', variables: { requestId: id }, relatedRequestId: id });

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('markPaymentComplete error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to mark payment complete' });
    }
};

/** POST /finance-workflow/requests/:id/close */
export const closeTicket = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = String(req.params.id);

        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        const updated = await prisma.request.update({
            where: { id },
            data: { status: RequestStatus.TICKET_CLOSED_FIN, resolvedAt: new Date() },
        });

        await logActivity(id, 'Ticket closed by Finance Agent');
        await notify({ userId: request.requesterId, eventType: 'FINANCE_TICKET_CLOSED', variables: { requestId: id }, relatedRequestId: id });

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('closeTicket error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to close ticket' });
    }
};