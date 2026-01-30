import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Start HR screening (background and reference checks)
 * POST /requests/:id/start-screening
 */
export const startHRScreening = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        const userId = (req as any).user?.id;

        // Get the request and interview feedback
        const request = await prisma.request.findUnique({
            where: { id },
            include: {
                interviewFeedback: true
            }
        });

        if (!request) {
            return res.status(404).json({
                status: 'error',
                message: 'Request not found'
            });
        }

        if (request.status !== 'INTERVIEW_FEEDBACK_PENDING') {
            return res.status(400).json({
                status: 'error',
                message: 'Request must be in INTERVIEW_FEEDBACK_PENDING status to start screening'
            });
        }

        // Verify interview feedback exists and decision is PROCEED
        if (!request.interviewFeedback || request.interviewFeedback.decision !== 'PROCEED') {
            return res.status(400).json({
                status: 'error',
                message: 'Interview feedback must indicate PROCEED before starting screening'
            });
        }

        // Create HR screening record
        const hrScreening = await prisma.hRScreening.create({
            data: {
                requestId: id,
                backgroundCheckStatus: 'PENDING',
                referencesCheckStatus: 'PENDING',
                overallStatus: 'IN_PROGRESS',
                completedBy: userId
            },
            include: {
                completedByUser: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });

        // Update request status
        const updatedRequest = await prisma.request.update({
            where: { id },
            data: { status: 'HR_SCREENING' }
        });

        // Create activity log
        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName,
                authorRole: 'HR Agent',
                activityType: 'SYSTEM',
                message: `HR screening started - background and reference checks initiated${notes ? ': ' + notes : ''}`,
                isSystemGenerated: true
            }
        });

        res.json({
            status: 'success',
            data: {
                request: updatedRequest,
                hrScreening
            }
        });
    } catch (error) {
        console.error('Error starting HR screening:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to start HR screening'
        });
    }
};

/**
 * Update HR screening status
 * PUT /requests/:id/screening
 */
export const updateScreeningStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const {
            backgroundCheckStatus,
            backgroundCheckNotes,
            referencesCheckStatus,
            referencesCheckNotes,
            referencesContacted
        } = req.body;
        const userId = (req as any).user?.id;

        // Get the request and screening
        const request = await prisma.request.findUnique({
            where: { id },
            include: {
                hrScreening: true
            }
        });

        if (!request) {
            return res.status(404).json({
                status: 'error',
                message: 'Request not found'
            });
        }

        if (!request.hrScreening) {
            return res.status(404).json({
                status: 'error',
                message: 'HR screening not found'
            });
        }

        // Determine overall status
        let overallStatus = 'IN_PROGRESS';
        if (backgroundCheckStatus === 'COMPLETED' && referencesCheckStatus === 'COMPLETED') {
            overallStatus = 'COMPLETED';
        } else if (backgroundCheckStatus === 'FAILED' || referencesCheckStatus === 'FAILED') {
            overallStatus = 'ISSUES_FOUND';
        }

        // Update screening record
        const updatedScreening = await prisma.hRScreening.update({
            where: { id: request.hrScreening.id },
            data: {
                backgroundCheckStatus: backgroundCheckStatus || request.hrScreening.backgroundCheckStatus,
                backgroundCheckNotes: backgroundCheckNotes || request.hrScreening.backgroundCheckNotes,
                referencesCheckStatus: referencesCheckStatus || request.hrScreening.referencesCheckStatus,
                referencesCheckNotes: referencesCheckNotes || request.hrScreening.referencesCheckNotes,
                referencesContacted: referencesContacted ? JSON.stringify(referencesContacted) : request.hrScreening.referencesContacted,
                overallStatus,
                completedBy: userId
            },
            include: {
                completedByUser: {
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
                activityType: 'SYSTEM',
                message: `HR screening updated - Background: ${backgroundCheckStatus || 'unchanged'}, References: ${referencesCheckStatus || 'unchanged'}`,
                isSystemGenerated: true
            }
        });

        res.json({
            status: 'success',
            data: {
                hrScreening: updatedScreening
            }
        });
    } catch (error) {
        console.error('Error updating screening status:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update screening status'
        });
    }
};

/**
 * Get HR screening details
 * GET /requests/:id/screening
 */
export const getScreeningDetails = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const hrScreening = await prisma.hRScreening.findUnique({
            where: { requestId: id },
            include: {
                completedByUser: {
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
            data: {
                hrScreening
            }
        });
    } catch (error) {
        console.error('Error getting screening details:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get screening details'
        });
    }
};
