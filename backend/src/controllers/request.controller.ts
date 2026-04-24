import { Response, NextFunction } from 'express';
import { PrismaClient, RequestStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { AuthRequest, hasRole } from '../middleware/auth.middleware';
import { notify, notifyMultiple } from '../services/notification.service';
import { createDefaultOnboardingTasks } from '../services/onboarding.service';
import { sanitizeString, sanitizeComment } from '../utils/sanitize';
import { auditLog } from '../utils/audit';
import { logger } from '../utils/logger';

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
            requestTypeId,
            requesterId,
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
        if (!hasRole(req, 'ADMIN', 'AGENT')) {
            if (hasRole(req, 'CEO')) {
                // CEO can see their own requests, hiring workflow requests, IT approval requests, and any request where they are a designated approver
                const ceoHiringStatuses = ['PENDING_CEO_APPROVAL', 'CEO_APPROVED', 'CEO_REJECTED', 'JOB_POSTED', 'PENDING_MANAGER_REVIEW', 'MANAGER_APPROVED'];
                where.OR = [
                    { requesterId: req.user!.id },
                    { status: { in: ceoHiringStatuses } },
                    { status: 'PENDING_CEO_APPROVAL_IT' },
                    { approvals: { some: { approverId: req.user!.id } } },
                ];
            } else if (hasRole(req, 'CTO')) {
                // CTO can see their own requests and any IT request pending CTO approval
                where.OR = [
                    { requesterId: req.user!.id },
                    { status: 'PENDING_CTO_APPROVAL_IT' },
                    { approvals: { some: { approverId: req.user!.id } } },
                ];
            } else if (hasRole(req, 'CFO')) {
                // CFO can see their own requests, IT requests pending CFO approval, and Finance Purchase Requisitions pending CFO approval
                where.OR = [
                    { requesterId: req.user!.id },
                    { status: 'PENDING_CFO_APPROVAL_IT' },
                    { status: 'PENDING_CFO_APPROVAL_FIN' },
                    { approvals: { some: { approverId: req.user!.id } } },
                ];
            } else if (hasRole(req, 'GROUP_CEO')) {
                // GROUP_CEO can see their own requests and Finance Purchase Requisitions pending Group CEO approval
                where.OR = [
                    { requesterId: req.user!.id },
                    { status: 'PENDING_GROUP_CEO_APPROVAL' },
                    { approvals: { some: { approverId: req.user!.id } } },
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
            // Handle special 'none' value meaning unassigned
            where.assignedToId = assignedToId === 'none' ? null : assignedToId;
        }

        if (priority) {
            where.priority = priority;
        }

        if (requestTypeId) {
            where.requestTypeId = requestTypeId as string;
        }

        // Filter by requester (for "My Requests" page)
        if (requesterId) {
            where.requesterId = requesterId as string;
        }

        if (search) {
            const searchConditions = [
                { referenceNumber: { contains: search as string, mode: 'insensitive' } },
                { summary: { contains: search as string, mode: 'insensitive' } },
                { description: { contains: search as string, mode: 'insensitive' } },
            ];
            // Preserve existing OR conditions (e.g. CEO visibility) by wrapping with AND
            if (where.OR) {
                where.AND = [{ OR: where.OR }, { OR: searchConditions }];
                delete where.OR;
            } else {
                where.OR = searchConditions;
            }
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
            summary: rawSummary,
            description: rawDescription,
            priority,
            customFields,
        } = req.body;

        // Sanitize highest-risk text fields before storing
        const summary = sanitizeString(rawSummary);
        const description = rawDescription ? sanitizeComment(rawDescription) : undefined;

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

        // Detect manual onboarding/offboarding/finance submission
        const requestType = requestTypeId
            ? await prisma.requestType.findUnique({ where: { id: requestTypeId } })
            : null;
        const isManualOnboarding = requestType?.code === 'EMPLOYEE_ONBOARDING';
        const isManualOffboarding = requestType?.code === 'EMPLOYEE_OFFBOARDING';
        const isPurchaseRequisition = requestType?.code === 'PURCHASE_REQUISITION';
        const initialStatus = isManualOnboarding
            ? 'ONBOARDING_SUBMITTED'
            : isManualOffboarding
            ? 'OFFBOARDING_SUBMITTED'
            : isPurchaseRequisition
            ? 'FINANCE_PENDING_ACK'
            : 'SUBMITTED';

        // Auto-generate description from form fields
        let finalDescription = description;
        if (isManualOnboarding && !description) {
            const cf = (customFields || {}) as Record<string, any>;
            const name = cf.employeeName || 'Unknown';
            const jobTitle = cf.jobTitle || 'Not specified';
            const dept = cf.department || 'Not specified';
            const startDate = cf.startDate || 'TBD';
            const email = cf.employeeEmail || 'Not provided';
            finalDescription = `New employee onboarding request for ${name} (${jobTitle}) in ${dept}. Start date: ${startDate}. Contact: ${email}.`;
        }
        if (isManualOffboarding && !description) {
            const cf = (customFields || {}) as Record<string, any>;
            const name = cf.employeeName || 'Unknown';
            const lastDay = cf.lastDay || 'TBD';
            const email = cf.employeeEmail || 'Not provided';
            const reason = cf.reason || 'Not specified';
            finalDescription = `Employee offboarding request for ${name}. Last working day: ${lastDay}. Contact: ${email}. Reason: ${reason}.`;
        }

        // Auto-generate description for Purchase Requisition (finance)
        if (isPurchaseRequisition && !description) {
            const cf = (customFields || {}) as Record<string, any>;
            const requestTypeData = requestType?.formConfig as any[] | null;
            
            // Build description from customFields, using formConfig labels for unknown field IDs
            const parts: string[] = [];
            
            // Map customFields to readable descriptions
            for (const [key, value] of Object.entries(cf)) {
                if (value === null || value === undefined || value === '') continue;
                
                // Skip file uploads in description
                if (typeof value === 'object' && value.s3Key) continue;
                
                // Find label from formConfig for dynamic field IDs
                let label = key;
                if (requestTypeData && Array.isArray(requestTypeData)) {
                    const field = requestTypeData.find((f: any) => f.id === key);
                    if (field?.label) {
                        const labelLower = field.label.toLowerCase();
                        // Order matters: check more specific matches first
                        if (labelLower.includes('justification')) {
                            label = 'Justification';
                        } else if (labelLower.includes('type of purchase') || labelLower.includes('purchase type')) {
                            label = 'Purchase Type';
                        } else if (labelLower.includes('vendor')) {
                            label = 'Vendor';
                        } else if (labelLower.includes('bu') || labelLower.includes('business unit')) {
                            label = 'Business Unit';
                        } else {
                            label = field.label;
                        }
                    }
                }
                
                parts.push(`${label}: ${value}`);
            }
            
            if (parts.length > 0) {
                finalDescription = `Purchase requisition - ${parts.join('. ')}.`;
            } else {
                finalDescription = 'Purchase requisition submitted.';
            }
        }

        // Auto-generate description for Inter-Company Chargeback (finance)
        if (requestType?.code === 'INTERCOMPANY_CHARGEBACK' && !description) {
            const cf = (customFields || {}) as Record<string, any>;
            const fromEntity = cf.chargeFromEntity || cf.chargeFromEntity || 'Unknown entity';
            const toEntity = cf.chargeToEntity || 'Unknown entity';
            const amount = cf.amount ? `RM ${cf.amount}` : 'Amount TBD';
            const costCenter = cf.costCenter || 'Not specified';
            const desc = cf.description || 'No description provided';
            finalDescription = `Inter-company chargeback from ${fromEntity} to ${toEntity}. Amount: ${amount}. Cost center: ${costCenter}. Details: ${desc}.`;
        }

        // Auto-generate description for Budget Proposal (finance)
        if (requestType?.code === 'BUDGET_PROPOSAL' && !description) {
            const cf = (customFields || {}) as Record<string, any>;
            const department = cf.department || 'Unknown department';
            const period = cf.budgetPeriod || 'Unspecified period';
            const totalAmount = cf.totalAmount ? `RM ${cf.totalAmount}` : 'Amount TBD';
            const breakdown = cf.breakdown || 'No breakdown provided';
            const justification = cf.justification || 'No justification provided';
            finalDescription = `Budget proposal for ${department} - ${period}. Total requested: ${totalAmount}. Breakdown: ${breakdown}. Justification: ${justification}.`;
        }

        // Create request, hardware details, and initial activity in a single transaction
        const request = await prisma.$transaction(async (tx) => {
            const createdRequest = await tx.request.create({
                data: {
                    referenceNumber,
                    requestTypeId,
                    serviceDeskId,
                    requesterId: req.user!.id,
                    requesterEmail: req.user!.email,
                    summary,
                    description: finalDescription,
                    priority,
                    customFields,
                    status: initialStatus as any,
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

            // If this is a hardware request, create the structured ITHardwareRequest record
            if (requestTypeId) {
                const reqType = createdRequest.requestType;
                if (reqType && reqType.name.toLowerCase().includes('hardware')) {
                    const cf = (customFields || {}) as Record<string, any>;
                    const rawPrice = cf.estimatedPrice;
                    const estimatedPrice = rawPrice != null && rawPrice !== '' && !isNaN(Number(rawPrice))
                        ? parseFloat(String(rawPrice))
                        : null;
                    await tx.iTHardwareRequest.create({
                        data: {
                            requestId: createdRequest.id,
                            hardwareName: cf.hardwareName || cf.hw_name || cf.hardwareType || 'Unknown',
                            hardwareModel: cf.hardwareModel || cf.hw_model || cf.model || null,
                            estimatedPrice,
                            preferredVendor: cf.preferredVendor || null,
                            productUrl: cf.productUrl || null,
                            businessJustification: cf.businessJustification || cf.hw_reason || cf.reason || '',
                        },
                    });
                }
            }

            // Auto-create OnboardingRequest for manually submitted onboarding tickets
            if (isManualOnboarding) {
                const cf = (customFields || {}) as Record<string, any>;

                // Parse employee name — support "employeeName" (full) or split first/last
                const rawName = (cf.employeeName || '').trim();
                const nameParts = rawName.split(/\s+/);
                const firstName = nameParts[0] || 'Unknown';
                const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Unknown';

                // Parse start date — fallback to 7 days from now
                let startDate: Date;
                if (cf.startDate) {
                    const parsed = new Date(cf.startDate);
                    startDate = isNaN(parsed.getTime()) ? new Date(Date.now() + 7 * 86400000) : parsed;
                } else {
                    startDate = new Date(Date.now() + 7 * 86400000);
                }

                const onboarding = await tx.onboardingRequest.create({
                    data: {
                        requestId: createdRequest.id,
                        newHireFirstName: firstName,
                        newHireLastName: lastName,
                        newHireEmail: cf.employeeEmail || req.user!.email,
                        newHirePhone: null,
                        jobTitle: cf.jobTitle || 'Not specified',
                        department: cf.department || 'Not specified',
                        hiringManagerId: req.user!.id,
                        startDate,
                        employmentType: 'FULL_TIME',
                        overallStatus: 'PENDING',
                        currentPhase: 'PRE_ARRIVAL',
                    },
                });

                await tx.requestActivity.create({
                    data: {
                        requestId: createdRequest.id,
                        authorName: 'System',
                        authorRole: 'SYSTEM',
                        activityType: 'SYSTEM',
                        message: `Onboarding workflow initialised for ${firstName} ${lastName}. Start date: ${startDate.toDateString()}.`,
                        isSystemGenerated: true,
                    },
                });

                // Seed default tasks outside the transaction
                (createdRequest as any)._onboardingId = onboarding.id;
                (createdRequest as any)._startDate = startDate;
            }

            // Auto-create OffboardingRequest for manually submitted offboarding tickets
            if (isManualOffboarding) {
                const cf = (customFields || {}) as Record<string, any>;

                const rawName = (cf.employeeName || '').trim();
                const nameParts = rawName.split(/\s+/);
                const firstName = nameParts[0] || 'Unknown';
                const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Unknown';

                let lastWorkingDay: Date;
                if (cf.lastDay) {
                    const parsed = new Date(cf.lastDay);
                    lastWorkingDay = isNaN(parsed.getTime()) ? new Date(Date.now() + 14 * 86400000) : parsed;
                } else {
                    lastWorkingDay = new Date(Date.now() + 14 * 86400000);
                }

                const offboarding = await tx.offboardingRequest.create({
                    data: {
                        requestId: createdRequest.id,
                        employeeFirstName: firstName,
                        employeeLastName: lastName,
                        employeeEmail: cf.employeeEmail || req.user!.email,
                        managerId: req.user!.id,
                        lastWorkingDay,
                        reasonForDeparture: cf.reason || null,
                        overallStatus: 'PENDING',
                        currentPhase: 'NOTICE_PERIOD',
                    },
                });

                await tx.requestActivity.create({
                    data: {
                        requestId: createdRequest.id,
                        authorName: 'System',
                        authorRole: 'SYSTEM',
                        activityType: 'SYSTEM',
                        message: `Offboarding workflow initialised for ${firstName} ${lastName}. Last working day: ${lastWorkingDay.toDateString()}.`,
                        isSystemGenerated: true,
                    },
                });

                (createdRequest as any)._offboardingId = offboarding.id;
                (createdRequest as any)._lastWorkingDay = lastWorkingDay;
            }

            // Create initial activity
            await tx.requestActivity.create({
                data: {
                    requestId: createdRequest.id,
                    authorId: req.user!.id,
                    authorName: 'System',
                    activityType: 'SYSTEM',
                    message: 'Request created',
                    isSystemGenerated: true,
                },
            });

            return createdRequest;
        });

        // Seed default onboarding tasks after transaction
        if (isManualOnboarding && (request as any)._onboardingId) {
            await createDefaultOnboardingTasks(
                (request as any)._onboardingId,
                (request as any)._startDate,
            );
        }

        // Seed default offboarding tasks after transaction
        if (isManualOffboarding && (request as any)._offboardingId) {
            const { createDefaultOffboardingTasks } = await import('./offboarding.controller');
            await createDefaultOffboardingTasks(
                (request as any)._offboardingId,
                (request as any)._lastWorkingDay,
            );
        }

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

        await auditLog(req, 'REQUEST_CREATED', 'request', request.id, {
            referenceNumber: request.referenceNumber,
            summary: request.summary,
            status: request.status,
            requesterId: request.requesterId,
        });

        res.status(201).json({
            status: 'success',
            data: { request },
        });
    });

    /**
     * Get request by ID
     */
    getRequestById = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const id = String(req.params.id);

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
                requestType: {
                    include: {
                        workflow: {
                            include: {
                                steps: {
                                    orderBy: { displayOrder: 'asc' as const }
                                }
                            }
                        }
                    }
                },
                itHardwareRequest: true,
                parentRequest: {
                    select: {
                        id: true,
                        referenceNumber: true,
                        summary: true,
                        status: true,
                    },
                },
                childRequests: {
                    select: {
                        id: true,
                        referenceNumber: true,
                        summary: true,
                        status: true,
                    },
                },
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
                approvals: {
                    select: {
                        id: true,
                        approverId: true,
                        approverType: true,
                        status: true,
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
        // 3. User is CEO and request is in hiring workflow or IT CEO approval
        // 4. User is CTO/CFO and request is pending their IT approval
        // 5. User is a designated approver on this request
        const ceoHiringStatuses = ['PENDING_CEO_APPROVAL', 'CEO_APPROVED', 'CEO_REJECTED', 'JOB_POSTED', 'PENDING_MANAGER_REVIEW', 'MANAGER_APPROVED'];
        const isDesignatedApprover = (request as any).approvals?.some((a: any) => a.approverId === req.user!.id);
        const isCEOApprover = hasRole(req, 'CEO') && (
            ceoHiringStatuses.includes(request.status) ||
            request.status === 'PENDING_CEO_APPROVAL_IT' ||
            isDesignatedApprover
        );
        const isCTOApprover = hasRole(req, 'CTO') && (
            request.status === 'PENDING_CTO_APPROVAL_IT' ||
            isDesignatedApprover
        );
        const isCFOApprover = hasRole(req, 'CFO') && (
            request.status === 'PENDING_CFO_APPROVAL_IT' ||
            request.status === 'PENDING_CFO_APPROVAL_FIN' ||
            isDesignatedApprover
        );
        const isGroupCeoApprover = hasRole(req, 'GROUP_CEO') && (
            request.status === 'PENDING_GROUP_CEO_APPROVAL' ||
            isDesignatedApprover
        );

        if (
            request.requesterId !== req.user!.id &&
            !hasRole(req, 'ADMIN', 'AGENT') &&
            !isCEOApprover &&
            !isCTOApprover &&
            !isCFOApprover &&
            !isGroupCeoApprover
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
        const id = String(req.params.id);
        const { summary: rawSummary, description: rawDescription, priority } = req.body;

        // Sanitize highest-risk text fields
        const summary = rawSummary !== undefined ? sanitizeString(rawSummary) : undefined;
        const description = rawDescription !== undefined ? sanitizeComment(rawDescription) : undefined;

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
        const id = String(req.params.id);

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
        const id = String(req.params.id);

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
        const id = String(req.params.id);
        const { message: rawMessage, isInternal } = req.body;

        // Sanitize comment message before storing
        const message = sanitizeComment(rawMessage);

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
     * Upload attachment to request
     * Accepts: images (JPG/PNG/GIF/WebP), PDFs, Word docs, Excel, CSV, plain text, ZIP
     * Max size: 10MB | isScanned: false flag set for future virus scanning
     */
    uploadAttachment = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const id = String(req.params.id);
        const file = req.file;

        if (!file) {
            throw new AppError('No file uploaded', 400);
        }

        // Verify request exists
        const request = await prisma.request.findFirst({
            where: { id, deletedAt: null },
        });
        if (!request) {
            throw new AppError('Request not found', 404);
        }

        const s3Key = (file as any).key;

        const attachment = await prisma.requestAttachment.create({
            data: {
                requestId: id,
                uploadedById: req.user!.id,
                fileName: file.originalname,
                fileSize: BigInt(file.size),
                mimeType: file.mimetype,
                storagePath: s3Key,
                storageUrl: s3Key,
                isScanned: false,       // stub for future ClamAV integration
                scanResult: null,
            },
        });

        // Log un-scanned file for manual review (future virus scan)
        logger.info(`[UPLOAD] Unscanned file uploaded: ${attachment.id} | ${file.originalname} | ${file.mimetype} | ${(file.size / 1024).toFixed(1)}KB | by ${req.user!.email}`);

        res.status(201).json({
            status: 'success',
            data: {
                id: attachment.id,
                fileName: attachment.fileName,
                fileSize: Number(attachment.fileSize),
                mimeType: attachment.mimeType,
                storageUrl: attachment.storageUrl,
                isScanned: attachment.isScanned,
                createdAt: attachment.createdAt,
            },
        });
    });

    /**
     * Download attachment
     * Serves the file from local disk storage via the storageUrl path.
     * Sets Content-Disposition header for browser download.
     */
    downloadAttachment = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const { id, attachmentId } = req.params;

        // Verify the attachment belongs to the request and is not deleted
        const attachment = await prisma.requestAttachment.findFirst({
            where: {
                id: attachmentId,
                requestId: id,
                deletedAt: null,
            },
        });

        if (!attachment) {
            throw new AppError('Attachment not found', 404);
        }

        // Resolve absolute path — storagePath is stored as an absolute path from diskStorage
        const absolutePath = path.resolve(attachment.storagePath);

        // Security: ensure the resolved path is actually inside the uploads directory
        const uploadsDir = path.resolve(process.cwd(), 'uploads');
        if (!absolutePath.startsWith(uploadsDir)) {
            logger.warn(`[DOWNLOAD] Blocked path traversal attempt: ${absolutePath}`);
            throw new AppError('Invalid file path', 400);
        }

        // Verify file exists on disk
        if (!fs.existsSync(absolutePath)) {
            logger.error(`[DOWNLOAD] File not found on disk: ${absolutePath}`);
            throw new AppError('File not found on server', 404);
        }

        // Set Content-Type — fall back to application/octet-stream if unknown
        const contentType = attachment.mimeType || 'application/octet-stream';

        // Set Content-Disposition to trigger browser download with original filename
        const disposition = `attachment; filename="${encodeURIComponent(attachment.fileName)}"`;

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', disposition);
        res.setHeader('Content-Length', fs.statSync(absolutePath).size);

        // Stream the file to the response
        const fileStream = fs.createReadStream(absolutePath);
        fileStream.pipe(res);
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
        const id = String(req.params.id);
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

        await auditLog(req, 'REQUEST_ASSIGNED', 'request', request.id, {
            assignedToId,
            referenceNumber: request.referenceNumber,
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
        const id = String(req.params.id);
        const { status } = req.body;

        // Fetch current request to validate transition
        const currentRequest = await prisma.request.findUnique({ where: { id } });
        if (!currentRequest) {
            throw new AppError('Request not found', 404);
        }

        // Validate transition
        const { isValidTransition } = await import('../utils/workflowTransitions');
        if (!(await isValidTransition(currentRequest.status, status))) {
            throw new AppError(`Invalid status transition from ${currentRequest.status} to ${status}`, 400);
        }

        const TERMINAL_STATUSES = [
            'RESOLVED', 'REJECTED', 'COMPLETED',
            'OFFBOARDING_COMPLETED', 'ONBOARDING_COMPLETED',
            'REIMBURSEMENT_CLOSED', 'CEO_REJECTED',
        ];
        const request = await prisma.request.update({
            where: { id },
            data: {
                status: status as RequestStatus,
                ...(TERMINAL_STATUSES.includes(status) && { closedAt: new Date() }),
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

        await auditLog(req, 'STATUS_CHANGED', 'request', request.id, {
            newStatus: status,
            referenceNumber: request.referenceNumber,
        }, {
            oldStatus: currentRequest.status,
        });

        res.json({
            status: 'success',
            data: { request },
        });
    });
}

export const requestController = new RequestController();
