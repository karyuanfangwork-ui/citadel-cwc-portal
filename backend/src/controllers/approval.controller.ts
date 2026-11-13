import { Request, Response } from 'express';
import { ApprovalStatus, HrExecutiveApproverRole } from '@prisma/client';
import { AppError } from '../middleware/error.middleware';
import { resolveHrExecutiveApprover } from '../services/hrExecutiveApprover.service';
import { auditLog } from '../utils/audit';
import { notify } from '../services/notification.service';
import { allEntityApprovalsResolved } from '../services/entityRouting.service';

import prisma from '../utils/prisma';
import { resolveRequestId } from '../utils/resolve';
import { transitionHttpRequest } from '../utils/httpRequestTransition';

/**
 * Verify that `userId` is allowed to act as the approver on a pending executive
 * approval step: either the explicitly assigned approver, an ADMIN, or — when the
 * approval was routed generically with no assigned approverId — a user holding the
 * matching executiveRole.
 */
export async function assertDesignatedApprover(
    userId: string,
    pendingApproval: { approverId: string | null },
    requiredExecutiveRole: 'CEO' | 'GROUP_DCEO'
): Promise<{ ok: true } | { ok: false; message: string }> {
    if (pendingApproval.approverId === userId) {
        return { ok: true };
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { role: true } } },
    });

    const isAdmin = user?.roles?.some((r: any) => r.role?.name === 'ADMIN') ?? false;
    if (isAdmin) {
        return { ok: true };
    }

    if (!pendingApproval.approverId && user?.executiveRole === requiredExecutiveRole) {
        return { ok: true };
    }

    const roleLabel = requiredExecutiveRole === 'GROUP_DCEO' ? 'Group Deputy CEO' : requiredExecutiveRole;
    return { ok: false, message: `You are not the designated ${roleLabel} approver for this request` };
}

/** HR executive choice is authoritative; never fall back to another executive. */
async function chosenExecutive(request: any, role: 'CEO' | 'GROUP_DCEO', suppliedId?: string) {
    if (!request.executiveApproverId || !request.executiveApproverRole) {
        throw new AppError('Requester must select an executive approver before routing', 409);
    }
    if (request.executiveApproverRole !== role || (suppliedId && suppliedId !== request.executiveApproverId)) {
        throw new AppError('Executive route conflicts with requester-selected approver', 409);
    }
    await resolveHrExecutiveApprover({
        executiveApproverId: request.executiveApproverId,
        executiveApproverRole: role as HrExecutiveApproverRole,
        tenantId: request.tenantId,
        requesterId: request.requesterId,
    });
    return request.executiveApproverId as string;
}

function approvalFailure(res: Response, error: unknown, message: string) {
    if (error instanceof AppError) {
        res.status(error.statusCode).json({ status: 'error', message: error.message, ...(error.details ? { details: error.details } : {}) });
    } else {
        console.error(message, error);
        res.status(500).json({ status: 'error', message });
    }
}

async function routeHrExecutive(req: Request, res: Response, role: 'CEO' | 'GROUP_DCEO') {
    try {
        const actor = (req as any).user;
        if (!actor?.roles?.some((r: string) => r === 'AGENT' || r === 'ADMIN') ||
            (!actor.roles.includes('ADMIN') && actor.agentTeam?.trim().toUpperCase() !== 'HR')) {
            throw new AppError('Only HR agents may route hiring requests', 403);
        }
        const id = await resolveRequestId(String(req.params.id));
        if (!id) throw new AppError('Request not found', 404);
        const request = await prisma.request.findUnique({ where: { id }, include: { requestType: true } });
        if (!request || !actor.tenantId || request.tenantId !== actor.tenantId) throw new AppError('Request not found', 404);
        if (request.requestType?.code !== 'NEW_HIRING') throw new AppError('Executive routing is only available for HR new hiring requests', 400);
        if (request.status !== 'SUBMITTED' && request.status !== 'IN_REVIEW') throw new AppError('Request must be SUBMITTED or IN_REVIEW before executive routing', 409);
        const suppliedId = role === 'CEO' ? req.body.ceoId : req.body.groupDceoId;
        const approverId = await chosenExecutive(request, role, suppliedId);
        const userId = actor.id;
        const { comments } = req.body;
        const toStatus = role === 'CEO' ? 'PENDING_CEO_APPROVAL' : 'PENDING_GROUP_DCEO_APPROVAL';
        let approval: any;
        const updatedRequest = await transitionHttpRequest({
            req, request, toStatus, source: role === 'CEO' ? 'approval.route-to-ceo' : 'approval.route-to-group-dceo',
            comment: comments, requestPatch: { assignedToId: approverId }, skipAutoAssignment: true,
            transactionMutations: async (tx) => {
                approval = await tx.requestApproval.create({ data: {
                    requestId: id, approverType: role, approverId, status: ApprovalStatus.PENDING, comments: comments || null,
                } });
                await tx.requestActivity.create({ data: {
                    requestId: id, authorId: userId,
                    authorName: `${(req as any).user?.firstName || ''} ${(req as any).user?.lastName || ''}`.trim(),
                    authorRole: 'HR Agent', activityType: 'ASSIGNMENT',
                    message: `Request routed to ${role === 'CEO' ? 'CEO' : 'Group Deputy CEO'} for approval${comments ? ': ' + comments : ''}`,
                    isSystemGenerated: true,
                } });
            },
        });
        // Workflow command commits audit and durable notification intent.
        res.json({ status: 'success', data: { request: updatedRequest, approval } });
    } catch (error) { approvalFailure(res, error, 'Failed to route executive approval'); }
}

export const routeToCEO = (req: Request, res: Response) => routeHrExecutive(req, res, 'CEO');

async function decideHrExecutive(req: Request, res: Response, role: 'CEO' | 'GROUP_DCEO') {
    try {
        const id = await resolveRequestId(String(req.params.id));
        if (!id) throw new AppError('Request not found', 404);
        const { decision, comments } = req.body;
        if (decision !== 'APPROVED' && decision !== 'REJECTED') throw new AppError('Decision must be either APPROVED or REJECTED', 400);
        const userId = (req as any).user?.id;
        const request = await prisma.request.findUnique({ where: { id }, include: {
            requestType: true, approvals: { where: { approverType: role, status: ApprovalStatus.PENDING } },
        } });
        if (!request || !(req as any).user?.tenantId || request.tenantId !== (req as any).user.tenantId) throw new AppError('Request not found', 404);
        if (request.requestType?.code !== 'NEW_HIRING') throw new AppError('Executive decision is only available for HR new hiring requests', 400);
        const pendingStatus = role === 'CEO' ? 'PENDING_CEO_APPROVAL' : 'PENDING_GROUP_DCEO_APPROVAL';
        if (request.status !== pendingStatus) throw new AppError('Request is not pending this executive approval', 409);
        const approverId = await chosenExecutive(request, role);
        const pendingApproval = request.approvals[0];
        if (!pendingApproval) throw new AppError('No pending executive approval found', 409);
        if (userId !== approverId || pendingApproval.approverId !== approverId) throw new AppError('You are not the requester-selected executive approver', 403);
        // Reassignment is part of the status command, not a prior side effect.
        const hrAgent = await prisma.user.findFirst({ where: {
            tenantId: request.tenantId, agentTeam: 'HR', isActive: true,
            roles: { some: { role: { name: { in: ['AGENT', 'ADMIN'] } } } },
        }, select: { id: true }, orderBy: { createdAt: 'asc' } });
        const newStatus = `${role}_${decision}`;
        let approval: any;
        const updatedRequest = await transitionHttpRequest({
            req, request, toStatus: newStatus, source: role === 'CEO' ? 'approval.ceo-decision' : 'approval.group-dceo-decision',
            comment: comments, requestPatch: { assignedToId: hrAgent?.id ?? null, assignedTeam: 'HR' }, skipAutoAssignment: true,
            transactionMutations: async (tx) => {
                const claimed = await tx.requestApproval.updateMany({ where: {
                    id: pendingApproval.id, requestId: id, approverId, approverType: role, status: ApprovalStatus.PENDING,
                }, data: { status: decision as ApprovalStatus, comments: comments || null } });
                if (claimed.count !== 1) throw new AppError('Executive approval has already been decided', 409);
                approval = { ...pendingApproval, status: decision, comments: comments || null };
                await tx.requestActivity.create({ data: {
                    requestId: id, authorId: userId,
                    authorName: `${(req as any).user?.firstName || ''} ${(req as any).user?.lastName || ''}`.trim(),
                    authorRole: role === 'CEO' ? 'CEO' : 'Group Deputy CEO',
                    activityType: decision === 'APPROVED' ? 'APPROVAL' : 'REJECTION',
                    message: `${role === 'CEO' ? 'CEO' : 'Group Deputy CEO'} ${decision.toLowerCase()} this request${comments ? ': ' + comments : ''}`,
                    isSystemGenerated: false,
                } });
            },
        });
        // Requester/participant status notification is delivered by the outbox.
        res.json({ status: 'success', data: { request: updatedRequest, approval } });
    } catch (error) { approvalFailure(res, error, 'Failed to process executive decision'); }
}

export const ceoDecision = (req: Request, res: Response) => decideHrExecutive(req, res, 'CEO');

/**
 * Mark request as job posted
 * POST /requests/:id/mark-job-posted
 */
export const markJobPosted = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }
        const { jobPostingUrl, notes } = req.body;
        const userId = (req as any).user?.id;

        // Get the request
        const request = await prisma.request.findUnique({
            where: { id }
        });

        if (!request) {
            res.status(404).json({
                status: 'error',
                message: 'Request not found'
            });
            return;
        }

        if (request.status !== 'CEO_APPROVED' && request.status !== 'GROUP_DCEO_APPROVED') {
            res.status(400).json({
                status: 'error',
                message: 'Request must be CEO or Group Deputy CEO approved before marking as job posted'
            });
            return;
        }

        // Update request status and add job posting info to customFields
        const customFields = request.customFields as any || {};
        customFields.jobPostingUrl = jobPostingUrl;
        customFields.jobPostingNotes = notes;
        customFields.jobPostedAt = new Date().toISOString();

        const updatedRequest = await transitionHttpRequest({
            req,
            request,
            toStatus: 'JOB_POSTED',
            source: 'approval.mark-job-posted',
            comment: notes,
            requestPatch: { customFields },
        });

        // Create activity log
        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName,
                authorRole: 'HR Agent',
                activityType: 'SYSTEM',
                message: `Job posted${jobPostingUrl ? ': ' + jobPostingUrl : ''}`,
                isSystemGenerated: true
            }
        });

        res.json({
            status: 'success',
            data: { request: updatedRequest }
        });
    } catch (error) {
        console.error('Error marking job as posted:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to mark job as posted'
        });
    }
};

/**
 * Route request to hiring manager for review
 * POST /requests/:id/route-to-manager
 */
export const routeToManager = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }
        const { comments } = req.body;
        const userId = (req as any).user?.id;

        // Get the request with resumes
        const request = await prisma.request.findUnique({
            where: { id },
            include: {
                candidateResumes: true,
                requester: true
            }
        });

        if (!request) {
            res.status(404).json({
                status: 'error',
                message: 'Request not found'
            });
            return;
        }

        if (request.status !== 'JOB_POSTED') {
            res.status(400).json({
                status: 'error',
                message: 'Request must be in JOB_POSTED status to route to manager'
            });
            return;
        }

        // Check 3-doc completeness per candidate
        const candidates = await prisma.candidate.findMany({
            where: { requestId: id },
            include: { documents: true },
        });

        if (candidates.length === 0) {
            res.status(400).json({
                status: 'error',
                message: 'At least one candidate must be uploaded before routing to manager'
            });
            return;
        }

        const missingDocs: string[] = [];
        for (const cand of candidates) {
            const presentTypes = new Set(cand.documents.map(d => d.documentType));
            const missing = ['RESUME', 'CERTIFICATE', 'TRANSCRIPT'].filter(t => !presentTypes.has(t));
            if (missing.length > 0) {
                missingDocs.push(`${cand.fullName}: missing ${missing.join(', ')}`);
            }
        }
        if (missingDocs.length > 0) {
            res.status(400).json({
                status: 'error',
                message: `All documents required before routing to manager: ${missingDocs.join('; ')}`
            });
            return;
        }

        // Update request status and assign to requester (hiring manager)
        const updatedRequest = await transitionHttpRequest({
            req,
            request,
            toStatus: 'PENDING_MANAGER_REVIEW',
            source: 'approval.route-to-manager',
            comment: comments,
            requestPatch: { assignedToId: request.requesterId },
        });

        // Create approval record for hiring manager
        const approval = await prisma.requestApproval.create({
            data: {
                requestId: id,
                approverType: 'HIRING_MANAGER',
                approverId: request.requesterId,
                status: ApprovalStatus.PENDING,
                comments: comments || null
            }
        });

        // Create activity log
        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName,
                authorRole: 'HR Agent',
                activityType: 'ASSIGNMENT',
                message: `Request routed to ${request.requester.firstName} ${request.requester.lastName} (Hiring Manager) for candidate review. ${candidates.length} candidate(s) submitted.${comments ? ' ' + comments : ''}`,
                isSystemGenerated: true
            }
        });

        await auditLog(req as any, 'APPROVAL_ROUTED', 'request', id, {
            status: 'PENDING_MANAGER_REVIEW',
            previousStatus: request.status,
            approverType: 'HIRING_MANAGER',
            hiringManagerId: request.requesterId,
        }, { status: request.status });

    // Notify the hiring manager (requester) that the request is now assigned to them for review
    await notify({
        userId: request.requesterId,
        eventType: 'REQUEST_ASSIGNED',
        variables: { referenceNumber: request.referenceNumber, assignedToName: `${request.requester.firstName} ${request.requester.lastName}` },
        relatedRequestId: id,
    });

    // Transform BigInt to string in serialized data for JSON serialization
        res.json({
            status: 'success',
            data: {
                request: updatedRequest,
                approval
            }
        });
    } catch (error) {
        console.error('Error routing to manager:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to route request to hiring manager'
        });
    }
};

/**
 * Hiring manager approve or request changes
 * POST /requests/:id/manager-decision
 */
export const managerDecision = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }
        const { decision, selectedCandidateIds, selectedCandidateId, comments } = req.body;
        const userId = (req as any).user?.id;

        if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
            res.status(400).json({
                status: 'error',
                message: 'Decision must be either APPROVED or REJECTED'
            });
            return;
        }

        // Normalize: accept both new array format and legacy single-ID format
        let candidateIds: string[] = [];
        if (Array.isArray(selectedCandidateIds) && selectedCandidateIds.length > 0) {
            candidateIds = selectedCandidateIds;
        } else if (selectedCandidateId) {
            candidateIds = [selectedCandidateId];
        }

        // Validate: if approved, must select 1-3 candidates
        if (decision === 'APPROVED') {
            if (candidateIds.length === 0) {
                res.status(400).json({
                    status: 'error',
                    message: 'At least 1 candidate must be selected when approving'
                });
                return;
            }
            if (candidateIds.length > 3) {
                res.status(400).json({
                    status: 'error',
                    message: 'Maximum 3 candidates can be selected for interview'
                });
                return;
            }
        }

        // Get the request
        const request = await prisma.request.findUnique({
            where: { id },
            include: {
                approvals: {
                    where: {
                        approverType: 'HIRING_MANAGER',
                    }
                },
                candidateResumes: true,
                candidates: {
                    include: {
                        documents: true,
                    }
                },
                requester: true
            }
        });

        if (!request) {
            res.status(404).json({
                status: 'error',
                message: 'Request not found'
            });
            return;
        }

        if (request.status !== 'PENDING_MANAGER_REVIEW') {
            res.status(400).json({
                status: 'error',
                message: 'Request is not pending manager review'
            });
            return;
        }

        // Verify user is the hiring manager (requester)
        if (request.requesterId !== userId) {
            res.status(403).json({
                status: 'error',
                message: 'Only the hiring manager can make this decision'
            });
            return;
        }
        const actorRoles: string[] = (req as any).user?.roles || [];
        if (!actorRoles.includes('HIRING_MANAGER')) {
            res.status(403).json({ status: 'error', message: 'Only a Hiring Manager can make this decision' });
            return;
        }

        // Validate that all selected candidate IDs exist in the request's Candidate records
        if (candidateIds.length > 0) {
            const validCandidateIds = request.candidates.map((c: any) => c.id);
            const invalidIds = candidateIds.filter(cid => !validCandidateIds.includes(cid));
            if (invalidIds.length > 0) {
                res.status(400).json({
                    status: 'error',
                    message: `Invalid candidate IDs: ${invalidIds.join(', ')}`
                });
                return;
            }
        }

        const pendingApproval = request.approvals.find((approval: any) =>
            approval.status === ApprovalStatus.PENDING && approval.approverId === userId
        );
        // A prior version could persist APPROVED before the status transition
        // failed. Recover only while the request is still pending review and
        // only for the same authenticated hiring manager.
        const recoverableApproval = !pendingApproval ? request.approvals.find((approval: any) =>
            approval.status === ApprovalStatus.APPROVED && approval.approverId === userId
        ) : null;
        const decisionApproval = pendingApproval || recoverableApproval;
        if (!decisionApproval) {
            res.status(409).json({ status: 'error', message: 'No pending hiring-manager approval is assigned to you' });
            return;
        }

        const newStatus = decision === 'APPROVED' ? 'MANAGER_APPROVED' : 'IN_REVIEW';

        // Store selected candidates in customFields
        const customFields = { ...((request.customFields as any) || {}) };
        if (decision === 'APPROVED' && candidateIds.length > 0) {
            // New array format
            customFields.selectedCandidateIds = candidateIds;
            const selectedNames = candidateIds
                .map(cid => {
                    const candidate = request.candidates.find((c: any) => c.id === cid);
                    return candidate?.fullName || 'Unknown Candidate';
                });
            customFields.selectedCandidateNames = selectedNames;
            // Legacy single-value compat (first selected candidate)
            customFields.selectedCandidateId = candidateIds[0];
            customFields.selectedCandidateName = selectedNames[0] || 'Unknown Candidate';
        }

        const hrAgent = await prisma.user.findFirst({
            where: {
                tenantId: request.tenantId,
                agentTeam: 'HR',
                isActive: true,
                roles: { some: { role: { name: { in: ['AGENT', 'ADMIN'] } } } },
            },
            select: { id: true, firstName: true, lastName: true },
            orderBy: { createdAt: 'asc' },
        });
        const requestPatch: Record<string, unknown> = {
            customFields,
            ...(hrAgent ? { assignedToId: hrAgent.id, assignedTeam: 'HR' } : {}),
        };
        const updatedApproval = {
            ...decisionApproval,
            status: decision as ApprovalStatus,
            approverId: userId,
            comments: comments || null,
        };
        const candidateSummary = candidateIds.length > 0
            ? ` (${candidateIds.length} candidate${candidateIds.length > 1 ? 's' : ''} selected)`
            : '';
        const activityMessage = decision === 'APPROVED'
            ? `Hiring Manager approved candidate selection${candidateSummary}${comments ? ': ' + comments : ''}`
            : `Hiring Manager requested changes${comments ? ': ' + comments : ''}`;

        const updatedRequest = await transitionHttpRequest({
            req,
            request,
            toStatus: newStatus,
            source: 'approval.manager-decision',
            comment: comments,
            requestPatch,
            skipAutoAssignment: true,
            transactionMutations: async (tx: any) => {
                const changed = await tx.requestApproval.updateMany({
                    where: {
                        id: decisionApproval.id,
                        approverId: userId,
                        status: decisionApproval.status,
                    },
                    data: {
                        status: decision as ApprovalStatus,
                        approverId: userId,
                        comments: comments || null,
                    },
                });
                if (changed.count !== 1) {
                    throw new AppError('Hiring-manager approval was already processed; refresh and try again', 409);
                }
                await tx.requestActivity.create({
                    data: {
                        requestId: id,
                        authorId: userId,
                        authorName: `${(req as any).user?.firstName || ''} ${(req as any).user?.lastName || ''}`.trim(),
                        authorRole: 'Hiring Manager',
                        activityType: decision === 'APPROVED' ? 'APPROVAL' : 'REJECTION',
                        message: activityMessage,
                        isSystemGenerated: false,
                    },
                });
                if (hrAgent && request.assignedToId !== hrAgent.id) {
                    await tx.requestActivity.create({
                        data: {
                            requestId: id,
                            authorId: userId,
                            authorName: 'System',
                            authorRole: 'HR Agent',
                            activityType: 'ASSIGNMENT',
                            message: `Request reassigned to ${hrAgent.firstName} ${hrAgent.lastName} (HR team) after Hiring Manager decision`,
                            isSystemGenerated: true,
                        },
                    });
                }
            },
        });

        if (hrAgent && request.assignedToId !== hrAgent.id) {
            try {
                await notify({
                    userId: hrAgent.id,
                    eventType: 'REQUEST_ASSIGNED',
                    variables: { referenceNumber: request.referenceNumber, assignedToName: `${hrAgent.firstName} ${hrAgent.lastName}` },
                    relatedRequestId: id,
                });
            } catch (notificationError) {
                console.error('Failed to notify HR assignee after manager decision:', notificationError);
            }
        }

        await auditLog(req as any, 'APPROVAL_DECISION', 'request', id, {
            decision,
            approverType: 'HIRING_MANAGER',
            newStatus,
            selectedCandidateIds: candidateIds,
    }, { status: request.status });

        res.json({
            status: 'success',
            data: {
                request: updatedRequest,
                approval: updatedApproval
            }
        });
    } catch (error) {
        approvalFailure(res, error, 'Failed to process manager decision');
    }
};

/**
 * Entity approver approve or reject request
 * POST /requests/:id/entity-decision
 */
export const entityDecision = async (req: Request, res: Response) => {
    try {
        const { approvalId, decision, comments } = req.body;
        const userId = (req as any).user?.id;

        if (!approvalId) {
            res.status(400).json({
                status: 'error',
                message: 'approvalId is required'
            });
            return;
        }

        if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
            res.status(400).json({
                status: 'error',
                message: 'Decision must be either APPROVED or REJECTED'
            });
            return;
        }

        // Fetch the approval record
        const approval = await prisma.requestApproval.findUnique({
            where: { id: approvalId },
        });

        if (!approval) {
            res.status(404).json({
                status: 'error',
                message: 'Approval record not found'
            });
            return;
        }

        const approvalRequest = await prisma.request.findUnique({ where: { id: approval.requestId } });
        if (!approvalRequest) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (approval.approverType !== 'ENTITY') {
            res.status(400).json({
                status: 'error',
                message: 'This endpoint is only for entity approvals'
            });
            return;
        }

        if (approval.status !== ApprovalStatus.PENDING) {
            res.status(400).json({
                status: 'error',
                message: 'Approval has already been processed'
            });
            return;
        }

        // Verify the user is the designated approver for this entity
        if (approval.approverId !== userId) {
            // Also allow admins to approve
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { roles: { include: { role: true } } },
            });
            const isAdmin = user?.roles?.some((r: any) => r.role?.name === 'ADMIN') ?? false;
            if (!isAdmin) {
                res.status(403).json({
                    status: 'error',
                    message: 'You are not the designated approver for this entity'
                });
                return;
            }
        }

        // Update the approval record
        const updatedApproval = await prisma.requestApproval.update({
            where: { id: approvalId },
            data: {
                status: decision as ApprovalStatus,
                comments: comments || null,
            },
        });

        // Check if all entity approvals are resolved
        if (approval.approverType === 'ENTITY') {
            const { allApproved, anyRejected } = await allEntityApprovalsResolved(approval.requestId);
            if (anyRejected) {
                await transitionHttpRequest({
                    req,
                    request: approvalRequest,
                    toStatus: 'REJECTED',
                    source: 'approval.entity-decision',
                    comment: comments || 'Entity approval rejected',
                });
            } else if (allApproved) {
                await transitionHttpRequest({
                    req,
                    request: approvalRequest,
                    toStatus: 'APPROVED',
                    source: 'approval.entity-decision',
                    comment: comments,
                });
            }
        }

        // Create activity log
        await prisma.requestActivity.create({
            data: {
                requestId: approval.requestId,
                authorId: userId,
                authorName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName,
                authorRole: 'Entity Approver',
                activityType: decision === 'APPROVED' ? 'APPROVAL' : 'REJECTION',
                message: `Entity approver ${decision.toLowerCase()} this request${comments ? ': ' + comments : ''}`,
                isSystemGenerated: false,
            },
        });

        await auditLog(req as any, 'APPROVAL_DECISION', 'request', approval.requestId, {
            decision,
            approverType: 'ENTITY',
            approvalId,
            comments: comments || null,
        }, { status: decision });

        const updatedRequest = await prisma.request.findUnique({
            where: { id: approval.requestId },
        });

        res.json({
            status: 'success',
            data: {
                request: updatedRequest,
                approval: updatedApproval,
            }
        });
    } catch (error) {
        console.error('Error processing entity decision:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to process entity decision'
        });
    }
};

/** Route the saved Group DCEO choice directly; CEO approval is not a prerequisite. */
export const routeToGroupDceoHr = (req: Request, res: Response) => routeHrExecutive(req, res, 'GROUP_DCEO');

/** Resolve the sole Group DCEO decision and return ownership to HR. */
export const groupDceoDecisionHr = (req: Request, res: Response) => decideHrExecutive(req, res, 'GROUP_DCEO');
