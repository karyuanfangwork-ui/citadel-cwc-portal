import { Request, Response } from 'express';
import { PrismaClient, ApprovalStatus } from '@prisma/client';
import { auditLog } from '../utils/audit';
import { notify } from '../services/notification.service';
import { allEntityApprovalsResolved } from '../services/entityRouting.service';
import { pauseSla, resumeSla } from '../services/sla-pause.service';

const prisma = new PrismaClient();

/**
 * Route request to CEO for approval
 * POST /requests/:id/route-to-ceo
 */
export const routeToCEO = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
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

        // Update request status
        const updatedRequest = await prisma.request.update({
            where: { id },
            data: { status: 'PENDING_CEO_APPROVAL' }
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

        // Create activity log
        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName,
                authorRole: 'HR Agent',
                activityType: 'SYSTEM',
                message: `Request routed to CEO for approval${comments ? ': ' + comments : ''}`,
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
        const id = String(req.params.id);
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

        // Update approval record
        const updatedApproval = await prisma.requestApproval.update({
            where: { id: pendingApproval.id },
            data: {
                status: decision as ApprovalStatus,
                approverId: userId,
                comments: comments || null
            }
        });

        // Update request status
        const newStatus = decision === 'APPROVED' ? 'CEO_APPROVED' : 'CEO_REJECTED';
        const updatedRequest = await prisma.request.update({
            where: { id },
            data: { status: newStatus }
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

        await auditLog(req as any, 'APPROVAL_DECISION', 'request', id, {
            decision,
            approverType: 'CEO',
            newStatus,
        comments: comments || null,
    }, { status: 'PENDING_CEO_APPROVAL' });

    await resumeSla(id);

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
        const id = String(req.params.id);
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

        if (request.status !== 'CEO_APPROVED') {
            res.status(400).json({
                status: 'error',
                message: 'Request must be CEO approved before marking as job posted'
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
        const id = String(req.params.id);
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

        if ((request as any).candidateResumes.length === 0) {
            res.status(400).json({
                status: 'error',
                message: 'At least one candidate resume must be uploaded before routing to manager'
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
                message: `Request routed to ${request.requester.firstName} ${request.requester.lastName} (Hiring Manager) for candidate review. ${(request as any).candidateResumes.length} candidate(s) submitted.${comments ? ' ' + comments : ''}`,
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

    // Transform BigInt to string in candidateResumes for JSON serialization
        const serializedResumes = (request as any).candidateResumes.map((resume: any) => ({
            ...resume,
            fileSize: resume.fileSize.toString()
        }));

        res.json({
            status: 'success',
            data: {
                request: { ...updatedRequest, candidateResumes: serializedResumes },
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
        const id = String(req.params.id);
        const { decision, selectedCandidateId, comments } = req.body;
        const userId = (req as any).user?.id;

        if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
            res.status(400).json({
                status: 'error',
                message: 'Decision must be either APPROVED or REJECTED'
            });
            return;
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
                candidateResumes: true
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

        // If approved and candidate selected, store in customFields
        const customFields = request.customFields as any || {};
        if (decision === 'APPROVED' && selectedCandidateId) {
            const selectedCandidate = (request as any).candidateResumes.find((r: any) => r.id === selectedCandidateId);
            if (selectedCandidate) {
                customFields.selectedCandidateId = selectedCandidateId;
                customFields.selectedCandidateName = selectedCandidate.candidateName || 'Unknown Candidate';
            }
        }

        const updatedRequest = await prisma.request.update({
            where: { id },
            data: {
                status: newStatus,
                customFields
            }
        });

        // Create activity log
        const activityMessage = decision === 'APPROVED'
            ? `Hiring Manager approved candidate selection${comments ? ': ' + comments : ''}`
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

        await auditLog(req as any, 'APPROVAL_DECISION', 'request', id, {
            decision,
            approverType: 'HIRING_MANAGER',
            newStatus,
            selectedCandidateId: selectedCandidateId || null,
        comments: comments || null,
    }, { status: request.status });

    await resumeSla(id);

        // Transform BigInt to string in candidateResumes for JSON serialization
        const serializedResumes = (updatedRequest as any).candidateResumes?.map((resume: any) => ({
            ...resume,
            fileSize: resume.fileSize.toString()
        })) || [];

        res.json({
            status: 'success',
            data: {
                request: { ...updatedRequest, candidateResumes: serializedResumes },
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