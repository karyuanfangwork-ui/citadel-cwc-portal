import { Response, NextFunction } from 'express';
import { RequestStatus, LEGACY_REQUEST_STATUS_CODES } from '../constants/requestStatusCompat';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { AuthRequest, hasRole } from '../middleware/auth.middleware';
import { notify } from '../services/notification.service';
import { s3Service } from '../services/s3.service';
import { createDefaultOnboardingTasks } from '../services/onboarding.service';
import { sanitizeString, sanitizeComment, sanitizeRichText, stripHtml } from '../utils/sanitize';
import { auditLog } from '../utils/audit';
import { logger } from '../utils/logger';
import { applyEntityRouting } from '../services/entityRouting.service';
import { autoAssignRequest } from '../services/autoAssignment.service';
import { pauseSla, getEffectiveSlaDueAt } from '../services/sla-pause.service';
import { generateRequestRefNum } from '../services/referenceNumber.service';
import { assertRequestAccess } from '../services/requestAccess.service';
import { getAuthorizedAttachment, registerUpload } from '../services/attachmentAccess.service';
import { resolveRequestCreationPolicy } from '../services/requestCreationPolicy.service';
import { policyService } from '../security/policy.service';
import { principalFromAuth } from '../security/resource-scope.service';
import { CLOSED_STATUSES } from '../constants/requestStatuses';

import prisma from '../utils/prisma';
import { resolveRequestId, UUID_RE } from '../utils/resolve';
import { transitionHttpRequest } from '../utils/httpRequestTransition';
import { getAvailableTransitionsForRequest } from '../services/availableTransitions.service';

/** Extract a display-safe string from a custom field value, handling file objects gracefully. */
function cfStr(val: any): string {
    if (val === null || val === undefined || val === '') return '';
    if (Array.isArray(val)) {
        // Array of file objects — list filenames
        if (val.length > 0 && val[0]?.s3Key && val[0]?.fileName) {
            return val.map((f: any) => f.fileName).join(', ');
        }
        return val.join(', ');
    }
    if (typeof val === 'object' && val !== null) {
        // File upload objects — return the original filename for display
        if (val.s3Key && val.fileName) return val.fileName;
        // Nested structures like candidateDocuments — skip
        return '';
    }
    return String(val);
}

async function findFinanceCeo(tenantId: string | null | undefined, preferredUserId?: string): Promise<{ id: string; firstName: string; lastName: string; email: string } | null> {
    return prisma.user.findFirst({
        where: {
            isActive: true,
            ...(preferredUserId ? { id: preferredUserId } : {}),
            ...(tenantId ? { tenantId } : {}),
            OR: [
                { executiveRole: 'CEO' },
                { executiveRole: 'GROUP_DCEO' },
                { roles: { some: { role: { name: { in: ['CEO', 'GROUP_DCEO'] } } } } },
            ],
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, firstName: true, lastName: true, email: true },
    });
}

class RequestController {
    /**
     * Get all requests with filters and pagination
     */
    getAllRequests = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const {
            page = '1',
            limit = '10',
            status,
            excludedStatuses,
            serviceDeskId,
            assignedToId,
            priority,
            search,
            requestTypeId,
            requesterId,
            participantId,
        }  = req.query as Record<string, string>;

        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const skip = (pageNum - 1) * limitNum;

        // Build where clause starting with soft-delete filter
        const where: any = {
            deletedAt: null,
        };

        // P02-09: Use policy service for visibility scoping instead of
        // hardcoded ADMIN/AGENT bypasses. buildVisibleWhere produces a
        // tenant-aware, team-scoped, ownership-based Prisma filter that
        // respects all policy rules including department grants.
        const principal = principalFromAuth(req.user!);
        const visibleWhere = policyService.buildVisibleWhere(principal, 'request');
        if (visibleWhere.AND || visibleWhere.OR) {
            // Merge the policy visibility conditions into our where clause
            where.AND = [
                ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
                visibleWhere,
            ];
        }

        // Confidentiality gate: users without request:confidential permission
        // cannot see confidential requests unless they own, are assigned, are an
        // approver, or are a participant. ADMIN within their tenant can see all.
        const canSeeConfidential = principal.roles.includes('ADMIN') || principal.permissions.includes('request:confidential');
        if (!canSeeConfidential) {
            const confFilter = {
                OR: [
                    { isConfidential: false },
                    { requesterId: req.user!.id },
                    { assignedToId: req.user!.id },
                    { approvals: { some: { approverId: req.user!.id } } },
                    { participants: { some: { userId: req.user!.id } } },
                ],
            };
            where.AND = [
                ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
                confFilter,
            ];
        }

        // Status codes are catalog-backed strings. Keep filters syntactically
        // bounded here; runtime transition paths perform catalog validation.
        const validStatusCode = /^[A-Z][A-Z0-9_]{1,99}$/;

        if (status) {
            // Support comma-separated status values for multi-status filters
            const statusValues = (status as string).split(',').map(v => v.trim().toUpperCase()).filter(v => validStatusCode.test(v));
            where.status = statusValues.length === 1
                ? statusValues[0]
                : statusValues.length > 1
                    ? { in: statusValues }
                    : undefined;
        }

        if (excludedStatuses) {
            // Support comma-separated excluded status values to filter out specific statuses
            // Filter out any values that aren't valid RequestStatus members (e.g. stale frontend strings like "CLOSED")
            const excludedValues = (excludedStatuses as string).split(',').map(v => v.trim().toUpperCase()).filter(v => validStatusCode.test(v));
            if (excludedValues.length === 0) {
                // All values were invalid — skip filter entirely
            } else if (where.status) {
                // If both status and excludedStatuses are provided, combine with AND
                const existingStatus = where.status;
                delete where.status;
                where.AND = [
                    ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
                    { status: existingStatus },
                    { status: { notIn: excludedValues } },
                ];
            } else {
                where.status = { notIn: excludedValues };
            }
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

        // Filter by participant (for "Shared with me" view)
        if (participantId) {
            where.AND = [
                ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
                { participants: { some: { userId: participantId as string } } },
            ];
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
                    participants: {
                        select: {
                            userId: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            }),
            prisma.request.count({ where }),
        ]);

        // Add computed SLA pause info to each request in the list
        for (const request of requests) {
            (request as any).effectiveSlaDueAt = getEffectiveSlaDueAt(request);
            (request as any).slaPaused = request.slaPausedAt !== null;
        }

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
     * Get all requests pending current user's approval
     * GET /api/v1/requests/pending-approvals
     */
    getPendingApprovals = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const userId = req.user!.id;
        const userRoles = (req.user as any)?.roles?.map((r: any) => r.role?.name ?? r) ?? [];
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const { priority, serviceDeskCode }  = req.query as Record<string, string>;

        // Find pending approvals assigned to this user
        const pendingApprovals = await prisma.requestApproval.findMany({
            where: {
                approverId: userId,
                status: 'PENDING',
            },
            select: { requestId: true },
        });
        const requestIds = pendingApprovals.map(a => a.requestId);

        // Also include requests in PENDING_* statuses if user has matching roles
        const PENDING_APPROVAL_STATUSES: Record<string, string[]> = {
            CEO: ['PENDING_CEO_APPROVAL', 'PENDING_CEO_APPROVAL_IT', 'PENDING_CEO_APPROVAL_FIN'],
            CTO: ['PENDING_CTO_APPROVAL_IT'],
            CFO: ['PENDING_CFO_APPROVAL_IT', 'PENDING_CFO_APPROVAL_FIN', 'PENDING_FINANCE_HEAD_APPROVAL'],
            GROUP_DCEO: ['PENDING_GROUP_DCEO_APPROVAL'],
            VP: [],
            MANAGER: ['PENDING_MANAGER_APPROVAL_FIN', 'PENDING_MANAGER_REVIEW'],
            HR: ['LOA_PENDING_APPROVAL', 'ONBOARDING_PENDING_HR_APPROVAL'],
        };

        const validStatuses: string[] = [...LEGACY_REQUEST_STATUS_CODES];
        const statusFilter: string[] = [];
        for (const [role, statuses] of Object.entries(PENDING_APPROVAL_STATUSES)) {
            if (userRoles.includes(role)) {
                statusFilter.push(...statuses);
            }
        }
        // Always include entity approval statuses for entity approvers
        statusFilter.push('PENDING_FROM_ENTITY_APPROVAL', 'PENDING_TO_ENTITY_APPROVAL');
        // Filter out invalid enum values to prevent Prisma validation errors
        const filteredStatusFilter = statusFilter.filter(s => validStatuses.includes(s));

        // Build where clause
        const where: any = {
            deletedAt: null,
            OR: [
                ...(requestIds.length > 0 ? [{ id: { in: requestIds } }] : []),
                ...(statusFilter.length > 0 ? [{ status: { in: Array.from(new Set(filteredStatusFilter)) } }] : []),
            ],
        };

        if (priority) {
            where.priority = priority as string;
        }
        if (serviceDeskCode) {
            where.serviceDesk = { code: serviceDeskCode as string };
        }

        const [requests, total] = await Promise.all([
            prisma.request.findMany({
                where,
                include: {
                    requester: {
                        select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
                    },
                    assignedTo: {
                        select: { id: true, firstName: true, lastName: true, email: true },
                    },
                    serviceDesk: { select: { id: true, name: true, code: true } },
                    requestType: { select: { id: true, name: true } },
                    approvals: {
                        where: { status: 'PENDING' },
                        include: {
                            approver: { select: { id: true, firstName: true, lastName: true, email: true } },
                            entity: { select: { id: true, name: true, code: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.request.count({ where }),
        ]);

        res.json({
            status: 'success',
            data: { requests },
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    });

    /**
     * Bulk approve or reject requests
     * POST /api/v1/requests/bulk-action
     *
     * Workflow-aware: determines the correct status transition based on
     * the request's current status and the approval's approverType.
     */
    bulkAction = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const userId = req.user!.id;
        const { action, requestIds, comment } = req.body;

        if (!['approve', 'reject'].includes(action)) {
            throw new AppError('Action must be "approve" or "reject"', 400);
        }
        if (!Array.isArray(requestIds) || requestIds.length === 0) {
            throw new AppError('requestIds must be a non-empty array', 400);
        }

        const approvalStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
        const userRoles = (req.user as any)?.roles?.map((r: any) => r.role?.name ?? r) ?? [];

        // Find PENDING approvals where the user is either:
        // 1. Directly assigned (approverId = userId), OR
        // 2. Role-based (approverId is null AND approverType matches one of the user's roles)
        const approvals = await prisma.requestApproval.findMany({
            where: {
                requestId: { in: requestIds },
                status: 'PENDING',
                OR: [
                    { approverId: userId },
                    { approverId: null, approverType: { in: userRoles } },
                ],
            },
        });

        // Stamp approverId on role-based approvals that were matched by type
        for (const approval of approvals) {
            if (!approval.approverId) {
                await prisma.requestApproval.update({
                    where: { id: approval.id },
                    data: { approverId: userId },
                });
                approval.approverId = userId;
            }
        }

        const approvedRequestIds = approvals.map(a => a.requestId);

        if (approvedRequestIds.length === 0) {
            res.json({
                status: 'success',
                data: {
                    action,
                    processedCount: 0,
                    processedIds: [],
                },
            });
            return;
        }

        // Fetch the requests that have matching approvals to determine workflow transitions
        const requests = await prisma.request.findMany({
            where: { id: { in: approvedRequestIds } },
            select: { id: true, status: true, referenceNumber: true, tenantId: true },
        });

        // Map: status → (approverType, decision) → next status
        // This mirrors the workflow-specific controllers (it-workflow, approval, etc.)
        const STATUS_TRANSITIONS: Record<string, Record<string, { approve: string; reject: string }>> = {
            // CEO approvals — skip transient "APPROVED" states, go directly to next pending step
            PENDING_CEO_APPROVAL: { CEO: { approve: 'CEO_APPROVED', reject: 'CEO_REJECTED' } },
            PENDING_CEO_APPROVAL_IT: { CEO: { approve: 'PENDING_CTO_APPROVAL_IT', reject: 'CEO_REJECTED_IT' } },
            PENDING_CEO_APPROVAL_FIN: { CEO: { approve: 'PENDING_CFO_APPROVAL_FIN', reject: 'CEO_REJECTED_FIN' } },
            // CTO approvals (IT workflow) — skip CTO_APPROVED_IT, go to PENDING_INVOICE_IT
            PENDING_CTO_APPROVAL_IT: { CTO: { approve: 'PENDING_INVOICE_IT', reject: 'CTO_REJECTED_IT' } },
            // CFO approvals — skip transient APPROVED states, go to next workflow step
            PENDING_CFO_APPROVAL_IT: { CFO: { approve: 'PAYMENT_PROCESSING_IT', reject: 'CFO_REJECTED_IT' } },
            PENDING_CFO_APPROVAL_FIN: { CFO: { approve: 'CFO_APPROVED_FIN', reject: 'CFO_REJECTED_FIN' } },
            PENDING_CFO_APPROVAL: { CFO: { approve: 'CFO_APPROVED', reject: 'CFO_REJECTED' } },
            PENDING_FINANCE_HEAD_APPROVAL: { CFO: { approve: 'FINANCE_HEAD_APPROVED', reject: 'FINANCE_HEAD_REJECTED' } },
            // Manager approvals
            PENDING_MANAGER_APPROVAL_FIN: { MANAGER: { approve: 'MANAGER_APPROVED_FIN', reject: 'MANAGER_REJECTED_FIN' } },
            PENDING_MANAGER_REVIEW: { MANAGER: { approve: 'MANAGER_APPROVED', reject: 'IN_REVIEW' } },
            // Group Deputy CEO approvals
            PENDING_GROUP_DCEO_APPROVAL: { GROUP_DCEO: { approve: 'GROUP_DCEO_APPROVED', reject: 'GROUP_DCEO_REJECTED' } },
            // HR approvals
            LOA_PENDING_APPROVAL: { HR: { approve: 'LOA_APPROVED', reject: 'REJECTED' } },
            ONBOARDING_PENDING_HR_APPROVAL: { HR: { approve: 'ONBOARDING_PRE_ARRIVAL_SETUP', reject: 'REJECTED' } },
        };

        // Approval types that should create a follow-up approval after approval
        // When a cascading approval exists, the approval creates the next PENDING approval record
        // and SLA is paused again for the next approver.
        // When NO cascade exists (e.g. CTO approve → PENDING_INVOICE_IT), SLA stays resumed.
        const CASCADING_APPROVALS: Record<string, { approverType: string; nextStatus: string }> = {
            PENDING_CEO_APPROVAL_IT: { approverType: 'CTO', nextStatus: 'PENDING_CTO_APPROVAL_IT' },
            PENDING_CEO_APPROVAL_FIN: { approverType: 'CFO', nextStatus: 'PENDING_CFO_APPROVAL_FIN' },
        };

        // Role display names for activity log
        const ROLE_DISPLAY: Record<string, string> = {
            CEO: 'CEO', CTO: 'CTO', CFO: 'CFO', VP: 'VP',
            MANAGER: 'Manager', GROUP_DCEO: 'Group Deputy CEO', HR: 'HR',
            HIRING_MANAGER: 'Hiring Manager',
        };

        const processedIds: string[] = [];
        const errors: { requestId: string; error: string }[] = [];

        for (const approval of approvals) {
            const request = requests.find(r => r.id === approval.requestId);
            if (!request) continue;

            const currentStatus = request.status;
            const approverType = approval.approverType;

            // Determine the new status
            const transition = STATUS_TRANSITIONS[currentStatus]?.[approverType];
            if (!transition) {
                errors.push({ requestId: request.id, error: `No transition defined for status ${currentStatus} with approver type ${approverType}` });
                continue;
            }

            const newStatus = action === 'approve' ? transition.approve : transition.reject;

            try {
                const requestPatch: Record<string, unknown> = {};
                let nextCfoId: string | null = null;
                if (action === 'reject' && transition.reject.includes('REJECTED')) {
                    requestPatch.resolvedAt = new Date();
                }

                if (action === 'approve' && currentStatus === 'PENDING_CEO_APPROVAL_FIN') {
                    const existingCfoApproval = await prisma.requestApproval.findFirst({
                        where: { requestId: request.id, approverType: 'CFO', status: 'PENDING' },
                        select: { approverId: true },
                    });
                    nextCfoId = existingCfoApproval?.approverId ?? (await prisma.user.findFirst({
                        where: {
                            isActive: true,
                            ...(request.tenantId ? { tenantId: request.tenantId } : {}),
                            OR: [
                                { executiveRole: 'CFO' },
                                { roles: { some: { role: { name: 'CFO' } } } },
                            ],
                        },
                        orderBy: { createdAt: 'asc' },
                        select: { id: true },
                    }))?.id ?? null;
                    if (!nextCfoId) {
                        throw new AppError('No active CFO approver is configured for this tenant', 409);
                    }
                    requestPatch.assignedToId = nextCfoId;
                }

                let financeAgent: { id: string; firstName: string; lastName: string } | null = null;
                if (action === 'approve' && currentStatus === 'PENDING_CFO_APPROVAL_IT') {
                    financeAgent = await prisma.user.findFirst({
                        where: { agentTeam: 'FINANCE', isActive: true, roles: { some: { role: { name: { in: ['AGENT', 'ADMIN'] } } } } },
                        select: { id: true, firstName: true, lastName: true },
                        orderBy: { createdAt: 'asc' },
                    });
                    if (financeAgent) {
                        requestPatch.assignedToId = financeAgent.id;
                        requestPatch.assignedTeam = 'FINANCE';
                    }
                }

                // Keep the approval decision, status transition, and any follow-up
                // approval in the same workflow command transaction. Updating the
                // approval row before transition validation can leave an approved
                // row attached to a request that is still pending.
                await transitionHttpRequest({
                    req,
                    request,
                    toStatus: newStatus,
                    source: 'request.bulk-approval',
                    comment: comment,
                    requestPatch,
                    transactionMutations: async (tx: any) => {
                        await tx.requestApproval.update({
                            where: { id: approval.id },
                            data: {
                                status: approvalStatus,
                                comments: comment || null,
                            },
                        });

                        if (action === 'approve' && CASCADING_APPROVALS[currentStatus]) {
                            const cascade = CASCADING_APPROVALS[currentStatus];
                            await tx.requestApproval.create({
                                data: {
                                    requestId: request.id,
                                    approverType: cascade.approverType,
                                    approverId: currentStatus === 'PENDING_CEO_APPROVAL_FIN' ? nextCfoId : undefined,
                                    status: 'PENDING',
                                },
                            });
                        }
                    },
                });

                // Notifications are sent only after the command commits.
                if (action === 'approve' && currentStatus === 'PENDING_CEO_APPROVAL_FIN' && nextCfoId) {
                    await notify({ userId: nextCfoId, eventType: 'APPROVAL_REQUIRED', variables: { requestId: request.id, role: 'CFO' }, relatedRequestId: request.id });
                }

                // Create activity log
                const roleDisplay = ROLE_DISPLAY[approverType] || approverType;
                await prisma.requestActivity.create({
                    data: {
                        requestId: request.id,
                        authorId: userId,
                        authorName: `${req.user!.firstName || ''} ${req.user!.lastName || ''}`.trim() || roleDisplay,
                        activityType: action === 'approve' ? 'APPROVAL' : 'REJECTION',
                        message: `${roleDisplay} ${action === 'approve' ? 'approved' : 'rejected'} this request${comment ? ': ' + comment : ''}`,
                        isSystemGenerated: false,
                    },
                });


                // Assignment was committed in the command; emit its domain-specific activity.
                if (financeAgent) {
                    const agentName = `${financeAgent.firstName} ${financeAgent.lastName}`;
                    await prisma.requestActivity.create({
                        data: {
                            requestId: request.id,
                            authorName: 'System',
                            activityType: 'ASSIGNMENT',
                            message: `Auto-reassigned to ${agentName} (FINANCE team) — CFO approved, payment processing`,
                            isSystemGenerated: true,
                            metadata: { autoAssigned: true, assignedToId: financeAgent.id, assignedTeam: 'FINANCE' },
                        },
                    });
                }

                processedIds.push(request.id);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                errors.push({ requestId: request.id, error: msg });
            }
        }

        res.json({
            status: 'success',
            data: {
                action,
                processedCount: processedIds.length,
                processedIds,
                ...(errors.length > 0 ? { errors } : {}),
            },
        });
    });

    /**
     * Create a new request
     */
    createRequest = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const {
            requestTypeId,
            serviceDeskId,
            summary: rawSummary,
            description: rawDescription,
            priority,
            customFields,
            isConfidential,
            formVersion,
        } = req.body;

        // Sanitize highest-risk text fields before storing
        const summary = sanitizeString(rawSummary);

        const creationPolicy = await resolveRequestCreationPolicy(principalFromAuth(req.user!), {
            requestTypeId,
            serviceDeskId,
            formVersion,
            values: (customFields || {}) as Record<string, unknown>,
            requestedConfidentiality: isConfidential,
        });
        const { serviceDesk, requestType } = creationPolicy;

        // IT Support uses rich-text editor — allow safe HTML; others stay plain text
        const description = rawDescription
            ? (serviceDesk.code === 'IT' ? sanitizeRichText(rawDescription) : sanitizeComment(rawDescription))
            : undefined;

        // Get count for reference number — P2-11: use atomic counter
        // OLD: const count = await prisma.request.count({ where: { serviceDeskId } });
        //      const referenceNumber = `${serviceDesk.code}-${count + 1}`;
        // This was not safe under concurrent requests.
        const referenceNumber = await generateRequestRefNum(serviceDesk.code);

        // Calculate SLA due date from the server-resolved published request type.
        let slaDueAt: Date | undefined;
        if (creationPolicy.slaHours) {
            slaDueAt = new Date();
            slaDueAt.setHours(slaDueAt.getHours() + creationPolicy.slaHours);
        }

        // Detect manual onboarding/offboarding/finance submission
        const isManualOnboarding = requestType?.code === 'EMPLOYEE_ONBOARDING';
        const isManualOffboarding = requestType?.code === 'EMPLOYEE_OFFBOARDING';
        const isPurchaseRequisition = requestType?.code === 'PURCHASE_REQUISITION';
        const isBudgetProposal = requestType?.code === 'BUDGET_PROPOSAL';
        const isIntercompanyChargeback = requestType?.code === 'INTERCOMPANY_CHARGEBACK';
        const isExpenseClaim = requestType?.code === 'EXPENSE_CLAIM';
        const isEsmTravelRequest = requestType?.code === 'CWC_TRAVEL_REQUEST';

        let esmSelectedCeo: { id: string; firstName: string; lastName: string; email: string } | null = null;
        if (isEsmTravelRequest) {
            const ceoApproverId = String(((customFields || {}) as Record<string, any>).ceoApproverId || '').trim();
            if (!ceoApproverId) {
                throw new AppError('CEO Approver is required for CWC Travel Request', 400);
            }

            const ceoUser = await prisma.user.findUnique({
                where: { id: ceoApproverId },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    executiveRole: true,
                    isActive: true,
                    roles: { select: { role: { select: { name: true } } } },
                },
            });

            const selectedRoleNames = ceoUser?.roles.map((r) => r.role.name) ?? [];
            const canApproveTravel = ceoUser?.executiveRole === 'CEO'
                || ceoUser?.executiveRole === 'GROUP_DCEO'
                || selectedRoleNames.includes('CEO')
                || selectedRoleNames.includes('GROUP_DCEO');

            if (!ceoUser || !ceoUser.isActive || !canApproveTravel) {
                throw new AppError('Selected CEO approver is not an active CEO or Group DCEO. Please select a valid approver.', 400);
            }

            esmSelectedCeo = {
                id: ceoUser.id,
                firstName: ceoUser.firstName,
                lastName: ceoUser.lastName,
                email: ceoUser.email,
            };
        }

        // Validate summary: required unless auto-generated for specific request types
        const autoSummaryCodes = ['NEW_HIRING', 'EMPLOYEE_OFFBOARDING', 'NEW_HARDWARE', 'GET_IT_HELP', 'REPORT_SYSTEM_PROBLEM', 'SOFTWARE_INSTALLATION', 'PURCHASE_REQUISITION', 'EMAIL_MANAGEMENT'];
        const isAutoSummaryType = requestType?.code ? autoSummaryCodes.includes(requestType.code) : false;
        if (!summary && !isAutoSummaryType) {
            throw new AppError('Summary is required', 400);
        }

        const initialStatus = isManualOnboarding
            ? 'ONBOARDING_SUBMITTED'
            : isManualOffboarding
            ? 'OFFBOARDING_SUBMITTED'
            : (isPurchaseRequisition || isBudgetProposal)
            ? 'PENDING_CEO_APPROVAL_FIN'
            : isIntercompanyChargeback
            ? 'SUBMITTED'
            : isExpenseClaim
            ? 'PENDING_MANAGER_APPROVAL_FIN'
            : isEsmTravelRequest
            ? 'PENDING_CEO_APPROVAL'
            : 'SUBMITTED';

        const financeFormConfig = Array.isArray(requestType?.formConfig)
            ? requestType.formConfig as Array<{ id?: string; label?: string; type?: string }>
            : [];
        const financeApproverField = financeFormConfig.find((field) =>
            field.type === 'ceo-select' || field.label?.trim().toLowerCase() === 'ceo approver'
        );
        const selectedFinanceCeoId = financeApproverField?.id
            ? String(((customFields || {}) as Record<string, any>)[financeApproverField.id] || '').trim()
            : '';
        if (isPurchaseRequisition && financeApproverField && !selectedFinanceCeoId) {
            throw new AppError('CEO Approver is required for Purchase Requisition', 400);
        }
        const financeCeo = (isPurchaseRequisition || isBudgetProposal)
            ? await findFinanceCeo(creationPolicy.tenantId, selectedFinanceCeoId || undefined)
            : null;
        if ((isPurchaseRequisition || isBudgetProposal) && !financeCeo) {
            throw new AppError(
                selectedFinanceCeoId ? 'Selected CEO Approver is not an active CEO or Group DCEO in this tenant' : 'No active CEO approver is configured for this tenant',
                selectedFinanceCeoId ? 400 : 409,
            );
        }

        // Auto-generate description from form fields
        let finalDescription = description;
        if (isManualOnboarding && !description) {
            const cf = (customFields || {}) as Record<string, any>;
            const name = cfStr(cf.employeeName) || 'Unknown';
            const jobTitle = cfStr(cf.jobTitle) || 'Not specified';
            const dept = cfStr(cf.department) || 'Not specified';
            const email = cfStr(cf.employeeEmail) || 'Not provided';
            finalDescription = `New employee onboarding request for ${name} (${jobTitle}) in ${dept}. Contact: ${email}.`;
        }
        if (isManualOffboarding && !description) {
            const cf = (customFields || {}) as Record<string, any>;
            const name = cfStr(cf.employeeName) || 'Unknown';
            const lastDay = cfStr(cf.lastDay) || 'TBD';
            const email = cfStr(cf.employeeEmail) || 'Not provided';
            const reason = cfStr(cf.reason) || 'Not specified';
            finalDescription = `Employee offboarding request for ${name}. Last working day: ${lastDay}. Contact: ${email}. Reason: ${reason}.`;
        }

        // Auto-generate description for New Hiring Request (HR recruitment)
        if (requestType?.code === 'NEW_HIRING' && !description) {
            const cf = (customFields || {}) as Record<string, any>;
            const formConfig = requestType?.formConfig as any[] | null;

            const parts: string[] = [];
            for (const [key, value] of Object.entries(cf)) {
                if (value === null || value === undefined || value === '') continue;

                let label = key;
                if (formConfig && Array.isArray(formConfig)) {
                    const field = formConfig.find((f: any) => f.id === key);
                    if (field?.label) label = field.label;
                }

                if (typeof value === 'object' && value.s3Key) continue;
                // Skip file arrays in description
                if (Array.isArray(value) && value.length > 0 && value[0]?.s3Key) continue;
                if (typeof value === 'object' && !value.s3Key) {
                    // candidateDocuments or other nested objects — summarize instead of dumping raw
                    if (key === 'candidates') {
                        const candObj = value as Record<string, Record<string, any>>;
                        const candCount = Object.keys(candObj).length;
                        if (candCount > 0) {
                            const totalDocs = Object.values(candObj).reduce((s, d) => s + Object.keys(d).length, 0);
                            parts.push(`${label}: ${candCount} candidate${candCount > 1 ? 's' : ''}, ${totalDocs} document${totalDocs !== 1 ? 's' : ''}`);
                        }
                        continue;
                    }
                    continue;
                }

                parts.push(`${label}: ${cfStr(value)}`);
            }

            if (parts.length > 0) {
                finalDescription = `New hiring request - ${parts.join('. ')}.`;
            } else {
                finalDescription = 'New hiring request submitted.';
            }
        }

        // Auto-generate description for HR General questions
        if (requestType?.code === 'HR_QUESTION' && !description) {
            const cf = (customFields || {}) as Record<string, any>;
            const formConfig = requestType?.formConfig as any[] | null;

            const parts: string[] = [];
            for (const [key, value] of Object.entries(cf)) {
                if (value === null || value === undefined || value === '') continue;
                if (typeof value === 'object' && value.s3Key) continue;
                if (Array.isArray(value) && value.length > 0 && value[0]?.s3Key) continue;

                let label = key;
                if (formConfig && Array.isArray(formConfig)) {
                    const field = formConfig.find((f: any) => f.id === key);
                    if (field?.label) label = field.label;
                }

                parts.push(`${label}: ${cfStr(value)}`);
            }

            if (parts.length > 0) {
                finalDescription = `HR inquiry - ${parts.join('. ')}.`;
            } else {
                finalDescription = 'HR inquiry submitted.';
            }
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
                if (Array.isArray(value) && value.length > 0 && value[0]?.s3Key) continue;
                
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
                
                parts.push(`${label}: ${cfStr(value)}`);
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
            const fromEntity = cfStr(cf.chargeFromEntity) || cfStr(cf.chargeFromEntity) || 'Unknown entity';
            const toEntity = cfStr(cf.chargeToEntity) || 'Unknown entity';
            const amount = cf.amount ? `RM ${cfStr(cf.amount)}` : 'Amount TBD';
            const costCenter = cfStr(cf.costCenter) || 'Not specified';
            const desc = cfStr(cf.description) || 'No description provided';
            finalDescription = `Inter-company chargeback from ${fromEntity} to ${toEntity}. Amount: ${amount}. Cost center: ${costCenter}. Details: ${desc}.`;
        }

        // Auto-generate description for Email Management (IT)
        if (requestType?.code === 'EMAIL_MANAGEMENT' && !description) {
            const cf = (customFields || {}) as Record<string, any>;
            const formConfig = (requestType?.formConfig || []) as any[];
            const resolveByLabel = (labelMatch: string): any => {
                for (const f of formConfig) {
                    if (f.label && f.label.toLowerCase().includes(labelMatch.toLowerCase())) {
                        if (cf[f.id]) return cf[f.id];
                    }
                }
                return undefined;
            };
            const emailType = cfStr(cf.field_email_request_type || resolveByLabel('request type')) || 'Not specified';
            const emailAddress = cfStr(cf.field_email_address || resolveByLabel('email address')) || 'Not provided';
            const mailClient = cfStr(cf.field_mail_client || resolveByLabel('mail client')) || '';
            const symptoms = cfStr(cf.field_email_symptoms || resolveByLabel('error') || resolveByLabel('symptoms')) || '';
            const parts = [`Email request type: ${emailType}`, `Email address: ${emailAddress}`];
            if (mailClient) parts.push(`Mail client: ${mailClient}`);
            if (symptoms) parts.push(`Symptoms: ${symptoms}`);
            finalDescription = parts.join('. ') + '.';
        }

        // Auto-generate description for Report System Problem (IT)
        if (requestType?.code === 'REPORT_SYSTEM_PROBLEM' && !description) {
            const cf = (customFields || {}) as Record<string, any>;
            const systemName = cfStr(cf.field_system_name) || 'Unspecified system';
            const problemType = cfStr(cf.field_problem_type) || 'Unspecified';
            const affectedUsers = cfStr(cf.field_affected_users) || '';
            const problemDesc = cfStr(cf.field_problem_description) || 'No details provided';
            const parts = [`System: ${systemName}`, `Problem type: ${problemType}`];
            if (affectedUsers) parts.push(`Affected users: ${affectedUsers}`);
            parts.push(`Details: ${problemDesc}`);
            finalDescription = parts.join('. ') + '.';
        }

        // Auto-generate description for Budget Proposal (finance)
        if (requestType?.code === 'BUDGET_PROPOSAL' && !description) {
            const cf = (customFields || {}) as Record<string, any>;
            const department = cfStr(cf.department) || 'Unknown department';
            const period = cfStr(cf.budgetPeriod) || 'Unspecified period';
            const totalAmount = cf.totalAmount ? `RM ${cfStr(cf.totalAmount)}` : 'Amount TBD';
            const breakdown = cfStr(cf.breakdown) || 'No breakdown provided';
            const justification = cfStr(cf.justification) || 'No justification provided';
            finalDescription = `Budget proposal for ${department} - ${period}. Total requested: ${totalAmount}. Breakdown: ${breakdown}. Justification: ${justification}.`;
        }

        // Auto-generate summary for hardware and IT help requests if not provided
        let finalSummary = summary;
        if (!finalSummary && requestType?.code === 'NEW_HARDWARE') {
            const cf = (customFields || {}) as Record<string, any>;
            const formConfig = (requestType?.formConfig || []) as any[];
            const resolveField = (...keys: string[]): any => {
                for (const k of keys) { if (cf[k]) return cf[k]; }
                return undefined;
            };
            const resolveByLabel = (labelMatch: string): any => {
                for (const f of formConfig) {
                    if (f.label && f.label.toLowerCase().includes(labelMatch.toLowerCase())) {
                        if (cf[f.id]) return cf[f.id];
                    }
                }
                return undefined;
            };
            const hwName = resolveField('hardwareName') || resolveByLabel('hardware name') || resolveByLabel('device type') || '';
            if (hwName) {
                finalSummary = `Request new hardware: ${hwName}`;
            }
        }
        if (!finalSummary && requestType?.code === 'GET_IT_HELP') {
            // Strip HTML tags from rich-text description before building plain-text summary
            const desc = stripHtml(rawDescription || '').trim();
            if (desc) {
                const firstLine = desc.split('\n')[0].trim();
                const maxLen = 120;
                // Reserve 14 chars for "Get IT Help: " prefix
                const summaryMaxLen = maxLen - 14;
                let shortSummary: string;
                if (firstLine.length <= summaryMaxLen) {
                    shortSummary = firstLine;
                } else {
                    const truncated = firstLine.substring(0, summaryMaxLen);
                    const lastSpace = truncated.lastIndexOf(' ');
                    shortSummary = lastSpace > summaryMaxLen * 0.6 ? truncated.substring(0, lastSpace) : truncated;
                }
                finalSummary = `Get IT Help: ${shortSummary}`;
            }
        }
        if (!finalSummary && requestType?.code === 'REPORT_SYSTEM_PROBLEM') {
            const cf = (customFields || {}) as Record<string, any>;
            const systemName = (cf.field_system_name || '').toString().trim();
            const problemType = (cf.field_problem_type || '').toString().trim();
            if (systemName || problemType) {
                // Build from form fields: "System Problem: ERP - System Down / Outage"
                const parts = [systemName, problemType].filter(Boolean);
                const summary = parts.join(' - ');
                finalSummary = `System Problem: ${summary}`.substring(0, 120);
            } else {
                // Fallback to description first line
                const desc = stripHtml(rawDescription || '').trim();
                if (desc) {
                    const firstLine = desc.split('\n')[0].trim();
                    const maxLen = 120;
                    const summaryMaxLen = maxLen - 17;
                    let shortSummary: string;
                    if (firstLine.length <= summaryMaxLen) {
                        shortSummary = firstLine;
                    } else {
                        const truncated = firstLine.substring(0, summaryMaxLen);
                        const lastSpace = truncated.lastIndexOf(' ');
                        shortSummary = lastSpace > summaryMaxLen * 0.6 ? truncated.substring(0, lastSpace) : truncated;
                    }
                    finalSummary = `System Problem: ${shortSummary}`;
                }
            }
        }
        if (!finalSummary && requestType?.code === 'EMAIL_MANAGEMENT') {
            const desc = stripHtml(rawDescription || '').trim();
            if (desc) {
                const firstLine = desc.split('\n')[0].trim();
                const maxLen = 120;
                // Reserve 18 chars for "Email Management: " prefix
                const summaryMaxLen = maxLen - 18;
                let shortSummary: string;
                if (firstLine.length <= summaryMaxLen) {
                    shortSummary = firstLine;
                } else {
                    const truncated = firstLine.substring(0, summaryMaxLen);
                    const lastSpace = truncated.lastIndexOf(' ');
                    shortSummary = lastSpace > summaryMaxLen * 0.6 ? truncated.substring(0, lastSpace) : truncated;
                }
                finalSummary = `Email Management: ${shortSummary}`;
            } else {
                // Build summary from custom fields
                const cf = (customFields || {}) as Record<string, any>;
                const formConfig = (requestType?.formConfig || []) as any[];
                const resolveByLabel = (labelMatch: string): any => {
                    for (const f of formConfig) {
                        if (f.label && f.label.toLowerCase().includes(labelMatch.toLowerCase())) {
                            if (cf[f.id]) return cf[f.id];
                        }
                    }
                    return undefined;
                };
                const emailType = cf.field_email_request_type || resolveByLabel('request type') || '';
                const emailAddress = cf.field_email_address || resolveByLabel('email address') || '';
                if (emailType || emailAddress) {
                    const parts = ['Email Management'];
                    if (emailType) parts.push(emailType);
                    if (emailAddress) parts.push(`(${emailAddress})`);
                    finalSummary = parts.join(': ');
                }
            }
        }
        if (!finalSummary && requestType?.code === 'SOFTWARE_INSTALLATION') {
            const cf = (customFields || {}) as Record<string, any>;
            const formConfig = (requestType?.formConfig || []) as any[];
            const resolveByLabel = (labelMatch: string): any => {
                for (const f of formConfig) {
                    if (f.label && f.label.toLowerCase().includes(labelMatch.toLowerCase())) {
                        if (cf[f.id]) return cf[f.id];
                    }
                }
                return undefined;
            };
            const swName = cf.sw_name || resolveByLabel('software name') || resolveByLabel('software') || '';
            if (swName) {
                const swVersion = cf.sw_version || resolveByLabel('version') || '';
                finalSummary = swVersion ? `Install software: ${swName} v${swVersion}` : `Install software: ${swName}`;
            }
        }
        if (!finalSummary && isPurchaseRequisition) {
            const cf = (customFields || {}) as Record<string, any>;
            const formConfig = (requestType?.formConfig || []) as any[];
            const resolveByLabel = (labelMatch: string): any => {
                for (const f of formConfig) {
                    if (f.label && f.label.toLowerCase().includes(labelMatch.toLowerCase())) {
                        if (cf[f.id]) return cf[f.id];
                    }
                }
                return undefined;
            };
            const itemName = cf.itemName || resolveByLabel('item') || resolveByLabel('service name') || '';
            const estimatedCost = cf.estimatedCost || resolveByLabel('estimated cost') || '';
            if (itemName) {
                const costStr = estimatedCost ? ` (RM${estimatedCost})` : '';
                finalSummary = `Purchase: ${itemName}${costStr}`;
            }
        }

        // Create request, hardware details, and initial activity in a single transaction
        const request = await prisma.$transaction(async (tx) => {
            const createdRequest = await tx.request.create({
                data: {
                    tenantId: creationPolicy.tenantId,
                    departmentId: creationPolicy.departmentId,
                    referenceNumber,
                    requestTypeId,
                    serviceDeskId,
                    requesterId: req.user!.id,
                    requesterEmail: req.user!.email,
                    summary: finalSummary,
                    description: finalDescription,
                    priority,
                    customFields,
                    isConfidential: creationPolicy.isConfidential,
                    status: initialStatus as any,
                    assignedToId: financeCeo?.id ?? esmSelectedCeo?.id,
                    slaDueAt,
                    // P5-04: Snapshot form config at submission time
                    formConfigSnapshot: creationPolicy.formConfig ?? undefined,
                    formConfigVersion: creationPolicy.formVersion ?? undefined,
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
                    // Resolve form values by field ID or by matching formConfig labels
                    // (handles both named keys like 'hardwareName' and dynamic IDs like 'field_1234')
                    const formConfig: any[] = (reqType as any).formConfig || [];
                    const resolveField = (...keys: string[]): any => {
                        for (const k of keys) { if (cf[k]) return cf[k]; }
                        return undefined;
                    };
                    const resolveByLabel = (labelMatch: string): any => {
                        for (const f of formConfig) {
                            if (f.label && f.label.toLowerCase().includes(labelMatch.toLowerCase())) {
                                if (cf[f.id]) return cf[f.id];
                            }
                        }
                        return undefined;
                    };
                    const rawPrice = resolveField('estimatedPrice') || resolveByLabel('price') || resolveByLabel('estimated');
                    const estimatedPrice = rawPrice != null && rawPrice !== '' && !isNaN(Number(rawPrice))
                        ? parseFloat(String(rawPrice))
                        : null;
                    await tx.iTHardwareRequest.create({
                        data: {
                            requestId: createdRequest.id,
                            hardwareName: resolveField('hardwareName', 'hw_name', 'hardwareType') || resolveByLabel('hardware name') || resolveByLabel('device type') || 'Unknown',
                            hardwareModel: resolveField('hardwareModel', 'hw_model', 'model') || resolveByLabel('model') || null,
                            estimatedPrice,
                            preferredVendor: resolveField('preferredVendor', 'vendor') || resolveByLabel('vendor') || null,
                            productUrl: resolveField('productUrl') || resolveByLabel('product url') || null,
                            businessJustification: resolveField('businessJustification', 'hw_reason', 'reason') || resolveByLabel('justification') || '',
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
                        message: `Onboarding workflow initialised for ${firstName} ${lastName}.`,
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

            if (isEsmTravelRequest && esmSelectedCeo) {
                await tx.requestApproval.create({
                    data: {
                        requestId: createdRequest.id,
                        approverType: 'CEO',
                        approverId: esmSelectedCeo.id,
                        status: 'PENDING',
                    },
                });

                await tx.requestActivity.create({
                    data: {
                        requestId: createdRequest.id,
                        authorName: 'System',
                        activityType: 'ASSIGNMENT',
                        message: `Travel request submitted directly to ${esmSelectedCeo.firstName} ${esmSelectedCeo.lastName} for CEO approval`,
                        isSystemGenerated: true,
                        metadata: {
                            autoAssigned: true,
                            assignedToId: esmSelectedCeo.id,
                            approverType: 'CEO',
                            source: 'esm-travel-request-create',
                        },
                    },
                });
            }

            if ((isPurchaseRequisition || isBudgetProposal) && financeCeo) {
                await tx.requestApproval.create({
                    data: {
                        requestId: createdRequest.id,
                        approverType: 'CEO',
                        approverId: financeCeo.id,
                        status: 'PENDING',
                    },
                });

                await tx.requestActivity.create({
                    data: {
                        requestId: createdRequest.id,
                        authorName: 'System',
                        activityType: 'ASSIGNMENT',
                        message: `Finance request submitted directly to ${financeCeo.firstName} ${financeCeo.lastName} for CEO approval`,
                        isSystemGenerated: true,
                        metadata: {
                            autoAssigned: true,
                            assignedToId: financeCeo.id,
                            approverType: 'CEO',
                            source: 'finance-request-create',
                        },
                    },
                });
            }

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

        // SLA: pause immediately if request is created in an approval status (e.g. EXPENSE_CLAIM → PENDING_MANAGER_APPROVAL_FIN)
        if (isExpenseClaim) {
            await pauseSla(request.id);
        }

        if (isEsmTravelRequest && esmSelectedCeo) {
            await pauseSla(request.id);
            await notify({
                userId: esmSelectedCeo.id,
                eventType: 'APPROVAL_REQUIRED',
                variables: { requestId: request.id, role: 'CEO' },
                relatedRequestId: request.id,
            });
        }

        if ((isPurchaseRequisition || isBudgetProposal) && financeCeo) {
            await pauseSla(request.id);
            await notify({
                userId: financeCeo.id,
                eventType: 'APPROVAL_REQUIRED',
                variables: { requestId: request.id, role: 'CEO' },
                relatedRequestId: request.id,
            });
        }

        // P5-07: Use approval policy engine for expense claims
        // If an active ApprovalPolicy exists for this request type, create approvals from it
        if (isExpenseClaim && requestTypeId) {
            try {
                const { approvalPolicyService } = await import('../services/approvalPolicy.service');
                const policyApprovals = await approvalPolicyService.createApprovalsFromPolicy(
                    request.id,
                    requestTypeId,
                    request.requesterId,
                );
                if (policyApprovals.length > 0) {
                    console.log(`[P5-07] Created ${policyApprovals.length} approval(s) from policy for expense claim ${request.id}`);
                }
            } catch (err) {
                // Fallback: if no policy is configured, the old hardcoded path still works
                console.log(`[P5-07] No approval policy found for expense claim ${request.id}, falling back to entity routing`);
            }
        }

        // Apply entity-based approval routing if configured for this request type
        if (requestTypeId) {
            await applyEntityRouting({
                requestId: request.id,
                requestTypeId,
                requesterId: request.requesterId,
                customFields: (customFields || {}) as Record<string, any>,
            });
        }

        // Auto-assign the request based on ServiceDesk configuration
        const assignResult = await autoAssignRequest(request.id);
        if (assignResult.success && assignResult.assignedToId) {
            // Create activity record for auto-assignment
            await prisma.requestActivity.create({
                data: {
                    requestId: request.id,
                    authorName: 'System',
                    isSystemGenerated: true,
                    activityType: 'ASSIGNMENT',
                    message: `Auto-assigned to ${assignResult.agentName} (${assignResult.assignedTeam} team) via ${assignResult.strategy} strategy`,
                    metadata: {
                        autoAssigned: true,
                        assignedToId: assignResult.assignedToId,
                        assignedTeam: assignResult.assignedTeam,
                        strategy: assignResult.strategy,
                    },
                },
            });

            // Notify the assigned agent
            await notify({
                userId: assignResult.assignedToId,
                eventType: 'REQUEST_ASSIGNED',
                variables: {
                    referenceNumber: request.referenceNumber,
                    summary: request.summary,
                },
                relatedRequestId: request.id,
            });
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

        // NOTE: We no longer send REQUEST_CREATED to the assigned agent.
        // The agent receives REQUEST_ASSIGNED separately (above), which is the appropriate
        // single-recipient notification for their role. REQUEST_CREATED is dedicated
        // to the requester only — no multi-recipient email blast.

        await auditLog(req, 'REQUEST_CREATED', 'request', request.id, {
            referenceNumber: request.referenceNumber,
            summary: request.summary,
            status: request.status,
            requesterId: request.requesterId,
        });

        // Re-fetch request to include auto-assigned agent info in response
        const finalRequest = assignResult.success || isEsmTravelRequest
            ? await prisma.request.findUnique({
                  where: { id: request.id },
                  include: {
                      requester: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
                      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
                      serviceDesk: true,
                      requestType: true,
                  },
              })
            : request;

        res.status(201).json({
            status: 'success',
            data: { request: finalRequest },
        });
    });

    /**
     * Get active workflow transitions available to the authenticated actor.
     */
    getAvailableTransitions = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const id = await resolveRequestId(String(req.params.id));
        if (!id) throw new AppError('Request not found', 404);

        const request = await prisma.request.findFirst({
            where: { id, deletedAt: null },
            select: { id: true },
        });
        if (!request) throw new AppError('Request not found', 404);

        await assertRequestAccess(req.user, request.id, { requireConfidential: true });

        const transitions = await getAvailableTransitionsForRequest(request.id, {
            userId: req.user!.id,
            roles: req.user!.roles ?? [],
            executiveRole: (req.user as any).executiveRole ?? null,
        });

        res.json({
            status: 'success',
            data: { transitions },
        });
    });

    /**
     * Get request by ID
     */
    getRequestById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const idOrRef = String(req.params.id);
        // Normalize old-format reference numbers (e.g. "IT-1" → "IT-00001")
        const normalizedRef = idOrRef.replace(/^([A-Z]+)-(\d+)$/, (_, prefix, num) =>
            `${prefix}-${num.padStart(5, '0')}`,
        );
        const lookupKey = UUID_RE.test(idOrRef) ? { id: idOrRef } : { referenceNumber: normalizedRef };

        const request = await prisma.request.findFirst({
            where: {
                ...lookupKey,
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
                    include: { attachments: { where: { deletedAt: null } } },
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
                    include: {
                        approver: {
                            select: { id: true, firstName: true, lastName: true, email: true },
                        },
                        entity: {
                            select: { id: true, name: true, code: true },
                        },
                    },
                },
                participants: {
                    select: { userId: true },
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

        // Transform BigInt to string in attachments for JSON serialization
        if ((request as any).attachments) {
            (request as any).attachments = (request as any).attachments.map((att: any) => ({
                ...att,
                fileSize: att.fileSize?.toString() ?? '0',
            }));
        }

        // Transform BigInt to string in activity attachments for JSON serialization
        if ((request as any).activities) {
            (request as any).activities = (request as any).activities.map((a: any) => ({
                ...a,
                attachments: (a.attachments || []).map((att: any) => ({
                    ...att,
                    fileSize: att.fileSize?.toString() ?? '0',
                })),
            }));
        }

        // P02-09: Use policy-based access check instead of hardcoded ADMIN/AGENT bypass.
        // assertRequestAccess enforces tenant boundary, team scope, department grant,
        // ownership, participant, designated approver, and executive role — returning 404
        // for unauthorized access to avoid leaking resource existence.
        await assertRequestAccess(req.user, request.id, {
            requireConfidential: true,
        });

        // Audit: log access to confidential requests (only for non-requesters)
        if (request.isConfidential && request.requesterId !== req.user!.id) {
            auditLog(req, 'CONFIDENTIAL_VIEW', 'request', request.id, {
                referenceNumber: request.referenceNumber,
                summary: request.summary,
            }).catch(() => {}); // fire-and-forget
        }

        // Add computed effective SLA due date (accounts for pause time)
        (request as any).effectiveSlaDueAt = getEffectiveSlaDueAt(request);
        (request as any).slaPaused = request.slaPausedAt !== null;

        res.json({
            status: 'success',
            data: { request },
        });
    });

    /**
     * Update request
     */
    updateRequest = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) throw new AppError('Request not found', 404);
        const { summary: rawSummary, description: rawDescription, priority, isConfidential, customFields: rawCustomFields } = req.body;

        // Sanitize highest-risk text fields
        const summary = rawSummary !== undefined ? sanitizeString(rawSummary) : undefined;

        const existingRequest = await prisma.request.findFirst({
            where: { id, deletedAt: null },
        });

        if (!existingRequest) {
            throw new AppError('Request not found', 404);
        }

        // Determine if this request belongs to IT desk for rich-text sanitization
        const isItDesk = existingRequest.serviceDeskId
            ? (await prisma.serviceDesk.findUnique({ where: { id: existingRequest.serviceDeskId } }))?.code === 'IT'
            : false;
        const description = rawDescription !== undefined
            ? (isItDesk ? sanitizeRichText(rawDescription) : sanitizeComment(rawDescription))
            : undefined;

        // Check permissions
        if (
            existingRequest.requesterId !== req.user!.id &&
            !req.user!.roles.includes('ADMIN') &&
            !req.user!.roles.includes('AGENT')
        ) {
            throw new AppError('You do not have permission to update this request', 403);
        }

        // Restrict isConfidential toggle:
        // - Requester can mark their own request confidential (toggle on)
        // - ADMIN can toggle on/off on any request
        // - AGENT can toggle on/off on any request
        // - No one else can change isConfidential
        let isConfidentialUpdate = isConfidential !== undefined ? { isConfidential: isConfidential === true } : {};
        if (isConfidential !== undefined && existingRequest.requesterId !== req.user!.id && !hasRole(req, 'ADMIN', 'AGENT')) {
            isConfidentialUpdate = {};
        }

        // Handle customFields update — merge with existing fields
        let customFieldsUpdate: Record<string, any> | undefined;
        if (rawCustomFields && typeof rawCustomFields === 'object') {
            // Only allow AGENT or ADMIN to update customFields
            if (!hasRole(req, 'ADMIN', 'AGENT')) {
                throw new AppError('You do not have permission to update custom fields', 403);
            }
            const existingCF = (existingRequest.customFields as Record<string, any>) || {};
            customFieldsUpdate = { ...existingCF, ...rawCustomFields };
        }

        const request = await prisma.request.update({
            where: { id },
            data: {
                summary,
                description,
                priority,
                ...isConfidentialUpdate,
                ...(customFieldsUpdate ? { customFields: customFieldsUpdate } : {}),
            },
        });

        // P2-05: Audit log for request update
        await auditLog(req, 'REQUEST_UPDATED', 'request', id, {
            referenceNumber: request.referenceNumber,
            updatedFields: Object.keys(req.body).filter(k => req.body[k] !== undefined),
        });

        res.json({
            status: 'success',
            data: { request },
        });
    });

    /**
     * Delete request (soft delete)
     */
    deleteRequest = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) throw new AppError('Request not found', 404);

        const request = await prisma.request.findFirst({
            where: { id, deletedAt: null },
        });

        if (!request) {
            throw new AppError('Request not found', 404);
        }

        // Only requester, admin, or assigned agent can delete
        const isRequester = request.requesterId === req.user!.id;
        const isAdmin = req.user!.roles.includes('ADMIN');
        const isAssignedAgent = request.assignedToId === req.user!.id;
        if (!isRequester && !isAdmin && !isAssignedAgent) {
            throw new AppError('You do not have permission to delete this request', 403);
        }

        await prisma.request.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        // P2-05: Audit log for request delete
        await auditLog(req, 'REQUEST_DELETED', 'request', id, {
            referenceNumber: request.referenceNumber,
        });

        res.json({
            status: 'success',
            message: 'Request deleted successfully',
        });
    });

    /**
     * Get request activities
     */
    getRequestActivities = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) throw new AppError('Request not found', 404);

        const request = await prisma.request.findFirst({
            where: { id, deletedAt: null },
        });

        if (!request) {
            throw new AppError('Request not found', 404);
        }

        const activities = await prisma.requestActivity.findMany({
            where: { requestId: id },
            orderBy: { createdAt: 'asc' },
            include: { attachments: { where: { deletedAt: null } } },
        });

        // Filter internal activities for non-agent/admin users
        const userRoles = req.user!.roles || [];
        const isAgentOrAdmin = userRoles.includes('ADMIN') || userRoles.includes('AGENT');
        const filteredActivities = isAgentOrAdmin
          ? activities
          : activities.filter((a: any) => !a.isInternal);

        // Transform BigInt fileSize in attachments to string for JSON serialization
        const transformed = filteredActivities.map((a: any) => ({
            ...a,
            attachments: (a.attachments || []).map((att: any) => ({
                ...att,
                fileSize: att.fileSize?.toString() ?? '0',
            })),
        }));

        res.json({
            status: 'success',
            data: { activities: transformed },
        });
    });

    /**
     * Add activity/comment to request
     */
    addActivity = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) throw new AppError('Request not found', 404);
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
        const commentVars = {
            commenterName: `${user!.firstName} ${user!.lastName}`,
            commentText: message,
        };
        if (request.requesterId !== req.user!.id) {
            await notify({
                userId: request.requesterId,
                eventType: 'COMMENT_ADDED',
                variables: commentVars,
                relatedRequestId: id,
            });
        }
        // Also notify assigned agent if they didn't write the comment
        if (request.assignedToId && request.assignedToId !== req.user!.id) {
            await notify({
                userId: request.assignedToId,
                eventType: 'COMMENT_ADDED',
                variables: commentVars,
                relatedRequestId: id,
            });
        }

        // Auto-link any pending unlinked attachments uploaded by this user for this request
        await prisma.requestAttachment.updateMany({
            where: {
                requestId: id,
                activityId: null,
                uploadedById: req.user!.id,
                deletedAt: null,
            },
            data: {
                activityId: activity.id,
            },
        });

        // Fetch the activity with linked attachments included
        const fullActivity = await prisma.requestActivity.findUnique({
            where: { id: activity.id },
            include: { attachments: { where: { deletedAt: null } } },
        });

        // Transform BigInt fileSize to string for JSON serialization
        const serializedAttachments = (fullActivity!.attachments || []).map((a: any) => ({
            ...a,
            fileSize: a.fileSize?.toString() ?? '0',
        }));

        res.status(201).json({
            status: 'success',
            data: {
                activity: {
                    ...fullActivity!,
                    attachments: serializedAttachments,
                },
            },
        });
    });

    /**
     * Upload attachment to request
     * Accepts: images (JPG/PNG/GIF/WebP), PDFs, Word docs, Excel, CSV, plain text, ZIP
     * Max size: 10MB | isScanned: false flag set for future virus scanning
     */
    uploadAttachment = asyncHandler(async (req: AuthRequest, res: Response, __next: NextFunction) => {
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) throw new AppError('Request not found', 404);

        // P2-02: Verify user has access to the parent request before allowing upload
        await assertRequestAccess(req.user!, id);

        const file = req.file;

        if (!file) {
            throw new AppError('No file uploaded', 400);
        }

        // Verify request exists (assertRequestAccess already confirmed this, but
        // we keep a lightweight check to satisfy TypeScript)
        const request = await prisma.request.findFirst({
            where: { id, deletedAt: null },
            select: { id: true, referenceNumber: true },
        });
        if (!request) {
            throw new AppError('Request not found', 404);
        }

        const { attachment } = await registerUpload({
            principal: principalFromAuth(req.user!),
            requestId: id,
            uploadedById: req.user!.id,
            file: {
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                buffer: file.buffer,
                key: (file as any).key,
            },
        });

        // Log un-scanned file for manual review (future virus scan)
        logger.info(`[UPLOAD] Unscanned file uploaded: ${attachment.id} | ${file.originalname} | ${file.mimetype} | ${(file.size / 1024).toFixed(1)}KB | by ${req.user!.email}`);

        // P2-04: Audit log for attachment upload
        await auditLog(req, 'ATTACHMENT_UPLOAD', 'request', id, {
            referenceNumber: request.referenceNumber,
            attachmentId: attachment.id,
            fileName: attachment.fileName,
            fileSize: Number(attachment.fileSize),
            mimeType: attachment.mimeType,
        });

        res.status(201).json({
            status: 'success',
            data: {
                id: attachment.id,
                fileName: attachment.fileName,
                fileSize: Number(attachment.fileSize),
                mimeType: attachment.mimeType,
                isScanned: attachment.isScanned,
                scanStatus: attachment.scanStatus,
                createdAt: attachment.createdAt,
            },
        });
    });

    /**
    /**
     * Serves the file from S3 via presigned URL redirect.
     * Sets Content-Disposition header for browser download.
     */
    downloadAttachment = asyncHandler(async (req: AuthRequest, res: Response, __next: NextFunction) => {
        const { id: idOrRef, attachmentId } = req.params as Record<string, string>;
        const id = await resolveRequestId(idOrRef);
        if (!id) throw new AppError('Request not found', 404);
        const attachmentRequest = await assertRequestAccess(req.user!, id, { action: 'download', requireConfidential: true });
        const attachment = await getAuthorizedAttachment(principalFromAuth(req.user!), attachmentId);
        if (attachment.requestId !== id) throw new AppError('Attachment not found', 404);

        // Audit: log download for confidential requests by non-requesters
        if (attachmentRequest.isConfidential && attachmentRequest.requesterId !== req.user?.id) {
            auditLog(req, 'CONFIDENTIAL_ATTACHMENT_DOWNLOAD', 'request', id, {
                referenceNumber: attachmentRequest.referenceNumber,
                attachmentId,
                fileName: attachment.fileName,
            }).catch(() => {}); // fire-and-forget — must not block the download
        }

        // P2-04: Audit all attachment downloads
        await auditLog(req, 'ATTACHMENT_DOWNLOAD', 'request', id, {
            referenceNumber: attachmentRequest.referenceNumber,
            attachmentId,
            fileName: attachment.fileName,
        });

        // storagePath now stores the S3 object key (e.g. "cwc/uuid-ext")
        const s3Key = attachment.storagePath;
        if (!s3Key) {
            throw new AppError('File key is missing', 400);
        }

        // ?inline=true renders the file inline (for iframe/img), otherwise forces download
        const isInline = req.query.inline === 'true';

        try {
            // Set appropriate headers for the response
            res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
            if (isInline) {
                res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.fileName)}"`);
            } else {
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.fileName)}"`);
            }

            // Stream the file from S3 through the backend to avoid CORS issues
            // (direct 302 redirect to S3 presigned URL fails on cross-origin XHR/fetch)
            const stream = await s3Service.streamObject(s3Key);
            stream.pipe(res);
        } catch (error: any) {
            logger.error(`[DOWNLOAD] Failed to stream file for key ${s3Key}: ${error?.message || error}`);
            throw new AppError('Could not download file', 500);
        }
    });

    /**
     * Delete attachment
     */
    deleteAttachment = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const { id: idOrRef, attachmentId } = req.params as Record<string, string>;
        const id = await resolveRequestId(idOrRef);
        if (!id) throw new AppError('Request not found', 404);

        // P2-03: Verify user has access to the parent request before allowing delete
        const attachmentRequest = await assertRequestAccess(req.user!, id);

        // Verify the attachment belongs to this request and is not already deleted
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
        if (attachment.retentionStatus === 'LEGAL_HOLD' || attachment.legalHoldAt) {
            throw new AppError('Attachment is subject to legal hold', 409);
        }

        // Only allow the uploader, the requester, the assigned agent, or an admin to delete
        const isUploader = attachment.uploadedById === req.user?.id;
        const isRequester = attachmentRequest.requesterId === req.user?.id;
        const isAssignedAgent = attachmentRequest.assignedToId === req.user?.id;
        const isAdmin = hasRole(req, 'ADMIN');

        if (!isUploader && !isRequester && !isAssignedAgent && !isAdmin) {
            throw new AppError('You do not have permission to delete this attachment', 403);
        }

        await prisma.requestAttachment.update({
            where: { id: attachmentId },
            data: { deletedAt: new Date(), retentionStatus: 'PENDING_DELETION' },
        });

        // P2-04: Audit log for attachment delete
        await auditLog(req, 'ATTACHMENT_DELETE', 'request', id, {
            referenceNumber: attachmentRequest.referenceNumber,
            attachmentId,
            fileName: attachment.fileName,
        });

        res.json({
            status: 'success',
            message: 'Attachment deleted successfully',
        });
    });

    /**
     * Assign request to agent
     */
    assignRequest = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) throw new AppError('Request not found', 404);
        const { assignedToId } = req.body;

        const existingAssignment = await prisma.request.findUnique({
            where: { id },
            select: { assignedToId: true },
        });
        const assignmentChanged = existingAssignment?.assignedToId !== (assignedToId || null);

        // Build update data and validate the target user if assigning
        const updateData: any = { assignedToId };

        if (assignedToId) {
            const targetUser = await prisma.user.findUnique({
                where: { id: assignedToId },
                select: { id: true, isActive: true, agentTeam: true, roles: { select: { role: { select: { name: true } } } } },
            });
            if (!targetUser || !targetUser.isActive) {
                throw new AppError('Cannot assign to an inactive or non-existent user.', 400);
            }
            const hasAgentRole = targetUser.roles.some(r => ['AGENT', 'ADMIN'].includes(r.role.name));
            if (!hasAgentRole) {
                throw new AppError('Cannot assign to a user without AGENT or ADMIN role.', 400);
            }
            // Derive the assigned team from the target user's team (normalized)
            updateData.assignedTeam = (targetUser.agentTeam || '').trim().toUpperCase() || null;
        } else {
            // Unassignment: clear the team too
            updateData.assignedTeam = null;
        }

        const request = await prisma.request.update({
            where: { id },
            data: updateData,
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

        if (assignmentChanged) {
            // Create activity only for a real assignment change.
            const assigneeName = request.assignedTo ? `${request.assignedTo.firstName} ${request.assignedTo.lastName}`.trim() : 'agent';
            await prisma.requestActivity.create({
                data: {
                    requestId: id,
                    authorId: req.user!.id,
                    authorName: 'System',
                    activityType: 'ASSIGNMENT',
                    message: `Request assigned to ${assigneeName}`,
                    isSystemGenerated: true,
                    metadata: {
                        autoAssigned: false,
                        assignedToId,
                    },
                },
            });

            // Notify only a newly assigned agent; unassignment has no recipient.
            if (assignedToId) {
                await notify({
                    userId: assignedToId,
                    eventType: 'REQUEST_ASSIGNED',
                    variables: {
                        referenceNumber: request.referenceNumber,
                        summary: request.summary,
                    },
                    relatedRequestId: request.id,
                });
            }
        }

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
    updateStatus = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) throw new AppError('Request not found', 404);
        const { status, comment } = req.body;

        // Fetch current request to validate transition
        const currentRequest = await prisma.request.findUnique({
            where: { id },
            include: { serviceDesk: true, requestType: { select: { workflowTypeId: true } } },
        });
        if (!currentRequest) {
            throw new AppError('Request not found', 404);
        }

        // Authorization: non-admin agents can only update requests belonging to their own service desk
        const user = req.user!;
        const isAdmin = user.roles?.includes('ADMIN');
        if (!isAdmin) {
            const userTeam = user.agentTeam?.toUpperCase() || '';
            const requestDesk = currentRequest.serviceDesk?.code?.toUpperCase() || '';
            if (userTeam && requestDesk && userTeam !== requestDesk) {
                throw new AppError('You are not authorized to update requests from another service desk', 403);
            }
        }

        // Validate transition
        const { isValidTransition } = await import('../utils/workflowTransitions');
        if (!(await isValidTransition(currentRequest.status, status, {
            tenantId: currentRequest.tenantId,
            workflowTypeId: currentRequest.requestType?.workflowTypeId ?? null,
        }))) {
            throw new AppError(`Invalid status transition from ${currentRequest.status} to ${status}`, 400);
        }

        if (['REJECTED', 'CANCELLED'].includes(status) && !String(comment || '').trim()) {
            throw new AppError(`A reason is required to mark this request as ${status.toLowerCase()}`, 400);
        }
        const sanitizedComment = comment ? sanitizeComment(String(comment)) : undefined;

        const isTerminalStatus = CLOSED_STATUSES.includes(status as RequestStatus);
        await transitionHttpRequest({
            req,
            request: currentRequest,
            toStatus: status,
            source: 'request.update-status',
            comment: sanitizedComment,
            requestPatch: {
                ...(isTerminalStatus && { closedAt: new Date() }),
                ...(status === 'COMPLETED' && { completedAt: new Date() }),
            },
        });
        const request = await prisma.request.findFirstOrThrow({
            where: { id, tenantId: currentRequest.tenantId },
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

        // Notify participants of status change
        const participantRecords = await prisma.requestParticipant.findMany({
            where: { requestId: id },
            select: { userId: true },
        });
        await Promise.all(
            participantRecords.map((p) =>
                notify({
                    userId: p.userId,
                    eventType: 'STATUS_CHANGED',
                    variables: {
                        referenceNumber: request.referenceNumber,
                        newStatus: status,
                    },
                    relatedRequestId: request.id,
                }).catch(() => {})
            )
        );


        // Auto-create RequestApproval records for PENDING_APPROVAL statuses
        // This ensures the bulkAction (Approve/Reject) endpoint can find these records
        const PENDING_APPROVAL_TYPE_MAP: Record<string, string> = {
            PENDING_CEO_APPROVAL: 'CEO',
            PENDING_CEO_APPROVAL_IT: 'CEO',
            PENDING_CEO_APPROVAL_FIN: 'CEO',
            PENDING_CTO_APPROVAL_IT: 'CTO',
            PENDING_CFO_APPROVAL_IT: 'CFO',
            PENDING_CFO_APPROVAL_FIN: 'CFO',
            PENDING_FINANCE_HEAD_APPROVAL: 'CFO',
            PENDING_GROUP_DCEO_APPROVAL: 'GROUP_DCEO',
            PENDING_MANAGER_APPROVAL_FIN: 'MANAGER',
            PENDING_MANAGER_REVIEW: 'MANAGER',
            LOA_PENDING_APPROVAL: 'HR',
            ONBOARDING_PENDING_HR_APPROVAL: 'HR',
        };

        const approvalType = PENDING_APPROVAL_TYPE_MAP[status];
        if (approvalType) {
            // Find the user with the matching role to set as approverId
            // Try executiveRole field first (for CEO, CTO, CFO, CHRO, COO), then fall back to UserRole
            const EXECUTIVE_ROLES = ['CEO', 'CTO', 'CFO', 'CHRO', 'COO'] as const;
            let approverId: string | null = null;

            if (EXECUTIVE_ROLES.includes(approvalType as any)) {
                // Try executiveRole field first, then fall back to UserRole
                const byExecRole = await prisma.user.findFirst({
                    where: { executiveRole: approvalType as any, isActive: true },
                    select: { id: true },
                });
                if (byExecRole) {
                    approverId = byExecRole.id;
                } else {
                    const byUserRole = await prisma.user.findFirst({
                        where: { isActive: true, roles: { some: { role: { name: approvalType } } } },
                        select: { id: true },
                    });
                    approverId = byUserRole?.id ?? null;
                }
            } else {
                // For non-executive roles (GROUP_DCEO, VP, MANAGER, HR), find by UserRole
                const approverUser = await prisma.user.findFirst({
                    where: {
                        isActive: true,
                        roles: { some: { role: { name: approvalType } } },
                    },
                    select: { id: true },
                });
                approverId = approverUser?.id ?? null;
            }

            // Check if an approval record already exists for this request+type+PENDING
            const existingApproval = await prisma.requestApproval.findFirst({
                where: {
                    requestId: id,
                    approverType: approvalType,
                    status: 'PENDING',
                },
            });

            if (!existingApproval) {
                await prisma.requestApproval.create({
                    data: {
                        requestId: id,
                        approverType: approvalType,
                        approverId,
                        status: 'PENDING',
                    },
                });
            }
        }

        // ── WorkflowTransition auto-assign: reassign based on transition config ──
        try {
            const transition = await prisma.workflowTransition.findFirst({
                where: {
                    fromStatus: currentRequest.status,
                    toStatus: status,
                    isActive: true,
                },
            });

            if (transition && (transition.autoAssignRole || transition.autoAssignUserId)) {
                let assignToId: string | null = null;
                let assignToName: string = '';

                if (transition.autoAssignUserId) {
                    // Specific user takes priority
                    const targetUser = await prisma.user.findUnique({
                        where: { id: transition.autoAssignUserId },
                        select: { id: true, firstName: true, lastName: true, isActive: true },
                    });
                    if (targetUser?.isActive) {
                        assignToId = targetUser.id;
                        assignToName = `${targetUser.firstName} ${targetUser.lastName}`;
                    }
                } else if (transition.autoAssignRole) {
                    // Find first active user with the matching role
                    const targetUser = await prisma.user.findFirst({
                        where: {
                            isActive: true,
                            roles: { some: { role: { name: transition.autoAssignRole } } },
                        },
                        select: { id: true, firstName: true, lastName: true },
                        orderBy: { createdAt: 'asc' },
                    });
                    if (targetUser) {
                        assignToId = targetUser.id;
                        assignToName = `${targetUser.firstName} ${targetUser.lastName}`;
                    }
                }

                if (assignToId && currentRequest.assignedToId !== assignToId) {
                    await prisma.request.update({
                        where: { id },
                        data: { assignedToId: assignToId },
                    });

                    await prisma.requestActivity.create({
                        data: {
                            requestId: id,
                            authorId: req.user!.id,
                            authorName: 'System',
                            activityType: 'ASSIGNMENT',
                            message: `Auto-reassigned to ${assignToName} via workflow transition (${currentRequest.status} → ${status})`,
                            isSystemGenerated: true,
                            metadata: {
                                autoAssigned: true,
                                assignedToId: assignToId,
                                transitionId: transition.id,
                                fromStatus: currentRequest.status,
                                toStatus: status,
                                trigger: transition.autoAssignUserId ? 'autoAssignUserId' : 'autoAssignRole',
                                triggerValue: transition.autoAssignUserId || transition.autoAssignRole,
                            },
                        },
                    });

                    await notify({
                        userId: assignToId,
                        eventType: 'REQUEST_ASSIGNED',
                        variables: {
                            referenceNumber: request.referenceNumber,
                            assignedToName: assignToName,
                        },
                        relatedRequestId: request.id,
                    });

                    logger.info(`[WorkflowTransition] Request ${request.referenceNumber} auto-reassigned to ${assignToName} on ${currentRequest.status}→${status}`);
                }
            }
        } catch (err) {
            // Non-blocking: if transition auto-assign fails, status change still succeeds
            logger.error(`[WorkflowTransition] Auto-assign failed for request ${id}:`, err);
        }

        // Re-fetch request after workflow transition auto-assign to include updated assignedToId
        const finalRequest = await prisma.request.findUnique({
            where: { id },
            include: {
                requester: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
                assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
                serviceDesk: true,
                requestType: true,
            },
        });

        res.json({
            status: 'success',
            data: { request: finalRequest || request },
        });
    });

    /**
     * Get recently used request types for the current user.
     * Returns the top 5 request types the user has submitted most often.
     */
    recentServices = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const userId = req.user!.id;
        const limit = Math.min(parseInt(req.query.limit as string) || 5, 20);

        // Group the user's requests by requestTypeId, count them, and return top N
        const grouped = await prisma.request.groupBy({
            by: ['requestTypeId'],
            where: {
                requesterId: userId,
                deletedAt: null,
                requestTypeId: { not: null },
            },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: limit,
        });

        const typeIds = grouped.map(g => g.requestTypeId!).filter(Boolean);
        if (typeIds.length === 0) {
            res.json({ status: 'success', data: [] });
            return;
        }

        const types = await prisma.requestType.findMany({
            where: { id: { in: typeIds } },
            select: {
                id: true, name: true, icon: true, description: true, serviceCategoryId: true,
                serviceCategory: { select: { serviceDesk: { select: { id: true, code: true } } } },
            },
        });

        const typeMap = new Map(types.map(t => [t.id, t]));

        const data = grouped
            .filter(g => g.requestTypeId && typeMap.has(g.requestTypeId))
            .map(g => {
                const t = typeMap.get(g.requestTypeId!)!;
                const { serviceCategory, ...rest } = t as any;
                return {
                    ...rest,
                    deskId: serviceCategory?.serviceDesk?.id ?? null,
                    deskCode: serviceCategory?.serviceDesk?.code ?? null,
                    count: g._count.id,
                };
            });

        res.json({ status: 'success', data });
    });
}

export const requestController = new RequestController();
