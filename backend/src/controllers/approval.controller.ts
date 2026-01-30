import { Request, Response } from 'express';
import { PrismaClient, ApprovalStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Route request to CEO for approval
 * POST /requests/:id/route-to-ceo
 */
export const routeToCEO = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { comments } = req.body;
        const userId = (req as any).user?.id;

        // Get the request
        const request = await prisma.request.findUnique({
            where: { id },
            include: { requester: true }
        });

        if (!request) {
            return res.status(404).json({
                status: 'error',
                message: 'Request not found'
            });
        }

        // Verify request is in correct status
        if (request.status !== 'SUBMITTED' && request.status !== 'IN_REVIEW') {
            return res.status(400).json({
                status: 'error',
                message: 'Request must be in SUBMITTED or IN_REVIEW status to route to CEO'
            });
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
        const { id } = req.params;
        const { decision, comments } = req.body; // decision: 'APPROVED' | 'REJECTED'
        const userId = (req as any).user?.id;

        if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
            return res.status(400).json({
                status: 'error',
                message: 'Decision must be either APPROVED or REJECTED'
            });
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
            return res.status(404).json({
                status: 'error',
                message: 'Request not found'
            });
        }

        if (request.status !== 'PENDING_CEO_APPROVAL') {
            return res.status(400).json({
                status: 'error',
                message: 'Request is not pending CEO approval'
            });
        }

        const pendingApproval = request.approvals[0];
        if (!pendingApproval) {
            return res.status(404).json({
                status: 'error',
                message: 'No pending approval found'
            });
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
        const { id } = req.params;
        const { jobPostingUrl, notes } = req.body;
        const userId = (req as any).user?.id;

        // Get the request
        const request = await prisma.request.findUnique({
            where: { id }
        });

        if (!request) {
            return res.status(404).json({
                status: 'error',
                message: 'Request not found'
            });
        }

        if (request.status !== 'CEO_APPROVED') {
            return res.status(400).json({
                status: 'error',
                message: 'Request must be CEO approved before marking as job posted'
            });
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
        const { id } = req.params;
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
            return res.status(404).json({
                status: 'error',
                message: 'Request not found'
            });
        }

        if (request.status !== 'JOB_POSTED') {
            return res.status(400).json({
                status: 'error',
                message: 'Request must be in JOB_POSTED status to route to manager'
            });
        }

        if (request.candidateResumes.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'At least one candidate resume must be uploaded before routing to manager'
            });
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
                message: `Request routed to ${request.requester.firstName} ${request.requester.lastName} (Hiring Manager) for candidate review. ${request.candidateResumes.length} candidate(s) submitted.${comments ? ' ' + comments : ''}`,
                isSystemGenerated: true
            }
        });

        // Transform BigInt to string in candidateResumes for JSON serialization
        if ((updatedRequest as any).candidateResumes) {
            (updatedRequest as any).candidateResumes = (updatedRequest as any).candidateResumes.map((resume: any) => ({
                ...resume,
                fileSize: resume.fileSize.toString()
            }));
        }

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
        const { id } = req.params;
        const { decision, selectedCandidateId, comments } = req.body;
        const userId = (req as any).user?.id;

        if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
            return res.status(400).json({
                status: 'error',
                message: 'Decision must be either APPROVED or REJECTED'
            });
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
            return res.status(404).json({
                status: 'error',
                message: 'Request not found'
            });
        }

        if (request.status !== 'PENDING_MANAGER_REVIEW') {
            return res.status(400).json({
                status: 'error',
                message: 'Request is not pending manager review'
            });
        }

        // Verify user is the hiring manager (requester)
        if (request.requesterId !== userId) {
            return res.status(403).json({
                status: 'error',
                message: 'Only the hiring manager can make this decision'
            });
        }

        const pendingApproval = request.approvals[0];
        if (!pendingApproval) {
            return res.status(404).json({
                status: 'error',
                message: 'No pending approval found'
            });
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
            const selectedCandidate = request.candidateResumes.find(r => r.id === selectedCandidateId);
            if (selectedCandidate) {
                customFields.selectedCandidateId = selectedCandidateId;
                customFields.selectedCandidateName = selectedCandidate.candidateName;
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

        // Transform BigInt to string in candidateResumes for JSON serialization
        if ((updatedRequest as any).candidateResumes) {
            (updatedRequest as any).candidateResumes = updatedRequest.candidateResumes.map((resume: any) => ({
                ...resume,
                fileSize: resume.fileSize.toString()
            }));
        }

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
