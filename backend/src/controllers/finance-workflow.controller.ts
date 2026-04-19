import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { notify } from '../services/notification.service';

const prisma = new PrismaClient();

/**
 * Submit request for manager approval
 * POST /finance-workflow/requests/:id/submit-for-manager
 */
export const submitForManager = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { managerId, notes } = req.body;

        const request = await prisma.request.findUnique({
            where: { id },
            include: { serviceDesk: true }
        });

        if (!request) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }

        if (request.serviceDesk.code !== 'FINANCE') {
            return res.status(400).json({ status: 'error', message: 'Request does not belong to the Finance service desk' });
        }

        const updatedRequest = await prisma.request.update({
            where: { id },
            data: { status: 'PENDING_MANAGER_APPROVAL_FIN' }
        });

        await prisma.requestApproval.create({
            data: {
                requestId: id,
                approverType: 'MANAGER',
                approverId: managerId,
                status: 'PENDING'
            }
        });

        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorName: 'System',
                activityType: 'SYSTEM',
                message: `Request submitted for manager approval${notes ? ': ' + notes : ''}`,
                isSystemGenerated: true
            }
        });

        await notify({
            userId: managerId,
            eventType: 'FINANCE_MANAGER_APPROVAL_REQUESTED',
            variables: { requestId: id },
            relatedRequestId: id
        });

        res.json({ status: 'success', data: { request: updatedRequest } });
    } catch (error) {
        console.error('Error submitting for manager approval:', error);
        res.status(500).json({ status: 'error', message: 'Failed to submit for manager approval' });
    }
};

/**
 * Manager approves or rejects the request
 * POST /finance-workflow/requests/:id/manager-decision
 */
export const managerDecision = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { decision, comments } = req.body;
        const userId = (req as any).user?.id;

        if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
            return res.status(400).json({ status: 'error', message: 'Decision must be APPROVED or REJECTED' });
        }

        const request = await prisma.request.findUnique({ where: { id } });

        if (!request) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }

        const newStatus = decision === 'APPROVED' ? 'MANAGER_APPROVED_FIN' : 'MANAGER_REJECTED_FIN';

        const updatedRequest = await prisma.request.update({
            where: { id },
            data: { status: newStatus }
        });

        await prisma.requestApproval.updateMany({
            where: { requestId: id, approverId: userId, status: 'PENDING' },
            data: { status: decision as 'APPROVED' | 'REJECTED', comments: comments || null }
        });

        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: 'System',
                activityType: decision === 'APPROVED' ? 'APPROVAL' : 'REJECTION',
                message: `Manager ${decision === 'APPROVED' ? 'approved' : 'rejected'} request${comments ? ': ' + comments : ''}`,
                isSystemGenerated: true
            }
        });

        await notify({
            userId: request.requesterId,
            eventType: 'FINANCE_MANAGER_DECISION',
            variables: { requestId: id, decision },
            relatedRequestId: id
        });

        res.json({ status: 'success', data: { request: updatedRequest } });
    } catch (error) {
        console.error('Error processing manager decision:', error);
        res.status(500).json({ status: 'error', message: 'Failed to process manager decision' });
    }
};

/**
 * Submit request for finance head approval
 * POST /finance-workflow/requests/:id/submit-for-finance-head
 */
export const submitForFinanceHead = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { financeHeadId, notes } = req.body;

        const request = await prisma.request.findUnique({ where: { id } });

        if (!request) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }

        const updatedRequest = await prisma.request.update({
            where: { id },
            data: { status: 'PENDING_FINANCE_HEAD_APPROVAL' }
        });

        await prisma.requestApproval.create({
            data: {
                requestId: id,
                approverType: 'FINANCE_HEAD',
                approverId: financeHeadId,
                status: 'PENDING'
            }
        });

        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorName: 'System',
                activityType: 'SYSTEM',
                message: `Request submitted for finance head approval${notes ? ': ' + notes : ''}`,
                isSystemGenerated: true
            }
        });

        await notify({
            userId: financeHeadId,
            eventType: 'FINANCE_HEAD_APPROVAL_REQUESTED',
            variables: { requestId: id },
            relatedRequestId: id
        });

        res.json({ status: 'success', data: { request: updatedRequest } });
    } catch (error) {
        console.error('Error submitting for finance head approval:', error);
        res.status(500).json({ status: 'error', message: 'Failed to submit for finance head approval' });
    }
};

/**
 * Finance head approves or rejects the request
 * POST /finance-workflow/requests/:id/finance-head-decision
 */
export const financeHeadDecision = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { decision, comments } = req.body;
        const userId = (req as any).user?.id;

        if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
            return res.status(400).json({ status: 'error', message: 'Decision must be APPROVED or REJECTED' });
        }

        const request = await prisma.request.findUnique({ where: { id } });

        if (!request) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }

        const newStatus = decision === 'APPROVED' ? 'FINANCE_HEAD_APPROVED' : 'FINANCE_HEAD_REJECTED';

        const updatedRequest = await prisma.request.update({
            where: { id },
            data: { status: newStatus }
        });

        await prisma.requestApproval.updateMany({
            where: { requestId: id, approverId: userId, status: 'PENDING' },
            data: { status: decision as 'APPROVED' | 'REJECTED', comments: comments || null }
        });

        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: 'System',
                activityType: decision === 'APPROVED' ? 'APPROVAL' : 'REJECTION',
                message: `Finance head ${decision === 'APPROVED' ? 'approved' : 'rejected'} request${comments ? ': ' + comments : ''}`,
                isSystemGenerated: true
            }
        });

        await notify({
            userId: request.requesterId,
            eventType: 'FINANCE_HEAD_DECISION',
            variables: { requestId: id, decision },
            relatedRequestId: id
        });

        res.json({ status: 'success', data: { request: updatedRequest } });
    } catch (error) {
        console.error('Error processing finance head decision:', error);
        res.status(500).json({ status: 'error', message: 'Failed to process finance head decision' });
    }
};

/**
 * Mark payment status
 * POST /finance-workflow/requests/:id/mark-payment
 */
export const markPayment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { paymentStatus, paymentReference, notes } = req.body;

        if (!paymentStatus || !['PROCESSING', 'COMPLETED'].includes(paymentStatus)) {
            return res.status(400).json({ status: 'error', message: 'paymentStatus must be PROCESSING or COMPLETED' });
        }

        const request = await prisma.request.findUnique({ where: { id } });

        if (!request) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }

        const newStatus = paymentStatus === 'PROCESSING' ? 'PAYMENT_PROCESSING' : 'PAYMENT_COMPLETED';

        const existingCustomFields = (request.customFields as Record<string, unknown>) || {};

        const updatedRequest = await prisma.request.update({
            where: { id },
            data: {
                status: newStatus,
                ...(paymentStatus === 'COMPLETED' ? { resolvedAt: new Date() } : {}),
                customFields: {
                    ...existingCustomFields,
                    paymentReference: paymentReference || null
                }
            }
        });

        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorName: 'System',
                activityType: 'SYSTEM',
                message: `Payment marked as ${paymentStatus.toLowerCase()}${paymentReference ? ' (Ref: ' + paymentReference + ')' : ''}${notes ? ': ' + notes : ''}`,
                isSystemGenerated: true
            }
        });

        await notify({
            userId: request.requesterId,
            eventType: 'FINANCE_PAYMENT_UPDATE',
            variables: { requestId: id, paymentStatus },
            relatedRequestId: id
        });

        res.json({ status: 'success', data: { request: updatedRequest } });
    } catch (error) {
        console.error('Error marking payment:', error);
        res.status(500).json({ status: 'error', message: 'Failed to mark payment' });
    }
};
