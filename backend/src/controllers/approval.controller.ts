import { Request, Response } from 'express';
import { ApprovalStatus } from '@prisma/client';
import { auditLog } from '../utils/audit';
import { notify } from '../services/notification.service';
import { allEntityApprovalsResolved } from '../services/entityRouting.service';
import { reassignToTeam } from '../services/reassign.service';
import { pauseSla, resumeSla } from '../services/sla-pause.service';

import prisma from '../utils/prisma';
import { resolveRequestId } from '../utils/resolve';

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

/**
 * Route request to CEO for approval
 * POST /requests/:id/route-to-ceo
 */
export const routeToCEO = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }
        const { comments, ceoId } = req.body;
        const userId = (req as any).user?.id;

        // Get the request
        const request = await prisma.request.findUnique({
            where: { id },
            include: { requester: true }
        });

        if (!request) {
            res.status(404).json({
                status: 'error',
                message: 'Request not found'
            });
            return;
        }

        // Verify request is in correct status
        if (request.status !== 'SUBMITTED' && request.status !== 'IN_REVIEW') {
            res.status(400).json({
                status: 'error',
                message: 'Request must be in SUBMITTED or IN_REVIEW status to route to CEO'
            });
            return;
        }

        // Update request status and assign to CEO
        const updateData: any = { status: 'PENDING_CEO_APPROVAL' };
        if (ceoId) {
            updateData.assignedToId = ceoId;
        }

        const updatedRequest = await prisma.request.update({
            where: { id },
            data: updateData
        });

        // Create approval record
        const approval = await prisma.requestApproval.create({
            data: {
                requestId: id,
                approverType: 'CEO',
                approverId: ceoId || null,
                status: ApprovalStatus.PENDING,
                comments: comments || null
            }
        });

        // Resolve CEO display name for activity log
        let ceoDisplayName = 'CEO';
        if (ceoId) {
            const ceoUser = await prisma.user.findUnique({ where: { id: ceoId } });
            if (ceoUser) ceoDisplayName = `${ceoUser.firstName} ${ceoUser.lastName}`;
        }

        // Create activity log
        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName,
                authorRole: 'HR Agent',
                activityType: 'ASSIGNMENT',
                message: `Request routed to CEO for approval — assigned to ${ceoDisplayName}${comments ? ': ' + comments : ''}`,
                isSystemGenerated: true
            }
        });

        await auditLog(req as any, 'APPROVAL_ROUTED', 'request', id, {
            status: 'PENDING_CEO_APPROVAL',
            previousStatus: request.status,
            approverType: 'CEO',
        ceoId: ceoId || null,
    }, { status: request.status });

    await pauseSla(id);

    if (ceoId) {
        await notify({ userId: ceoId, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'CEO' }, relatedRequestId: id });
    }

    res.json({
        status: 'success',
        data: {
                request: updatedRequest,
                approval
            }
        });
    } catch (error) {
        console.error('Error routing to CEO:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to route request to CEO'
        });
    }
};

/**
 * CEO approve or reject request
 * POST /requests/:id/ceo-decision
 */
export const ceoDecision = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }
        const { decision, comments } = req.body; // decision: 'APPROVED' | 'REJECTED'
        const userId = (req as any).user?.id;

        if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
            res.status(400).json({
                status: 'error',
                message: 'Decision must be either APPROVED or REJECTED'
            });
            return;
        }

        // Get the request and pending approval
        const request = await prisma.request.findUnique({
            where: { id },
            include: {
                requester: true,
                approvals: {
                    where: {
                        approverType: 'CEO',
                        status: ApprovalStatus.PENDING
                    }
                }
            }
        });

        if (!request) {
            res.status(404).json({
                status: 'error',
                message: 'Request not found'
            });
            return;
        }

        if (request.status !== 'PENDING_CEO_APPROVAL') {
            res.status(400).json({
                status: 'error',
                message: 'Request is not pending CEO approval'
            });
            return;
        }

        const pendingApproval = request.approvals[0];
        if (!pendingApproval) {
            res.status(404).json({
                status: 'error',
                message: 'No pending approval found'
            });
            return;
        }

        const authCheck = await assertDesignatedApprover(userId, pendingApproval, 'CEO');
        if (!authCheck.ok) {
            res.status(403).json({ status: 'error', message: authCheck.message });
            return;
        }

        // Update approval record
        const updatedApproval = await prisma.requestApproval.update({
            where: { id: pendingApproval.id },
            data: {
                status: decision as ApprovalStatus,
                approverId: userId,
                comments: comments || null
            }
        });

        // Update request status and reassign back to the original HR agent
        const newStatus = decision === 'APPROVED' ? 'CEO_APPROVED' : 'CEO_REJECTED';
        const updateData: any = { status: newStatus };

        // Reassign back to HR agent — use shared reassignToTeam (no entity-scoping, sets assignedToId + assignedTeam, logs + notifies)
        if (decision !== 'APPROVED') {
          // On rejection, reassign back to HR team immediately
          await reassignToTeam(id, request.referenceNumber, 'HR', 'HR-Approval');
        }

        // When CEO approves, auto-advance to Group Deputy CEO for HR hiring workflow
        if (decision === 'APPROVED') {
            const groupDceo = await prisma.user.findFirst({
                where: { executiveRole: 'GROUP_DCEO', isActive: true }
            });
            if (groupDceo) {
                updateData.status = 'PENDING_GROUP_DCEO_APPROVAL';
                updateData.assignedToId = groupDceo.id;

                // Create Group Deputy CEO approval record
                await prisma.requestApproval.create({
                    data: {
                        requestId: id,
                        approverType: 'GROUP_DCEO',
                        approverId: groupDceo.id,
                        status: ApprovalStatus.PENDING,
                        comments: null
                    }
                });

                // Activity log for auto-routing
                await prisma.requestActivity.create({
                    data: {
                        requestId: id,
                        authorId: userId,
                        authorName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName,
                        authorRole: 'CEO',
                        activityType: 'ASSIGNMENT',
                        message: `Request auto-routed to Group Deputy CEO (${groupDceo.firstName} ${groupDceo.lastName}) after CEO approval`,
                        isSystemGenerated: true
                    }
                });

                // Notify Group Deputy CEO
                await notify({
                    userId: groupDceo.id,
                    eventType: 'APPROVAL_REQUIRED',
                    variables: { requestId: id, role: 'GROUP_DCEO' },
                    relatedRequestId: id,
                });
            }
        }

        const updatedRequest = await prisma.request.update({
            where: { id },
            data: updateData
        });

        // Create activity log
        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName,
                authorRole: 'CEO',
                activityType: decision === 'APPROVED' ? 'APPROVAL' : 'REJECTION',
                message: `CEO ${decision.toLowerCase()} this request${comments ? ': ' + comments : ''}`,
                isSystemGenerated: false
            }
        });

        // (reassignToTeam already logs the HR reassignment activity)

        await auditLog(req as any, 'APPROVAL_DECISION', 'request', id, {
            decision,
            approverType: 'CEO',
            newStatus,
        comments: comments || null,
    }, { status: 'PENDING_CEO_APPROVAL' });

    // Only resume SLA if not auto-advancing to another pause status (Group Deputy CEO approval)
    if (decision !== 'APPROVED' || updateData.status === 'CEO_APPROVED') {
        await resumeSla(id);
    }

    // Notify requester of CEO decision
    if (decision === 'APPROVED') {
        await notify({
            userId: request.requesterId,
            eventType: 'STATUS_CHANGED',
            variables: { requestId: id, status: 'CEO_APPROVED', message: 'Your hiring request has been approved by the CEO.' },
            relatedRequestId: id,
        });
    } else {
        await notify({
            userId: request.requesterId,
            eventType: 'REQUEST_REJECTED',
            variables: { requestId: id, rejectedBy: 'CEO', comments: comments || '' },
            relatedRequestId: id,
        });
    }

    res.json({
        status: 'success',
        data: {
                request: updatedRequest,
                approval: updatedApproval
            }
        });
    } catch (error) {
        console.error('Error processing CEO decision:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to process CEO decision'
        });
    }
};

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

        const updatedRequest = await prisma.request.update({
            where: { id },
            data: {
                status: 'JOB_POSTED',
                customFields
            }
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
        const updatedRequest = await prisma.request.update({
            where: { id },
            data: {
                status: 'PENDING_MANAGER_REVIEW',
                assignedToId: request.requesterId // Assign to original requester
            }
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

    await pauseSla(id);

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
                        status: ApprovalStatus.PENDING
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

        const pendingApproval = request.approvals[0];
        if (!pendingApproval) {
            res.status(404).json({
                status: 'error',
                message: 'No pending approval found'
            });
            return;
        }

        // Update approval record
        const updatedApproval = await prisma.requestApproval.update({
            where: { id: pendingApproval.id },
            data: {
                status: decision as ApprovalStatus,
                comments: comments || null
            }
        });

        // Update request status
        const newStatus = decision === 'APPROVED' ? 'MANAGER_APPROVED' : 'IN_REVIEW';

        // Reassign back to HR agent — use shared reassignToTeam (no entity-scoping, sets assignedToId + assignedTeam, logs + notifies)
        await reassignToTeam(id, request.referenceNumber, 'HR', 'HR-Approval');

        // Store selected candidates in customFields
        const customFields = request.customFields as any || {};
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

        const updateData: any = {
            status: newStatus,
            customFields
        };

        const updatedRequest = await prisma.request.update({
            where: { id },
            data: updateData
        });

        // Create activity log
        const candidateSummary = candidateIds.length > 0
            ? ` (${candidateIds.length} candidate${candidateIds.length > 1 ? 's' : ''} selected)`
            : '';
        const activityMessage = decision === 'APPROVED'
            ? `Hiring Manager approved candidate selection${candidateSummary}${comments ? ': ' + comments : ''}`
            : `Hiring Manager requested changes${comments ? ': ' + comments : ''}`;

        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName,
                authorRole: 'Hiring Manager',
                activityType: decision === 'APPROVED' ? 'APPROVAL' : 'REJECTION',
                message: activityMessage,
                isSystemGenerated: false
            }
        });

        // (reassignToTeam already logs the HR reassignment activity and sends notification)

        await auditLog(req as any, 'APPROVAL_DECISION', 'request', id, {
            decision,
            approverType: 'HIRING_MANAGER',
            newStatus,
            selectedCandidateIds: candidateIds,
    }, { status: request.status });

    await resumeSla(id);

        res.json({
            status: 'success',
            data: {
                request: updatedRequest,
                approval: updatedApproval
            }
        });
    } catch (error) {
        console.error('Error processing manager decision:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to process manager decision'
        });
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
                await prisma.request.update({
                    where: { id: approval.requestId },
                    data: { status: 'REJECTED' },
                });
            } else if (allApproved) {
                await prisma.request.update({
                    where: { id: approval.requestId },
                    data: { status: 'APPROVED' },
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

/**
 * Route HR hiring request to Group Deputy CEO for approval
 * POST /approvals/requests/:id/route-to-group-dceo-hr
 */
export const routeToGroupDceoHr = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }
        const { comments, groupDceoId } = req.body;
        const userId = (req as any).user?.id;

        const request = await prisma.request.findUnique({
            where: { id },
            include: { requester: true }
        });

        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (request.status !== 'CEO_APPROVED' && request.status !== 'SUBMITTED' && request.status !== 'IN_REVIEW') {
            res.status(400).json({ status: 'error', message: 'Request must be in SUBMITTED, IN_REVIEW, or CEO_APPROVED status to route to Group Deputy CEO' });
            return;
        }

        // Find Group Deputy CEO user — use provided ID or auto-detect
        let groupDceo;
        if (groupDceoId) {
            groupDceo = await prisma.user.findFirst({
                where: { id: groupDceoId, isActive: true }
            });
        }
        if (!groupDceo) {
            groupDceo = await prisma.user.findFirst({
                where: { executiveRole: 'GROUP_DCEO', isActive: true }
            });
        }

        if (!groupDceo) {
            res.status(404).json({ status: 'error', message: 'No active Group Deputy CEO found' });
            return;
        }

        // Update request status and assign to Group Deputy CEO
        const updatedRequest = await prisma.request.update({
            where: { id },
            data: {
                status: 'PENDING_GROUP_DCEO_APPROVAL',
                assignedToId: groupDceo.id
            }
        });

        // Create approval record
        const approval = await prisma.requestApproval.create({
            data: {
                requestId: id,
                approverType: 'GROUP_DCEO',
                approverId: groupDceo.id,
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
                message: `Request routed to Group Deputy CEO for approval — assigned to ${groupDceo.firstName} ${groupDceo.lastName}${comments ? ': ' + comments : ''}`,
                isSystemGenerated: true
            }
        });

        await auditLog(req as any, 'APPROVAL_ROUTED', 'request', id, {
            status: 'PENDING_GROUP_DCEO_APPROVAL',
            previousStatus: request.status,
            approverType: 'GROUP_DCEO',
            groupDceoId: groupDceo.id,
        }, { status: request.status });

        await pauseSla(id);

        // Notify Group Deputy CEO
        await notify({ userId: groupDceo.id, eventType: 'APPROVAL_REQUIRED', variables: { requestId: id, role: 'Group Deputy CEO' }, relatedRequestId: id });

        res.json({
            status: 'success',
            data: { request: updatedRequest, approval }
        });
    } catch (error) {
        console.error('Error routing to Group Deputy CEO:', error);
        res.status(500).json({ status: 'error', message: 'Failed to route request to Group Deputy CEO' });
    }
};

/**
 * Group Deputy CEO approve or reject HR hiring request
 * POST /approvals/requests/:id/group-dceo-decision-hr
 */
export const groupDceoDecisionHr = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }
        const { decision, comments } = req.body;
        const userId = (req as any).user?.id;

        if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
            res.status(400).json({ status: 'error', message: 'Decision must be either APPROVED or REJECTED' });
            return;
        }

        const request = await prisma.request.findUnique({
            where: { id },
            include: {
                approvals: {
                    where: { approverType: 'GROUP_DCEO', status: ApprovalStatus.PENDING }
                }
            }
        });

        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        if (request.status !== 'PENDING_GROUP_DCEO_APPROVAL') {
            res.status(400).json({ status: 'error', message: 'Request is not pending Group Deputy CEO approval' });
            return;
        }

        const pendingApproval = request.approvals[0];
        if (!pendingApproval) {
            res.status(404).json({ status: 'error', message: 'No pending Group Deputy CEO approval found' });
            return;
        }

        const authCheck = await assertDesignatedApprover(userId, pendingApproval, 'GROUP_DCEO');
        if (!authCheck.ok) {
            res.status(403).json({ status: 'error', message: authCheck.message });
            return;
        }

        const newStatus = decision === 'APPROVED' ? 'GROUP_DCEO_APPROVED' : 'GROUP_DCEO_REJECTED';

        // Reassign back to HR agent — use shared reassignToTeam (no entity-scoping, sets assignedToId + assignedTeam, logs + notifies)
        await reassignToTeam(id, request.referenceNumber, 'HR', 'HR-Approval');

        const updateData: any = { status: newStatus };

        const updatedRequest = await prisma.request.update({
            where: { id },
            data: updateData
        });
        // Update approval record
        const updatedApproval = await prisma.requestApproval.update({
            where: { id: pendingApproval.id },
            data: {
                status: decision as ApprovalStatus,
                approverId: userId,
                comments: comments || null
            }
        });

        // Create activity log
        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName,
                authorRole: 'Group Deputy CEO',
                activityType: decision === 'APPROVED' ? 'APPROVAL' : 'REJECTION',
                message: `Group Deputy CEO ${decision.toLowerCase()} this request${comments ? ': ' + comments : ''}`,
                isSystemGenerated: false
            }
        });

        // (reassignToTeam already logs the HR reassignment activity)

        await auditLog(req as any, 'APPROVAL_DECISION', 'request', id, {
            decision,
            approverType: 'GROUP_DCEO',
            newStatus,
            previousStatus: 'PENDING_GROUP_DCEO_APPROVAL',
            comments: comments || null,
        }, { status: 'PENDING_GROUP_DCEO_APPROVAL' });

        await resumeSla(id);

        // Notify requester
        if (decision === 'APPROVED') {
            await notify({
                userId: request.requesterId,
                eventType: 'STATUS_CHANGED',
                variables: { requestId: id, status: 'GROUP_DCEO_APPROVED', message: 'Your hiring request has been approved by the Group Deputy CEO.' },
                relatedRequestId: id,
            });
        } else {
            await notify({
                userId: request.requesterId,
                eventType: 'REQUEST_REJECTED',
                variables: { requestId: id, rejectedBy: 'Group Deputy CEO', comments: comments || '' },
                relatedRequestId: id,
            });
        }

        res.json({
            status: 'success',
            data: { request: updatedRequest, approval: updatedApproval }
        });
    } catch (error) {
        console.error('Error processing Group Deputy CEO decision:', error);
        res.status(500).json({ status: 'error', message: 'Failed to process Group Deputy CEO decision' });
    }
};