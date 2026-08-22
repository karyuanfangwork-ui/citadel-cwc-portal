import { Response, NextFunction } from 'express';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { notify } from '../services/notification.service';
import { assertRequestAccess } from '../services/requestAccess.service';
import { auditLog } from '../utils/audit';

import prisma from '../utils/prisma';
import { resolveRequestId } from '../utils/resolve';

class ParticipantController {
    /**
     * GET /api/v1/requests/:id/participants
     * Accessible by users with read access to the request (owner, assignee,
     * team-scoped agent, participant, designated approver, tenant admin).
     *
     * P02-09: Replaced hasRole('ADMIN', 'AGENT') bypass with policy-based
     * assertRequestAccess which enforces tenant boundary and team scope.
     */
    listParticipants = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const idOrRef = String(req.params.id);
        const requestId = await resolveRequestId(idOrRef);
        if (!requestId) throw new AppError('Request not found', 404);

        // P02-09: Use policy-based access check instead of hasRole bypass
        await assertRequestAccess(req.user, requestId);

        const participants = await prisma.requestParticipant.findMany({
            where: { requestId },
            include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
                addedBy: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'asc' },
        });

        res.json({ status: 'success', data: { participants } });
    });

    /**
     * POST /api/v1/requests/:id/participants
     * Body: { userId: string }
     * Allowed: users with manage access (owner, assignee, team-scoped agent, admin).
     *
     * P02-09: Replaced hasRole('ADMIN', 'AGENT') bypass with policy-based check.
     * Adding participants requires 'manage' action authority, not just read.
     */
    addParticipant = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const idOrRef = String(req.params.id);
        const requestId = await resolveRequestId(idOrRef);
        if (!requestId) throw new AppError('Request not found', 404);
        const { userId } = req.body;

        if (!userId || typeof userId !== 'string') {
            throw new AppError('userId is required', 400);
        }

        // P02-09: Use policy-based access check for 'manage' action
        // (covers owner, assignee, team-scoped agent, admin — not generic AGENT)
        const request = await assertRequestAccess(req.user, requestId, { action: 'manage' });

        // Cannot add the requester themselves as a participant
        if (userId === request.requesterId) {
            throw new AppError('The requester is already associated with this request', 400);
        }

        const existing = await prisma.requestParticipant.findFirst({
            where: { requestId, userId, participantRole: 'MANUAL' },
        });
        if (existing) throw new AppError('User is already a participant', 409);

        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, firstName: true, lastName: true, email: true },
        });
        if (!targetUser) throw new AppError('User not found', 404);

        const participant = await prisma.requestParticipant.create({
            data: {
                requestId,
                userId,
                addedById: req.user!.id,
            },
            include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
                addedBy: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        // Notify the new participant
        await notify({
            userId,
            eventType: 'PARTICIPANT_ADDED',
            variables: {
                referenceNumber: request.referenceNumber,
                summary: request.summary,
            },
            relatedRequestId: requestId,
        });

        await auditLog(req, 'PARTICIPANT_ADDED', 'request', requestId, {
            userId,
            referenceNumber: request.referenceNumber,
        }).catch(() => {});

        res.status(201).json({ status: 'success', data: { participant } });
    });

    /**
     * DELETE /api/v1/requests/:id/participants/:userId
     * Allowed: users with manage access (owner, assignee, team-scoped agent, admin).
     *
     * P02-09: Replaced hasRole('ADMIN', 'AGENT') bypass with policy-based check.
     */
    removeParticipant = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const idOrRef = String(req.params.id);
        const requestId = await resolveRequestId(idOrRef);
        if (!requestId) throw new AppError('Request not found', 404);
        const targetUserId = String(req.params.userId);

        // P02-09: Use policy-based access check for 'manage' action
        await assertRequestAccess(req.user, requestId, { action: 'manage' });

        const participant = await prisma.requestParticipant.findFirst({
            where: { requestId, userId: targetUserId },
            select: { id: true },
        });
        if (!participant) {
            throw new AppError('Participant not found', 404);
        }
        await prisma.requestParticipant.delete({ where: { id: participant.id } });

        await auditLog(req, 'PARTICIPANT_REMOVED', 'request', requestId, {
            userId: targetUserId,
        }).catch(() => {});

        res.json({ status: 'success', data: null });
    });
}

export const participantController = new ParticipantController();