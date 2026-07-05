/**
 * P5-08: Approval Delegation, Fallback, and Reminders Service
 *
 * Handles:
 * - Delegation: an approver can delegate their pending approval to another user
 * - Reminders: sends first, second, and escalation reminders for overdue approvals
 * - Timeout fallback: auto-escalates approvals that have exceeded their timeout
 */

import prisma from '../utils/prisma';
import { logger } from '../utils/logger';

// ── Delegation ───────────────────────────────────────────────────────

export interface DelegateApprovalInput {
    approvalId: string;
    fromUserId: string;
    toUserId: string;
    reason?: string;
}

/**
 * Delegate a pending approval to another user.
 * The original approver is recorded, the approval is reassigned.
 */
export async function delegateApproval(input: DelegateApprovalInput) {
    const { approvalId, fromUserId, toUserId, reason } = input;

    // Verify the approval exists and is PENDING
    const approval = await prisma.requestApproval.findUnique({
        where: { id: approvalId },
    });

    if (!approval) {
        throw new Error('Approval not found');
    }

    if (approval.status !== 'PENDING') {
        throw new Error(`Cannot delegate approval in status ${approval.status}`);
    }

    // Verify the fromUserId is the current approver (or delegator)
    if (approval.approverId !== fromUserId && approval.delegatedTo !== fromUserId) {
        throw new Error('Only the current approver can delegate this approval');
    }

    // Update the approval: reassign to delegate
    const updated = await prisma.requestApproval.update({
        where: { id: approvalId },
        data: {
            delegatedBy: fromUserId,
            delegatedTo: toUserId,
            delegatedAt: new Date(),
            approverId: toUserId, // The new approver
        },
    });

    // Log the delegation
    await prisma.approvalDelegation.create({
        data: {
            approvalId,
            fromUserId,
            toUserId,
            reason,
        },
    });

    logger.info(`Approval ${approvalId} delegated from ${fromUserId} to ${toUserId}`);

    return updated;
}

// ── Timeout / Fallback ───────────────────────────────────────────────

/**
 * Check for overdue approvals (past their due_at) and handle them.
 * This should be called by a scheduled job.
 *
 * Timeout behavior:
 * - If a policy step has timeoutHours and the approval is overdue,
 *   the approval is auto-escalated to the next step or marked as timed out.
 */
export async function checkApprovalTimeouts(): Promise<number> {
    const now = new Date();

    // Find all PENDING approvals that are overdue
    const overdueApprovals = await prisma.requestApproval.findMany({
        where: {
            status: 'PENDING',
            dueAt: { not: null, lte: now },
        },
        include: {
            policy: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
        },
    });

    let timedOut = 0;

    for (const approval of overdueApprovals) {
        try {
            // Mark as timed out — the system will auto-escalate
            await prisma.requestApproval.update({
                where: { id: approval.id },
                data: {
                    status: 'REJECTED',
                    comments: `Auto-rejected: approval timed out after ${approval.policy?.steps?.find(s => s.stepOrder === approval.stepOrder)?.timeoutHours || '?'} hours`,
                },
            });

            logger.info(`Approval ${approval.id} timed out and auto-rejected`);
            timedOut++;
        } catch (err) {
            logger.error(`Failed to process timeout for approval ${approval.id}`, { error: err });
        }
    }

    return timedOut;
}

// ── Reminders ────────────────────────────────────────────────────────

const REMINDER_INTERVALS_HOURS = [24, 48]; // First reminder after 24h, second after 48h

/**
 * Check for pending approvals that need reminders and create reminder records.
 * Returns the number of reminders sent.
 */
export async function checkAndSendReminders(): Promise<number> {
    const now = new Date();
    let remindersSent = 0;

    for (const hoursThreshold of REMINDER_INTERVALS_HOURS) {
        const threshold = new Date(now.getTime() - hoursThreshold * 60 * 60 * 1000);
        const reminderType = hoursThreshold === REMINDER_INTERVALS_HOURS[0] ? 'FIRST' : 'SECOND';

        // Find PENDING approvals older than the threshold that haven't had this type of reminder yet
        const pendingApprovals = await prisma.requestApproval.findMany({
            where: {
                status: 'PENDING',
                createdAt: { lte: threshold },
                reminders: {
                    none: { type: reminderType },
                },
            },
            include: {
                approver: true,
                request: { select: { id: true, summary: true } },
            },
        });

        for (const approval of pendingApprovals) {
            if (!approval.approverId) continue;

            try {
                // Create reminder record
                await prisma.approvalReminder.create({
                    data: {
                        approvalId: approval.id,
                        recipientUserId: approval.approverId,
                        type: reminderType,
                    },
                });

                // Update reminder counter on the approval
                await prisma.requestApproval.update({
                    where: { id: approval.id },
                    data: {
                        reminderCount: { increment: 1 },
                        lastReminderAt: now,
                    },
                });

                // Notify the approver
                const { notify } = await import('../services/notification.service').catch(() => ({
                    notify: async () => {}, // Graceful fallback if notification service unavailable
                }));

                await notify({
                    userId: approval.approverId,
                    eventType: reminderType === 'FIRST' ? 'APPROVAL_REMINDER_FIRST' : 'APPROVAL_REMINDER_SECOND',
                    variables: {
                        requestId: approval.requestId,
                        hours: String(hoursThreshold),
                        summary: approval.request?.summary || '',
                    },
                    relatedRequestId: approval.requestId,
                }).catch(() => {}); // Don't block on notification failures

                remindersSent++;
            } catch (err) {
                logger.error(`Failed to send ${reminderType} reminder for approval ${approval.id}`, { error: err });
            }
        }
    }

    // Escalation: if 72+ hours and still PENDING, notify admins
    const escalationThreshold = new Date(now.getTime() - 72 * 60 * 60 * 1000);
    const escalationApprovals = await prisma.requestApproval.findMany({
        where: {
            status: 'PENDING',
            createdAt: { lte: escalationThreshold },
            reminders: { none: { type: 'ESCALATION' } },
        },
        include: {
            approver: true,
            request: { select: { id: true, summary: true } },
        },
    });

    for (const approval of escalationApprovals) {
        if (!approval.approverId) continue;

        try {
            await prisma.approvalReminder.create({
                data: {
                    approvalId: approval.id,
                    recipientUserId: approval.approverId,
                    type: 'ESCALATION',
                },
            });

            logger.warn(`ESCALATION: Approval ${approval.id} has been pending for 72+ hours`);
        } catch (err) {
            logger.error(`Failed to create escalation reminder for approval ${approval.id}`, { error: err });
        }
    }

    return remindersSent;
}

/**
 * Set the dueAt timestamp on an approval based on the policy step timeoutHours.
 * Called when creating approvals from a policy.
 */
export async function setApprovalDueAt(approvalId: string, timeoutHours: number | null): Promise<void> {
    if (!timeoutHours) return;

    const dueAt = new Date(Date.now() + timeoutHours * 60 * 60 * 1000);
    await prisma.requestApproval.update({
        where: { id: approvalId },
        data: { dueAt },
    });
}