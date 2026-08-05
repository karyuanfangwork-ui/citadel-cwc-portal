/**
 * P5-08: Approval Delegation Controller
 *
 * REST API for delegating approvals and viewing delegation history.
 */

import { Request, Response } from 'express';
import { delegateApproval } from '../services/approvalDelegation.service';
import prisma from '../utils/prisma';

// Delegate an approval to another user
export async function delegateApprovalAction(req: Request, res: Response) {
    try {
        const approvalId = req.params.approvalId as string;
        const { toUserId, reason } = req.body as { toUserId: string; reason?: string };
        const fromUserId = (req as any).user?.id;

        if (!toUserId) {
            return res.status(400).json({ error: 'toUserId is required' });
        }

        const result = await delegateApproval({
            approvalId,
            fromUserId,
            toUserId,
            reason,
        });

        res.json(result);
    } catch (error: any) {
        if (error.message === 'Approval not found') {
            return res.status(404).json({ error: error.message });
        }
        if (error.message.includes('Cannot delegate') || error.message.includes('Only the current approver')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
}

// Get delegation history for an approval
export async function getDelegationHistory(req: Request, res: Response) {
    try {
        const approvalId = req.params.approvalId as string;

        const delegations = await prisma.approvalDelegation.findMany({
            where: { approvalId },
            include: {
                fromUser: { select: { id: true, firstName: true, lastName: true, email: true } },
                toUser: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json(delegations);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

// Get reminder history for an approval
export async function getReminderHistory(req: Request, res: Response) {
    try {
        const approvalId = req.params.approvalId as string;

        const reminders = await prisma.approvalReminder.findMany({
            where: { approvalId },
            include: {
                recipient: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
            orderBy: { sentAt: 'desc' },
        });

        res.json(reminders);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}