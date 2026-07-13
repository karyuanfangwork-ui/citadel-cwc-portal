import { Request, Response } from 'express';
import { notify } from '../services/notification.service';
import { auditLog } from '../utils/audit';
import { transitionRequest } from '../services/requestTransition.service';
import prisma from '../utils/prisma';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** SystemSetting key for the GROUP_DCEO approval threshold (numeric value in local currency). */
const GROUP_DCEO_THRESHOLD_KEY = 'esm_group_dceo_threshold';
const DEFAULT_THRESHOLD = 50000; // Default threshold if not configured

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
function transitionOpts(req: Request, overrides?: { comment?: string; skipNotifications?: boolean; source?: string; metadata?: Record<string, unknown> }) {
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
    };
}

/**
 * Get the GROUP_DCEO approval threshold from SystemSetting.
 * Falls back to DEFAULT_THRESHOLD if not configured.
 */
async function getGroupDceoThreshold(): Promise<number> {
    const setting = await prisma.systemSetting.findUnique({
        where: { key: GROUP_DCEO_THRESHOLD_KEY },
    });
    if (!setting) return DEFAULT_THRESHOLD;
    const parsed = parseFloat(setting.value);
    return isNaN(parsed) ? DEFAULT_THRESHOLD : parsed;
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

        // Transition: SUBMITTED → PENDING_CEO_APPROVAL
        await transitionRequest(id, 'PENDING_CEO_APPROVAL', transitionOpts(req, {
            comment: notes || 'Submitted for CEO approval',
            source: 'esm-workflow/submit-for-ceo',
        }));

        // Find and assign CEO
        const ceoId = await findCeoForRequest(request.requesterId);
        if (ceoId) {
            await prisma.request.update({ where: { id }, data: { assignedToId: ceoId } });

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
 * POST /esm-workflow/requests/:id/ceo-decision
 *
 * CEO approves or rejects a travel request.
 * On approval: checks totalAmount against threshold → routes to GROUP_DCEO or directly to ACTION_REQUIRED.
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

        if (decision === 'REJECTED') {
            // PENDING_CEO_APPROVAL → CEO_REJECTED → REJECTED (terminal)
            await transitionRequest(id, 'CEO_REJECTED', transitionOpts(req, {
                comment: comments || 'CEO rejected the travel request',
                source: 'esm-workflow/ceo-reject',
            }));
            await transitionRequest(id, 'REJECTED', transitionOpts(req, {
                comment: comments || 'Travel request rejected',
                source: 'esm-workflow/ceo-reject-terminal',
            }));

            // Update approval record
            if (pendingCeoApproval) {
                await prisma.requestApproval.update({
                    where: { id: pendingCeoApproval.id },
                    data: { status: 'REJECTED', approverId: userId, comments: comments || null },
                });
            }

            // Reassign back to requester for visibility
            await prisma.request.update({ where: { id }, data: { assignedToId: request.requesterId } });

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
        // Check totalAmount against threshold
        const customFields = (request.customFields as Record<string, unknown>) || {};
        const totalAmount = parseFloat(String(customFields.totalAmount ?? '0'));
        const threshold = await getGroupDceoThreshold();
        const exceedsThreshold = !isNaN(totalAmount) && totalAmount > threshold;

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

        if (exceedsThreshold) {
            // CEO_APPROVED → PENDING_GROUP_DCEO_APPROVAL
            await transitionRequest(id, 'CEO_APPROVED', transitionOpts(req, {
                comment: comments || `CEO approved — amount exceeds threshold (MYR ${totalAmount} > MYR ${threshold}), routed to Group Deputy CEO`,
                source: 'esm-workflow/ceo-approve-dceo',
            }));
            await transitionRequest(id, 'PENDING_GROUP_DCEO_APPROVAL', transitionOpts(req, {
                source: 'esm-workflow/ceo-approve-dceo',
            }));

            // Find and assign GROUP_DCEO
            const groupDceoId = await findGroupDceo();
            if (groupDceoId) {
                await prisma.request.update({ where: { id }, data: { assignedToId: groupDceoId } });

                await prisma.requestApproval.create({
                    data: { requestId: id, approverType: 'GROUP_DCEO', approverId: groupDceoId, status: 'PENDING', comments: null },
                });

                await notify({ userId: groupDceoId, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'Group Deputy CEO' }, relatedRequestId: id });
            }

            await logActivity(id, `CEO approved — amount MYR ${totalAmount} exceeds threshold MYR ${threshold}, routed to Group Deputy CEO${comments ? ': ' + comments : ''}`, userId);

            // SLA stays paused during DCEO approval
        } else {
            // CEO_APPROVED → ACTION_REQUIRED (below threshold — skip DCEO)
            await transitionRequest(id, 'CEO_APPROVED', transitionOpts(req, {
                comment: comments || 'CEO approved — amount within threshold, no Group Deputy CEO approval required',
                source: 'esm-workflow/ceo-approve-direct',
            }));
            await transitionRequest(id, 'ACTION_REQUIRED', transitionOpts(req, {
                source: 'esm-workflow/ceo-approve-direct',
            }));

            // Reassign back to requester for booking confirmation
            await prisma.request.update({ where: { id }, data: { assignedToId: request.requesterId } });

            await logActivity(id, `CEO approved — amount MYR ${totalAmount} within threshold MYR ${threshold}. Awaiting booking confirmation${comments ? ': ' + comments : ''}`, userId);

            const { resumeSla } = await import('../services/sla-pause.service');
            await resumeSla(id);
        }

        await notify({ userId: request.requesterId, eventType: 'STATUS_CHANGED', variables: { referenceNumber: request.referenceNumber, newStatus: exceedsThreshold ? 'PENDING_GROUP_DCEO_APPROVAL' : 'ACTION_REQUIRED' }, relatedRequestId: id });

        await auditLog(req as any, 'ESM_CEO_DECISION', 'request', id, {
            decision,
            approverType: 'CEO',
            newStatus: exceedsThreshold ? 'PENDING_GROUP_DCEO_APPROVAL' : 'ACTION_REQUIRED',
            previousStatus: request.status,
            totalAmount,
            threshold,
            exceedsThreshold,
            comments: comments || null,
        }, { status: request.status });

        res.json({
            status: 'success',
            message: exceedsThreshold
                ? `CEO approved — amount exceeds MYR ${threshold} threshold, routed to Group Deputy CEO`
                : `CEO approved — amount within MYR ${threshold} threshold, awaiting booking confirmation`,
            data: { exceedsThreshold, totalAmount, threshold },
        });
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
 * Approved → ACTION_REQUIRED (reassign to requester for booking confirmation).
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
            }));

            if (pendingApproval) {
                await prisma.requestApproval.update({
                    where: { id: pendingApproval.id },
                    data: { status: 'REJECTED', approverId: userId, comments: comments || null },
                });
            }

            // Reassign back to requester
            await prisma.request.update({ where: { id }, data: { assignedToId: request.requesterId } });

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
        // PENDING_GROUP_DCEO_APPROVAL → GROUP_DCEO_APPROVED → ACTION_REQUIRED
        await transitionRequest(id, 'GROUP_DCEO_APPROVED', transitionOpts(req, {
            comment: comments || undefined,
            source: 'esm-workflow/group-dceo-approve',
        }));
        await transitionRequest(id, 'ACTION_REQUIRED', transitionOpts(req, {
            source: 'esm-workflow/group-dceo-approve',
        }));

        if (pendingApproval) {
            await prisma.requestApproval.update({
                where: { id: pendingApproval.id },
                data: { status: 'APPROVED', approverId: userId, comments: comments || null },
            });
        }

        // Reassign back to requester for booking confirmation
        await prisma.request.update({ where: { id }, data: { assignedToId: request.requesterId } });

        await logActivity(id, `Group Deputy CEO approved — awaiting booking confirmation from requester${comments ? ': ' + comments : ''}`, userId);
        await notify({ userId: request.requesterId, eventType: 'STATUS_CHANGED', variables: { referenceNumber: request.referenceNumber, newStatus: 'ACTION_REQUIRED' }, relatedRequestId: id });

        const { resumeSla } = await import('../services/sla-pause.service');
        await resumeSla(id);

        await auditLog(req as any, 'ESM_GROUP_DCEO_DECISION', 'request', id, {
            decision,
            approverType: 'GROUP_DCEO',
            newStatus: 'ACTION_REQUIRED',
            previousStatus: request.status,
            comments: comments || null,
        }, { status: request.status });

        res.json({ status: 'success', message: 'Travel request approved by Group Deputy CEO — awaiting booking confirmation' });
    } catch (error: any) {
        console.error('groupDceoDecision error:', error);
        if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Failed to process Group Deputy CEO decision' });
    }
};

/**
 * POST /esm-workflow/requests/:id/confirm-booking
 *
 * Requester confirms their booking is completed.
 * ACTION_REQUIRED → COMPLETED
 */
export const confirmBooking = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const userId = (req as any).user?.id;
        const { notes } = req.body;

        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (request.status !== 'ACTION_REQUIRED') {
            res.status(400).json({ status: 'error', message: 'Request must be in ACTION_REQUIRED status to confirm booking' });
            return;
        }

        // Verify the requester is the one confirming
        if (request.requesterId !== userId) {
            res.status(403).json({ status: 'error', message: 'Only the requester can confirm the booking' });
            return;
        }

        // ACTION_REQUIRED → COMPLETED
        await transitionRequest(id, 'COMPLETED', transitionOpts(req, {
            comment: notes || 'Booking confirmed by requester',
            source: 'esm-workflow/confirm-booking',
        }));

        await logActivity(id, `Booking confirmed by requester${notes ? ': ' + notes : ''}`, userId);

        await notify({ userId: request.requesterId, eventType: 'STATUS_CHANGED', variables: { referenceNumber: request.referenceNumber, newStatus: 'COMPLETED' }, relatedRequestId: id });

        await auditLog(req as any, 'ESM_BOOKING_CONFIRMED', 'request', id, {
            newStatus: 'COMPLETED',
            previousStatus: request.status,
            notes: notes || null,
        }, { status: request.status });

        res.json({ status: 'success', message: 'Booking confirmed — travel request marked as completed' });
    } catch (error: any) {
        console.error('confirmBooking error:', error);
        if (error.message?.includes('Transition guard blocked') || error.message?.includes('Invalid status transition')) {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Failed to confirm booking' });
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