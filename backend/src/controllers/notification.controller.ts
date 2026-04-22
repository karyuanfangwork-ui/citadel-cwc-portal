import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { addClient, removeClient } from '../utils/sseClients';

const prisma = new PrismaClient();

class NotificationController {
    getNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { page = '1', limit = '20' } = req.query;

        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const skip = (pageNum - 1) * limitNum;

        const [notifications, total] = await Promise.all([
            prisma.notification.findMany({
                where: { userId: req.user!.id },
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.notification.count({
                where: { userId: req.user!.id },
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
                readAt: null,
            },
        });

        res.json({
            status: 'success',
            data: { count },
        });
    });

    markAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;

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
                readAt: null,
            },
            data: { readAt: new Date() },
        });

        res.json({
            status: 'success',
            message: 'All notifications marked as read',
        });
    });

    deleteNotification = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;

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
