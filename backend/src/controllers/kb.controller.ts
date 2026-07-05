import { Response } from 'express';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

import prisma from '../utils/prisma';
import { sanitizeKBContent, sanitizeString } from '../utils/sanitize';

class KBController {
    getAllArticles = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { page = '1', limit = '10', serviceDeskId, category, search } = req.query;

        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            isPublished: true,
            deletedAt: null,
        };

        if (serviceDeskId) {
            where.serviceDeskId = serviceDeskId;
        }

        if (category) {
            where.category = category;
        }

        if (search) {
            where.OR = [
                { title: { contains: search as string, mode: 'insensitive' } },
                { content: { contains: search as string, mode: 'insensitive' } },
            ];
        }

        const [articles, total] = await Promise.all([
            prisma.knowledgeBaseArticle.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { publishedAt: 'desc' },
                include: {
                    serviceDesk: true,
                    author: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
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

    getArticleBySlug = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { slug } = req.params;

        const article = await prisma.knowledgeBaseArticle.findFirst({
            where: {
                slug: slug as string,
                isPublished: true,
                deletedAt: null,
            },
            include: {
                serviceDesk: true,
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        if (!article) {
            throw new AppError('Article not found', 404);
        }

        // Increment view count
        await prisma.knowledgeBaseArticle.update({
            where: { id: article.id },
            data: { viewCount: { increment: 1 } },
        });

        res.json({
            status: 'success',
            data: { article },
        });
    });

    markHelpful = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.id);
        const { helpful } = req.body;

        const article = await prisma.knowledgeBaseArticle.update({
            where: { id },
            data: {
                ...(helpful
                    ? { helpfulCount: { increment: 1 } }
                    : { notHelpfulCount: { increment: 1 } }),
            },
        });

        res.json({
            status: 'success',
            data: { article },
        });
    });

    createArticle = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { title, slug, content, excerpt, serviceDeskId, category, tags } = req.body;

        // P1-12: Sanitize KB content server-side before persistence
        const article = await prisma.knowledgeBaseArticle.create({
            data: {
                title: sanitizeString(title),
                slug,
                content: sanitizeKBContent(content),
                excerpt: excerpt ? sanitizeString(excerpt) : undefined,
                serviceDeskId,
                category,
                tags,
                authorId: req.user!.id,
            },
        });

        res.status(201).json({
            status: 'success',
            data: { article },
        });
    });

    updateArticle = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.id);
        const { title, slug, content, excerpt, category, tags } = req.body;

        // P1-12: Sanitize KB content server-side before persistence
        const data: Record<string, unknown> = {};
        if (title !== undefined) data.title = sanitizeString(title);
        if (slug !== undefined) data.slug = slug;
        if (content !== undefined) data.content = sanitizeKBContent(content);
        if (excerpt !== undefined) data.excerpt = excerpt ? sanitizeString(excerpt) : null;
        if (category !== undefined) data.category = category;
        if (tags !== undefined) data.tags = tags;

        const article = await prisma.knowledgeBaseArticle.update({
            where: { id },
            data,
        });

        res.json({
            status: 'success',
            data: { article },
        });
    });

    deleteArticle = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.id);

        await prisma.knowledgeBaseArticle.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        res.json({
            status: 'success',
            message: 'Article deleted successfully',
        });
    });

    publishArticle = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.id);

        const article = await prisma.knowledgeBaseArticle.update({
            where: { id },
            data: {
                isPublished: true,
                publishedAt: new Date(),
            },
        });

        res.json({
            status: 'success',
            data: { article },
        });
    });
}

export const kbController = new KBController();
