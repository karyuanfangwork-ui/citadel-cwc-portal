import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const prisma = new PrismaClient();

/**
 * Get audit logs for confidential request access
 * GET /admin/audit-logs?page=1&limit=20&action=CONFIDENTIAL_VIEW&resourceId=uuid&userId=uuid
 */
export const getConfidentialAccessLogs = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const {
        page = '1',
        limit = '20',
        action,
        resourceId,
        userId,
        startDate,
        endDate,
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Build filter — only show confidential-related actions
    const where: any = {
        action: { in: ['CONFIDENTIAL_VIEW', 'CONFIDENTIAL_RESUME_ACCESS', 'CONFIDENTIAL_ATTACHMENT_DOWNLOAD'] },
    };

    if (action) {
        where.action = action;
    }
    if (resourceId) {
        where.resourceId = resourceId as string;
    }
    if (userId) {
        where.userId = userId as string;
    }
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            include: {
                user: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limitNum,
        }),
        prisma.auditLog.count({ where }),
    ]);

    res.json({
        status: 'success',
        data: {
            logs,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        },
    });
});

export const auditLogController = {
    getConfidentialAccessLogs,
};