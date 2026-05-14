import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { AuthRequest, hasRole } from '../middleware/auth.middleware';
import { notify } from '../services/notification.service';

const prisma = new PrismaClient();

class ParticipantController {
    /**
     * GET /api/v1/requests/:id/participants
     * Accessible by requester, agents, admins, and existing participants.
     */
    listParticipants = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const requestId = String(req.params.id);

        const request = await prisma.request.findUnique({
            where: { id: requestId },
            select: { id: true, requesterId: true },
        });
        if (!request) throw new AppError('Request not found', 404);

        const isParticipant = !!(await prisma.requestParticipant.findUnique({
            where: { requestId_userId: { requestId, userId: req.user!.id } },
        }));

        if (
            request.requesterId !== req.user!.id &&
            !hasRole(req, 'ADMIN', 'AGENT') &&
            !isParticipant
        ) {
            throw new AppError('Forbidden', 403);
        }

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
     * Allowed: requester, agents, admins.
     */
    addParticipant = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const requestId = String(req.params.id);
        const { userId } = req.body;

        if (!userId || typeof userId !== 'string') {
            throw new AppError('userId is required', 400);
        }

        const request = await prisma.request.findUnique({
            where: { id: requestId },
            select: { id: true, requesterId: true, referenceNumber: true, summary: true },
        });
        if (!request) throw new AppError('Request not found', 404);

        if (
            request.requesterId !== req.user!.id &&
            !hasRole(req, 'ADMIN', 'AGENT')
        ) {
            throw new AppError('Only the requester or an agent/admin can add participants', 403);
        }

        // Cannot add the requester themselves as a participant
        if (userId === request.requesterId) {
            throw new AppError('The requester is already associated with this request', 400);
        }

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

        res.status(201).json({ status: 'success', data: { participant } });
    });

    /**
     * DELETE /api/v1/requests/:id/participants/:userId
     * Allowed: requester, agents, admins.
     */
    removeParticipant = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const requestId = String(req.params.id);
        const targetUserId = String(req.params.userId);

        const request = await prisma.request.findUnique({
            where: { id: requestId },
            select: { id: true, requesterId: true },
        });
        if (!request) throw new AppError('Request not found', 404);

        if (
            request.requesterId !== req.user!.id &&
            !hasRole(req, 'ADMIN', 'AGENT')
        ) {
            throw new AppError('Only the requester or an agent/admin can remove participants', 403);
        }

        await prisma.requestParticipant.delete({
            where: { requestId_userId: { requestId, userId: targetUserId } },
        }).catch(() => {
            throw new AppError('Participant not found', 404);
        });

        res.json({ status: 'success', data: null });
    });
}

export const participantController = new ParticipantController();
