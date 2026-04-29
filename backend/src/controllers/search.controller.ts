import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/error.middleware';
import { AuthRequest, hasRole } from '../middleware/auth.middleware';

const prisma = new PrismaClient();

class SearchController {
    globalSearch = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { q, limit = '10' } = req.query;

        if (!q) {
            return res.json({
                status: 'success',
                data: {
                    requests: [],
                    articles: [],
                    users: [],
                },
            });
        }

        const searchTerm = q as string;
        const limitNum = parseInt(limit as string, 10);

        // Confidentiality gate: exclude confidential requests for unauthorized users
        const canSeeConfidential = hasRole(req, 'ADMIN') || req.user?.permissions?.includes('request:confidential');

        // Search across multiple resources
        const [requests, articles, users] = await Promise.all([
            // Search requests — apply confidentiality filter
            prisma.request.findMany({
                where: {
                    deletedAt: null,
                    ...(canSeeConfidential
                        ? {
                            OR: [
                                { referenceNumber: { contains: searchTerm, mode: 'insensitive' } },
                                { summary: { contains: searchTerm, mode: 'insensitive' } },
                                { description: { contains: searchTerm, mode: 'insensitive' } },
                            ],
                        }
                        : {
                            AND: [
                                {
                                    OR: [
                                        { isConfidential: false },
                                        { requesterId: req.user!.id },
                                        { approvals: { some: { approverId: req.user!.id } } },
                                    ],
                                },
                                {
                                    OR: [
                                        { referenceNumber: { contains: searchTerm, mode: 'insensitive' } },
                                        { summary: { contains: searchTerm, mode: 'insensitive' } },
                                        { description: { contains: searchTerm, mode: 'insensitive' } },
                                    ],
                                },
                            ],
                        }
                    ),
                },
                take: limitNum,
                include: {
                    serviceDesk: true,
                },
            }),
            // Search KB articles
            prisma.knowledgeBaseArticle.findMany({
                where: {
                    isPublished: true,
                    deletedAt: null,
                    OR: [
                        { title: { contains: searchTerm, mode: 'insensitive' } },
                        { content: { contains: searchTerm, mode: 'insensitive' } },
                    ],
                },
                take: limitNum,
            }),
            // Search users (admin/agent only)
            req.user!.roles.includes('ADMIN') || req.user!.roles.includes('AGENT')
                ? prisma.user.findMany({
                    where: {
                        isActive: true,
                        OR: [
                            { email: { contains: searchTerm, mode: 'insensitive' } },
                            { firstName: { contains: searchTerm, mode: 'insensitive' } },
                            { lastName: { contains: searchTerm, mode: 'insensitive' } },
                        ],
                    },
                    take: limitNum,
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        department: true,
                    },
                })
                : [],
        ]);

        res.json({
            status: 'success',
            data: {
                requests,
                articles,
                users,
            },
        });
    });

    searchRequests = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { q, page = '1', limit = '10' } = req.query;

        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const skip = (pageNum - 1) * limitNum;

        // Confidentiality gate: exclude confidential requests for unauthorized users
        const canSeeConfidential = hasRole(req, 'ADMIN') || req.user?.permissions?.includes('request:confidential');

        const where: any = {
            deletedAt: null,
        };

        if (!canSeeConfidential) {
            where.OR = [
                { isConfidential: false },
                { requesterId: req.user!.id },
                { approvals: { some: { approverId: req.user!.id } } },
            ];
        }

        if (q) {
            const searchConditions = [
                { referenceNumber: { contains: q as string, mode: 'insensitive' } },
                { summary: { contains: q as string, mode: 'insensitive' } },
                { description: { contains: q as string, mode: 'insensitive' } },
            ];
            // If confidentiality filter already set OR, wrap both with AND
            if (where.OR) {
                where.AND = [
                    { OR: where.OR },
                    { OR: searchConditions },
                ];
                delete where.OR;
            } else {
                where.OR = searchConditions;
            }
        }

        const [requests, total] = await Promise.all([
            prisma.request.findMany({
                where,
                skip,
                take: limitNum,
                include: {
                    serviceDesk: true,
                    requester: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            }),
            prisma.request.count({ where }),
        ]);

        res.json({
            status: 'success',
            data: {
                requests,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum),
                },
            },
        });
    });

    searchArticles = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { q, page = '1', limit = '10' } = req.query;

        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            isPublished: true,
            deletedAt: null,
        };

        if (q) {
            where.OR = [
                { title: { contains: q as string, mode: 'insensitive' } },
                { content: { contains: q as string, mode: 'insensitive' } },
            ];
        }

        const [articles, total] = await Promise.all([
            prisma.knowledgeBaseArticle.findMany({
                where,
                skip,
                take: limitNum,
            }),
            prisma.knowledgeBaseArticle.count({ where }),
        ]);

        res.json({
            status: 'success',
            data: {
                articles,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum),
                },
            },
        });
    });

    searchUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { q, page = '1', limit = '10' } = req.query;

        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            isActive: true,
        };

        if (q) {
            where.OR = [
                { email: { contains: q as string, mode: 'insensitive' } },
                { firstName: { contains: q as string, mode: 'insensitive' } },
                { lastName: { contains: q as string, mode: 'insensitive' } },
            ];
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limitNum,
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    department: true,
                    jobTitle: true,
                },
            }),
            prisma.user.count({ where }),
        ]);

        res.json({
            status: 'success',
            data: {
                users,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum),
                },
            },
        });
    });
}

export const searchController = new SearchController();
