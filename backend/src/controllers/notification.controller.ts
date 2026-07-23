import { Response } from 'express';
import { asyncHandler, AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { addClient, removeClient } from '../utils/sseClients';

import prisma from '../utils/prisma';

class NotificationController {
    getNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { page = '1', limit = '20' } = req.query;

        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const skip = (pageNum - 1) * limitNum;

        const [notifications, total] = await Promise.all([
            prisma.notification.findMany({
                where: { userId: req.user!.id, channel: 'IN_APP' },
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.notification.count({
                where: { userId: req.user!.id, channel: 'IN_APP' },
            }),
        ]);

        res.json({
            status: 'success',
            data: {
                notifications,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum),
                },
            },
        });
    });

    getUnreadCount = asyncHandler(async (req: AuthRequest, res: Response) => {
        const count = await prisma.notification.count({
            where: {
                userId: req.user!.id,
                channel: 'IN_APP',
                readAt: null,
            },
        });

        res.json({
            status: 'success',
            data: { count },
        });
    });

    getNotificationsAfter = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { cursor, limit = '50' } = req.query;
        const limitNum = Math.min(parseInt(limit as string, 10) || 50, 100);

        let cursorCreatedAt: Date | null = null;
        if (cursor) {
            const cursorNotification = await prisma.notification.findFirst({
                where: {
                    id: String(cursor),
                    userId: req.user!.id,
                    channel: 'IN_APP',
                },
                select: { createdAt: true },
            });
            cursorCreatedAt = cursorNotification?.createdAt ?? null;
        }

        const notifications = await prisma.notification.findMany({
            where: {
                userId: req.user!.id,
                channel: 'IN_APP',
                ...(cursorCreatedAt ? { createdAt: { gt: cursorCreatedAt } } : {}),
            },
            orderBy: { createdAt: 'asc' },
            take: limitNum,
        });

        res.json({
            status: 'success',
            data: {
                notifications,
                cursor: notifications.at(-1)?.id ?? (cursor ? String(cursor) : null),
            },
        });
    });

    // P01-17: Verify ownership before marking as read
    markAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.id);

        // Verify the notification belongs to the requesting user
        const existing = await prisma.notification.findUnique({ where: { id } });
        if (!existing || existing.userId !== req.user!.id) {
            throw new AppError('Notification not found or access denied', 404);
        }

        const notification = await prisma.notification.update({
            where: { id },
            data: { readAt: new Date() },
        });

        res.json({
            status: 'success',
            data: { notification },
        });
    });

    markAllAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
        await prisma.notification.updateMany({
            where: {
                userId: req.user!.id,
                channel: 'IN_APP',
                readAt: null,
            },
            data: { readAt: new Date() },
        });

        res.json({
            status: 'success',
            message: 'All notifications marked as read',
        });
    });

    // P01-18: Verify ownership before deleting
    deleteNotification = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.id);

        // Verify the notification belongs to the requesting user
        const existing = await prisma.notification.findUnique({ where: { id } });
        if (!existing || existing.userId !== req.user!.id) {
            throw new AppError('Notification not found or access denied', 404);
        }

        await prisma.notification.delete({
            where: { id },
        });

        res.json({
            status: 'success',
            message: 'Notification deleted successfully',
        });
    });

    streamNotifications = (req: AuthRequest, res: Response): void => {
        const userId = req.user!.id;

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        // Send a heartbeat every 30 s to keep the connection alive through proxies
        const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 30000);

        addClient(userId, res);

        req.on('close', () => {
            clearInterval(heartbeat);
            removeClient(userId, res);
        });
    };
}

export const notificationController = new NotificationController();
