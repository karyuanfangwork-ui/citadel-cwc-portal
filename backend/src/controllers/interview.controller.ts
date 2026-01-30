import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Schedule interview with candidate
 * POST /requests/:id/schedule-interview
 */
export const scheduleInterview = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const {
            candidateId,
            interviewDate,
            interviewTime,
            location,
            meetingLink,
            interviewers,
            notes
        } = req.body;
        const userId = (req as any).user?.id;

        // Validate required fields
        if (!candidateId || !interviewDate || !interviewTime) {
            return res.status(400).json({
                status: 'error',
                message: 'Candidate ID, interview date, and time are required'
            });
        }

        // Get the request
        const request = await prisma.request.findUnique({
            where: { id },
            include: { candidateResumes: true }
        });

        if (!request) {
            return res.status(404).json({
                status: 'error',
                message: 'Request not found'
            });
        }

        if (request.status !== 'MANAGER_APPROVED') {
            return res.status(400).json({
                status: 'error',
                message: 'Request must be in MANAGER_APPROVED status to schedule interview'
            });
        }

        // Verify candidate exists
        const candidate = request.candidateResumes.find(r => r.id === candidateId);
        if (!candidate) {
            return res.status(404).json({
                status: 'error',
                message: 'Candidate not found'
            });
        }

        // Create interview schedule
        const interviewSchedule = await prisma.interviewSchedule.create({
            data: {
                requestId: id,
                candidateId,
                interviewDate: new Date(interviewDate),
                interviewTime,
                location: location || null,
                meetingLink: meetingLink || null,
                interviewers: JSON.stringify(interviewers || []),
                notes: notes || null,
                scheduledBy: userId
            },
            include: {
                candidateResume: true,
                scheduledByUser: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });

        // Parse interviewers if it's a string
        if (typeof interviewSchedule.interviewers === 'string') {
            try {
                (interviewSchedule as any).interviewers = JSON.parse(interviewSchedule.interviewers);
            } catch (e) {
                (interviewSchedule as any).interviewers = [];
            }
        }

        // Update request status
        const updatedRequest = await prisma.request.update({
            where: { id },
            data: { status: 'INTERVIEW_SCHEDULED' }
        });

        // Create activity log
        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName,
                authorRole: 'HR Agent',
                activityType: 'SYSTEM',
                message: `Interview scheduled with ${candidate.candidateName || 'candidate'} on ${interviewDate} at ${interviewTime}`,
                isSystemGenerated: true
            }
        });

        // Transform BigInt to string for JSON serialization
        if (interviewSchedule && interviewSchedule.candidateResume) {
            (interviewSchedule as any).candidateResume = {
                ...interviewSchedule.candidateResume,
                fileSize: interviewSchedule.candidateResume.fileSize.toString()
            };
        }

        res.json({
            status: 'success',
            data: {
                request: updatedRequest,
                interviewSchedule
            }
        });
    } catch (error) {
        console.error('Error scheduling interview:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to schedule interview'
        });
    }
};

/**
 * Submit interview feedback
 * POST /requests/:id/interview-feedback
 */
export const submitInterviewFeedback = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const {
            decision,
            overallRating,
            technicalSkills,
            culturalFit,
            communication,
            feedback,
            concerns
        } = req.body;
        const userId = (req as any).user?.id;

        // Validate required fields
        if (!decision || !['PROCEED', 'REJECT'].includes(decision)) {
            return res.status(400).json({
                status: 'error',
                message: 'Decision must be either PROCEED or REJECT'
            });
        }

        if (!feedback) {
            return res.status(400).json({
                status: 'error',
                message: 'Feedback is required'
            });
        }

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

        if (request.status !== 'INTERVIEW_SCHEDULED') {
            return res.status(400).json({
                status: 'error',
                message: 'Request must be in INTERVIEW_SCHEDULED status to submit feedback'
            });
        }

        // Verify user is the hiring manager (requester)
        if (request.requesterId !== userId) {
            return res.status(403).json({
                status: 'error',
                message: 'Only the hiring manager can submit interview feedback'
            });
        }

        // Create interview feedback
        const interviewFeedback = await prisma.interviewFeedback.create({
            data: {
                requestId: id,
                decision,
                overallRating: overallRating || null,
                technicalSkills: technicalSkills || null,
                culturalFit: culturalFit || null,
                communication: communication || null,
                feedback,
                concerns: concerns || null,
                submittedBy: userId
            },
            include: {
                submittedByUser: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });

        // Update request status based on decision
        const newStatus = decision === 'PROCEED' ? 'INTERVIEW_FEEDBACK_PENDING' : 'CANDIDATE_REJECTED_INTERVIEW';
        const updatedRequest = await prisma.request.update({
            where: { id },
            data: { status: newStatus }
        });

        // Create activity log
        const activityMessage = decision === 'PROCEED'
            ? `Hiring Manager approved candidate to proceed after interview`
            : `Hiring Manager rejected candidate after interview`;

        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName,
                authorRole: 'Hiring Manager',
                activityType: decision === 'PROCEED' ? 'APPROVAL' : 'REJECTION',
                message: activityMessage,
                isSystemGenerated: false
            }
        });

        res.json({
            status: 'success',
            data: {
                request: updatedRequest,
                interviewFeedback
            }
        });
    } catch (error) {
        console.error('Error submitting interview feedback:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to submit interview feedback'
        });
    }
};

/**
 * Get interview details
 * GET /requests/:id/interview
 */
export const getInterviewDetails = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Get interview schedule and feedback
        const [interviewSchedule, interviewFeedback] = await Promise.all([
            prisma.interviewSchedule.findUnique({
                where: { requestId: id },
                include: {
                    candidateResume: true,
                    scheduledByUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                }
            }),
            prisma.interviewFeedback.findUnique({
                where: { requestId: id },
                include: {
                    submittedByUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                }
            })
        ]);

        // Transform BigInt to string and parse interviewers
        if (interviewSchedule) {
            if (interviewSchedule.candidateResume) {
                (interviewSchedule as any).candidateResume = {
                    ...interviewSchedule.candidateResume,
                    fileSize: interviewSchedule.candidateResume.fileSize.toString()
                };
            }
            if (typeof interviewSchedule.interviewers === 'string') {
                try {
                    (interviewSchedule as any).interviewers = JSON.parse(interviewSchedule.interviewers);
                } catch (e) {
                    (interviewSchedule as any).interviewers = [];
                }
            }
        }

        res.json({
            status: 'success',
            data: {
                schedule: interviewSchedule,
                feedback: interviewFeedback
            }
        });
    } catch (error) {
        console.error('Error getting interview details:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get interview details'
        });
    }
};
