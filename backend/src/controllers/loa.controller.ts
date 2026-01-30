import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Upload LOA document
 * POST /requests/:id/loa/upload
 */
export const uploadLOA = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.id;
        const file = (req as any).file;

        if (!file) {
            return res.status(400).json({
                status: 'error',
                message: 'LOA file is required'
            });
        }

        // Get the request
        const request = await prisma.request.findUnique({
            where: { id },
            include: { hrScreening: true }
        });

        if (!request) {
            return res.status(404).json({
                status: 'error',
                message: 'Request not found'
            });
        }

        if (request.status !== 'HR_SCREENING' && request.status !== 'LOA_PENDING_APPROVAL') {
            return res.status(400).json({
                status: 'error',
                message: 'Request must be in HR_SCREENING or LOA_PENDING_APPROVAL status to upload LOA'
            });
        }

        // Verify screening is completed
        if (!request.hrScreening || request.hrScreening.overallStatus !== 'COMPLETED') {
            return res.status(400).json({
                status: 'error',
                message: 'HR screening must be completed before uploading LOA'
            });
        }

        // Create LOA record
        const loa = await prisma.letterOfAcceptance.create({
            data: {
                requestId: id,
                loaFileUrl: file.path,
                loaFileName: file.originalname,
                loaFileSize: file.size,
                uploadedBy: userId
            },
            include: {
                uploadedByUser: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });

        // Create activity log
        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName,
                authorRole: 'HR Agent',
                activityType: 'ATTACHMENT',
                message: `Letter of Acceptance uploaded: ${file.originalname}`,
                isSystemGenerated: false
            }
        });

        res.json({
            status: 'success',
            data: loa
        });
    } catch (error) {
        console.error('Error uploading LOA:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to upload LOA'
        });
    }
};

/**
 * Route LOA for manager approval
 * POST /requests/:id/loa/route-for-approval
 */
export const routeLOAForApproval = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { comments } = req.body;
        const userId = (req as any).user?.id;

        // Get the request and LOA
        const request = await prisma.request.findUnique({
            where: { id },
            include: {
                letterOfAcceptance: true,
                requester: true
            }
        });

        if (!request) {
            return res.status(404).json({
                status: 'error',
                message: 'Request not found'
            });
        }

        if (request.status !== 'HR_SCREENING' && request.status !== 'LOA_PENDING_APPROVAL') {
            return res.status(400).json({
                status: 'error',
                message: 'Request must be in HR_SCREENING or LOA_PENDING_APPROVAL status to route LOA for approval'
            });
        }

        if (!request.letterOfAcceptance) {
            return res.status(400).json({
                status: 'error',
                message: 'LOA must be uploaded before routing for approval'
            });
        }

        // Update request status
        const updatedRequest = await prisma.request.update({
            where: { id },
            data: { status: 'LOA_PENDING_APPROVAL' }
        });

        // Create activity log
        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName,
                authorRole: 'HR Agent',
                activityType: 'SYSTEM',
                message: `LOA routed to ${request.requester.firstName} ${request.requester.lastName} (Hiring Manager) for approval${comments ? ': ' + comments : ''}`,
                isSystemGenerated: true
            }
        });

        res.json({
            status: 'success',
            data: { request: updatedRequest }
        });
    } catch (error) {
        console.error('Error routing LOA for approval:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to route LOA for approval'
        });
    }
};

/**
 * Manager approve or reject LOA
 * POST /requests/:id/loa/manager-approve
 */
export const managerApproveLOA = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { decision, comments } = req.body;
        const userId = (req as any).user?.id;

        if (!decision || !['APPROVE', 'REJECT'].includes(decision)) {
            return res.status(400).json({
                status: 'error',
                message: 'Decision must be either APPROVE or REJECT'
            });
        }

        // Get the request and LOA
        const request = await prisma.request.findUnique({
            where: { id },
            include: { letterOfAcceptance: true }
        });

        if (!request) {
            return res.status(404).json({
                status: 'error',
                message: 'Request not found'
            });
        }

        if (request.status !== 'LOA_PENDING_APPROVAL') {
            return res.status(400).json({
                status: 'error',
                message: 'Request must be in LOA_PENDING_APPROVAL status'
            });
        }

        // Verify user is the hiring manager (requester)
        if (request.requesterId !== userId) {
            return res.status(403).json({
                status: 'error',
                message: 'Only the hiring manager can approve or reject LOA'
            });
        }

        if (!request.letterOfAcceptance) {
            return res.status(404).json({
                status: 'error',
                message: 'LOA not found'
            });
        }

        // Update LOA record
        const updatedLOA = await prisma.letterOfAcceptance.update({
            where: { id: request.letterOfAcceptance.id },
            data: {
                approvedBy: decision === 'APPROVE' ? userId : null,
                approvalDate: decision === 'APPROVE' ? new Date() : null,
                approvalComments: comments || null
            }
        });

        // Update request status
        const newStatus = decision === 'APPROVE' ? 'LOA_APPROVED' : 'HR_SCREENING';
        const updatedRequest = await prisma.request.update({
            where: { id },
            data: { status: newStatus }
        });

        // Create activity log
        const activityMessage = decision === 'APPROVE'
            ? `Hiring Manager approved LOA${comments ? ': ' + comments : ''}`
            : `Hiring Manager rejected LOA${comments ? ': ' + comments : ''}`;

        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName,
                authorRole: 'Hiring Manager',
                activityType: decision === 'APPROVE' ? 'APPROVAL' : 'REJECTION',
                message: activityMessage,
                isSystemGenerated: false
            }
        });

        res.json({
            status: 'success',
            data: {
                request: updatedRequest,
                loa: updatedLOA
            }
        });
    } catch (error) {
        console.error('Error processing LOA approval:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to process LOA approval'
        });
    }
};

/**
 * Mark LOA as issued to candidate
 * POST /requests/:id/loa/mark-issued
 */
export const markLOAIssued = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        const userId = (req as any).user?.id;

        // Get the request and LOA
        const request = await prisma.request.findUnique({
            where: { id },
            include: { letterOfAcceptance: true }
        });

        if (!request) {
            return res.status(404).json({
                status: 'error',
                message: 'Request not found'
            });
        }

        if (request.status !== 'LOA_APPROVED') {
            return res.status(400).json({
                status: 'error',
                message: 'Request must be in LOA_APPROVED status to mark as issued'
            });
        }

        if (!request.letterOfAcceptance || !request.letterOfAcceptance.approvedBy) {
            return res.status(400).json({
                status: 'error',
                message: 'LOA must be approved before marking as issued'
            });
        }

        // Update LOA record
        const updatedLOA = await prisma.letterOfAcceptance.update({
            where: { id: request.letterOfAcceptance.id },
            data: {
                issuedDate: new Date()
            }
        });

        // Update request status
        const updatedRequest = await prisma.request.update({
            where: { id },
            data: { status: 'LOA_ISSUED' }
        });

        // Create activity log
        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName,
                authorRole: 'HR Agent',
                activityType: 'SYSTEM',
                message: `LOA issued to candidate${notes ? ': ' + notes : ''}`,
                isSystemGenerated: true
            }
        });

        res.json({
            status: 'success',
            data: {
                request: updatedRequest,
                loa: updatedLOA
            }
        });
    } catch (error) {
        console.error('Error marking LOA as issued:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to mark LOA as issued'
        });
    }
};

/**
 * Upload signed LOA from candidate
 * POST /requests/:id/loa/upload-signed
 */
export const uploadSignedLOA = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.id;
        const file = (req as any).file;

        if (!file) {
            return res.status(400).json({
                status: 'error',
                message: 'Signed LOA file is required'
            });
        }

        // Get the request and LOA
        const request = await prisma.request.findUnique({
            where: { id },
            include: { letterOfAcceptance: true }
        });

        if (!request) {
            return res.status(404).json({
                status: 'error',
                message: 'Request not found'
            });
        }

        if (request.status !== 'LOA_ISSUED') {
            return res.status(400).json({
                status: 'error',
                message: 'Request must be in LOA_ISSUED status to upload signed LOA'
            });
        }

        if (!request.letterOfAcceptance) {
            return res.status(404).json({
                status: 'error',
                message: 'LOA not found'
            });
        }

        // Update LOA record with signed file
        const updatedLOA = await prisma.letterOfAcceptance.update({
            where: { id: request.letterOfAcceptance.id },
            data: {
                signedLoaFileUrl: file.path,
                signedLoaFileName: file.originalname,
                signedLoaFileSize: file.size
            }
        });

        // Create activity log
        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName,
                authorRole: 'HR Agent',
                activityType: 'ATTACHMENT',
                message: `Signed LOA uploaded: ${file.originalname}`,
                isSystemGenerated: false
            }
        });

        res.json({
            status: 'success',
            data: updatedLOA
        });
    } catch (error) {
        console.error('Error uploading signed LOA:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to upload signed LOA'
        });
    }
};

/**
 * Mark LOA as accepted (final step)
 * POST /requests/:id/loa/mark-accepted
 */
export const markLOAAccepted = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        const userId = (req as any).user?.id;

        // Get the request and LOA
        const request = await prisma.request.findUnique({
            where: { id },
            include: { letterOfAcceptance: true }
        });

        if (!request) {
            return res.status(404).json({
                status: 'error',
                message: 'Request not found'
            });
        }

        if (request.status !== 'LOA_ISSUED') {
            return res.status(400).json({
                status: 'error',
                message: 'Request must be in LOA_ISSUED status to mark as accepted'
            });
        }

        if (!request.letterOfAcceptance || !request.letterOfAcceptance.signedLoaFileUrl) {
            return res.status(400).json({
                status: 'error',
                message: 'Signed LOA must be uploaded before marking as accepted'
            });
        }

        // Update LOA record
        const updatedLOA = await prisma.letterOfAcceptance.update({
            where: { id: request.letterOfAcceptance.id },
            data: {
                acceptedDate: new Date()
            }
        });

        // Update request status to final state
        const updatedRequest = await prisma.request.update({
            where: { id },
            data: {
                status: 'RESOLVED',
                resolvedAt: new Date()
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
                message: `LOA accepted - Hiring process complete!${notes ? ' ' + notes : ''}`,
                isSystemGenerated: true
            }
        });

        res.json({
            status: 'success',
            data: {
                request: updatedRequest,
                loa: updatedLOA
            }
        });
    } catch (error) {
        console.error('Error marking LOA as accepted:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to mark LOA as accepted'
        });
    }
};

/**
 * Get LOA details
 * GET /requests/:id/loa
 */
export const getLOADetails = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const loa = await prisma.letterOfAcceptance.findUnique({
            where: { requestId: id },
            include: {
                uploadedByUser: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                approvedByUser: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });

        res.json({
            status: 'success',
            data: loa
        });
    } catch (error) {
        console.error('Error getting LOA details:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get LOA details'
        });
    }
};
