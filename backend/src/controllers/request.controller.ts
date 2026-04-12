import { Response, NextFunction } from 'express';
import { PrismaClient, RequestStatus } from '@prisma/client';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { notify, notifyMultiple } from '../services/notification.service';

const prisma = new PrismaClient();

class RequestController {
    /**
     * Get all requests with filters and pagination
     */
    getAllRequests = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const {
            page = '1',
            limit = '10',
            status,
            serviceDeskId,
            assignedToId,
            priority,
            search,
        } = req.query;

        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const skip = (pageNum - 1) * limitNum;

        // Build where clause
        const where: any = {
            deletedAt: null,
        };

        // Users can only see their own requests unless they're agents/admins
        // Exception: CEO can see requests in hiring workflow
        if (!req.user!.roles.includes('ADMIN') && !req.user!.roles.includes('AGENT')) {
            if (req.user!.roles.includes('CEO')) {
                // CEO can see:
                // 1. Requests they created
                // 2. Requests in hiring workflow (any status)
                const ceoHiringStatuses = ['PENDING_CEO_APPROVAL', 'CEO_APPROVED', 'CEO_REJECTED', 'JOB_POSTED', 'PENDING_MANAGER_REVIEW', 'MANAGER_APPROVED'];
                where.OR = [
                    { requesterId: req.user!.id },
                    { status: { in: ceoHiringStatuses } }
                ];
            } else {
                // Regular users only see their own requests
                where.requesterId = req.user!.id;
            }
        }

        if (status) {
            where.status = status;
        }

        if (serviceDeskId) {
            where.serviceDeskId = serviceDeskId;
        }

        if (assignedToId) {
            where.assignedToId = assignedToId;
        }

        if (priority) {
            where.priority = priority;
        }

        if (search) {
            where.OR = [
                { referenceNumber: { contains: search as string, mode: 'insensitive' } },
                { summary: { contains: search as string, mode: 'insensitive' } },
                { description: { contains: search as string, mode: 'insensitive' } },
            ];
        }

        // Get requests and total count
        const [requests, total] = await Promise.all([
            prisma.request.findMany({
                where,
                skip,
                take: limitNum,
                include: {
                    requester: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                        },
                    },
                    assignedTo: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                        },
                    },
                    serviceDesk: true,
                    requestType: true,
                },
                orderBy: {
                    createdAt: 'desc',
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

    /**
     * Create a new request
     */
    createRequest = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const {
            requestTypeId,
            serviceDeskId,
            summary,
            description,
            priority,
            customFields,
        } = req.body;

        // Generate reference number
        const serviceDesk = await prisma.serviceDesk.findUnique({
            where: { id: serviceDeskId },
        });

        if (!serviceDesk) {
            throw new AppError('Service desk not found', 404);
        }

        // Get count for reference number
        const count = await prisma.request.count({
            where: { serviceDeskId },
        });

        const referenceNumber = `${serviceDesk.code}-${count + 1}`;

        // Calculate SLA due date from request type
        let slaDueAt: Date | undefined;
        if (requestTypeId) {
          const requestType = await prisma.requestType.findUnique({ where: { id: requestTypeId } });
          if (requestType?.slaHours) {
            slaDueAt = new Date();
            slaDueAt.setHours(slaDueAt.getHours() + requestType.slaHours);
          }
        }

        // Create request
        const request = await prisma.request.create({
            data: {
                referenceNumber,
                requestTypeId,
                serviceDeskId,
                requesterId: req.user!.id,
                requesterEmail: req.user!.email,
                summary,
                description,
                priority,
                customFields,
                status: 'SUBMITTED',
                slaDueAt,
            },
            include: {
                requester: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                serviceDesk: true,
                requestType: true,
            },
        });

        // Create initial activity
        await prisma.requestActivity.create({
            data: {
                requestId: request.id,
                authorId: req.user!.id,
                authorName: 'System',
                activityType: 'SYSTEM',
                message: 'Request created',
                isSystemGenerated: true,
            },
        });

        // Notify requester
        await notify({
            userId: request.requesterId,
            eventType: 'REQUEST_CREATED',
            variables: {
                referenceNumber: request.referenceNumber,
                summary: request.summary,
            },
            relatedRequestId: request.id,
        });

        // Notify all admins
        const admins = await prisma.user.findMany({
            where: { roles: { some: { role: { name: 'ADMIN' } } } },
            select: { id: true },
        });
        await notifyMultiple(
            admins.map((a) => a.id),
            'REQUEST_CREATED',
            { referenceNumber: request.referenceNumber, summary: request.summary },
            request.id
        );

        res.status(201).json({
            status: 'success',
            data: { request },
        });
    });

    /**
     * Get request by ID
     */
    getRequestById = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const { id } = req.params;

        const request = await prisma.request.findFirst({
            where: {
                id,
                deletedAt: null,
            },
            include: {
                requester: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatarUrl: true,
                    },
                },
                assignedTo: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                serviceDesk: true,
                requestType: true,
                activities: {
                    orderBy: {
                        createdAt: 'asc',
                    },
                },
                attachments: {
                    where: {
                        deletedAt: null,
                    },
                },
                candidateResumes: {
                    include: {
                        uploadedBy: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                },
            },
        });

        if (!request) {
            throw new AppError('Request not found', 404);
        }

        // Transform BigInt to string in candidateResumes for JSON serialization
        if (request.candidateResumes) {
            (request as any).candidateResumes = request.candidateResumes.map(resume => ({
                ...resume,
                fileSize: resume.fileSize.toString(),
            }));
        }

        // Check permissions
        // Allow access if:
        // 1. User is the requester
        // 2. User is ADMIN or AGENT
        // 3. User is CEO and request is in hiring workflow
        const ceoHiringStatuses = ['PENDING_CEO_APPROVAL', 'CEO_APPROVED', 'CEO_REJECTED', 'JOB_POSTED', 'PENDING_MANAGER_REVIEW', 'MANAGER_APPROVED'];
        const isCEOViewingPendingApproval =
            req.user!.roles.includes('CEO') && ceoHiringStatuses.includes(request.status);

        if (
            request.requesterId !== req.user!.id &&
            !req.user!.roles.includes('ADMIN') &&
            !req.user!.roles.includes('AGENT') &&
            !isCEOViewingPendingApproval
        ) {
            throw new AppError('You do not have permission to view this request', 403);
        }

        res.json({
            status: 'success',
            data: { request },
        });
    });

    /**
     * Update request
     */
    updateRequest = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const { summary, description, priority } = req.body;

        const existingRequest = await prisma.request.findFirst({
            where: { id, deletedAt: null },
        });

        if (!existingRequest) {
            throw new AppError('Request not found', 404);
        }

        // Check permissions
        if (
            existingRequest.requesterId !== req.user!.id &&
            !req.user!.roles.includes('ADMIN') &&
            !req.user!.roles.includes('AGENT')
        ) {
            throw new AppError('You do not have permission to update this request', 403);
        }

        const request = await prisma.request.update({
            where: { id },
            data: {
                summary,
                description,
                priority,
            },
        });

        res.json({
            status: 'success',
            data: { request },
        });
    });

    /**
     * Delete request (soft delete)
     */
    deleteRequest = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const { id } = req.params;

        const request = await prisma.request.findFirst({
            where: { id, deletedAt: null },
        });

        if (!request) {
            throw new AppError('Request not found', 404);
        }

        // Only requester or admin can delete
        if (request.requesterId !== req.user!.id && !req.user!.roles.includes('ADMIN')) {
            throw new AppError('You do not have permission to delete this request', 403);
        }

        await prisma.request.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        res.json({
            status: 'success',
            message: 'Request deleted successfully',
        });
    });

    /**
     * Get request activities
     */
    getRequestActivities = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const { id } = req.params;

        const request = await prisma.request.findFirst({
            where: { id, deletedAt: null },
        });

        if (!request) {
            throw new AppError('Request not found', 404);
        }

        const activities = await prisma.requestActivity.findMany({
            where: { requestId: id },
            orderBy: { createdAt: 'asc' },
        });

        // Filter internal activities for non-agent/admin users
        const userRoles = req.user!.roles || [];
        const isAgentOrAdmin = userRoles.includes('ADMIN') || userRoles.includes('AGENT');
        const filteredActivities = isAgentOrAdmin
          ? activities
          : activities.filter((a: any) => !a.isInternal);

        res.json({
            status: 'success',
            data: { activities: filteredActivities },
        });
    });

    /**
     * Add activity/comment to request
     */
    addActivity = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const { message, isInternal } = req.body;

        const request = await prisma.request.findFirst({
            where: { id, deletedAt: null },
        });

        if (!request) {
            throw new AppError('Request not found', 404);
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
        });

        const activity = await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: req.user!.id,
                authorName: `${user!.firstName} ${user!.lastName}`,
                authorAvatarUrl: user!.avatarUrl,
                activityType: 'COMMENT',
                message,
                isInternal: isInternal || false,
            },
        });

        // Notify request owner about new comment
        if (request.requesterId !== req.user!.id) {
            await notify({
                userId: request.requesterId,
                eventType: 'COMMENT_ADDED',
                variables: { referenceNumber: request.referenceNumber },
                relatedRequestId: id,
            });
        }
        // Also notify assigned agent if they didn't write the comment
        if (request.assignedToId && request.assignedToId !== req.user!.id) {
            await notify({
                userId: request.assignedToId,
                eventType: 'COMMENT_ADDED',
                variables: { referenceNumber: request.referenceNumber },
                relatedRequestId: id,
            });
        }

        res.status(201).json({
            status: 'success',
            data: { activity },
        });
    });

    /**
     * Upload attachment (placeholder)
     */
    uploadAttachment = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const { id } = req.params;

        // TODO: Implement file upload with multer and S3
        res.json({
            status: 'success',
            message: 'File upload endpoint - to be implemented',
        });
    });

    /**
     * Download attachment (placeholder)
     */
    downloadAttachment = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const { id, attachmentId } = req.params;

        // TODO: Implement file download from S3
        res.json({
            status: 'success',
            message: 'File download endpoint - to be implemented',
        });
    });

    /**
     * Delete attachment
     */
    deleteAttachment = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const { id, attachmentId } = req.params;

        await prisma.requestAttachment.update({
            where: { id: attachmentId },
            data: { deletedAt: new Date() },
        });

        res.json({
            status: 'success',
            message: 'Attachment deleted successfully',
        });
    });

    /**
     * Assign request to agent
     */
    assignRequest = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const { assignedToId } = req.body;

        const request = await prisma.request.update({
            where: { id },
            data: { assignedToId },
            include: {
                requester: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatarUrl: true,
                    },
                },
                assignedTo: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                serviceDesk: true,
                requestType: true,
            },
        });

        // Create activity
        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: req.user!.id,
                authorName: 'System',
                activityType: 'ASSIGNMENT',
                message: `Request assigned to agent`,
                isSystemGenerated: true,
            },
        });

        // Notify the assigned agent
        await notify({
            userId: assignedToId,
            eventType: 'REQUEST_ASSIGNED',
            variables: {
                referenceNumber: request.referenceNumber,
                summary: request.summary,
            },
            relatedRequestId: request.id,
        });

        res.json({
            status: 'success',
            data: { request },
        });
    });

    /**
     * Update request status
     */
    updateStatus = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const { status } = req.body;

        const request = await prisma.request.update({
            where: { id },
            data: { status: status as RequestStatus },
            include: {
                requester: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatarUrl: true,
                    },
                },
                assignedTo: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                serviceDesk: true,
                requestType: true,
            },
        });

        // Create activity
        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: req.user!.id,
                authorName: 'System',
                activityType: 'STATUS_CHANGE',
                message: `Status changed to ${status}`,
                isSystemGenerated: true,
                metadata: { newStatus: status },
            },
        });

        // Notify requester of status change
        await notify({
            userId: request.requesterId,
            eventType: 'STATUS_CHANGED',
            variables: {
                referenceNumber: request.referenceNumber,
                newStatus: status,
            },
            relatedRequestId: request.id,
        });

        res.json({
            status: 'success',
            data: { request },
        });
    });
}

export const requestController = new RequestController();
