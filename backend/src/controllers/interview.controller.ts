import { Request, Response } from 'express';

import prisma from '../utils/prisma';
import { resolveRequestId } from '../utils/resolve';
import { transitionHttpRequest } from '../utils/httpRequestTransition';
import { AppError } from '../middleware/error.middleware';
/**
 * Schedule interview with candidate
 * POST /requests/:id/schedule-interview
 */
export const scheduleInterview = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }
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
            include: { candidates: true }
        });

        if (!request) {
            return res.status(404).json({
                status: 'error',
                message: 'Request not found'
            });
        }

        if (request.status !== 'MANAGER_APPROVED' && request.status !== 'INTERVIEW_SCHEDULED') {
            return res.status(400).json({
                status: 'error',
                message: 'Request must be in MANAGER_APPROVED or INTERVIEW_SCHEDULED status to schedule interview'
            });
        }

        // Verify candidate exists
        const candidate = request.candidates.find(c => c.id === candidateId);
        if (!candidate) {
            return res.status(404).json({
                status: 'error',
                message: 'Candidate not found'
            });
        }

        // Check for duplicate interview schedule (same request + same candidate)
        const existingSchedule = await prisma.interviewSchedule.findFirst({
            where: { requestId: id, candidateId }
        });
        if (existingSchedule) {
            return res.status(409).json({
                status: 'error',
                message: `Interview already scheduled for ${candidate.fullName}. Use edit to update.`
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
                candidate: true,
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

        // Update request status — only transition to INTERVIEW_SCHEDULED if not already there
        let updatedRequest: any = request;
        if (request.status !== 'INTERVIEW_SCHEDULED') {
            updatedRequest = await transitionHttpRequest({
                req,
                request,
                toStatus: 'INTERVIEW_SCHEDULED',
                source: 'interview.schedule',
                comment: notes,
            });
        }

        // Create activity log
        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName,
                authorRole: 'HR Agent',
                activityType: 'SYSTEM',
                message: `Interview scheduled with ${candidate.fullName} on ${interviewDate} at ${interviewTime}`,
                isSystemGenerated: true
            }
        });

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
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }
        const {
            candidateId,
            decision,
            overallRating,
            technicalSkills,
            culturalFit,
            communication,
            feedback,
            concerns
        } = req.body;
        const user = (req as any).user;
        const userId = user?.id;

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

        // Only the requester holding the HIRING_MANAGER role may submit this review.
        const userRoles: string[] = Array.isArray(user?.roles) ? user.roles : [];
        if (request.requesterId !== userId || !userRoles.some((role) => role.toUpperCase() === 'HIRING_MANAGER')) {
            return res.status(403).json({
                status: 'error',
                message: 'Only the hiring manager can submit interview feedback'
            });
        }

        const selectedCandidateIds: string[] = Array.isArray((request.customFields as any)?.selectedCandidateIds)
            ? (request.customFields as any).selectedCandidateIds
            : [];
        if (selectedCandidateIds.length > 0 && (!candidateId || !selectedCandidateIds.includes(candidateId))) {
            return res.status(400).json({ status: 'error', message: 'Feedback must be submitted for a selected candidate' });
        }

        // Read before writing so final feedback, activity, and status transition
        // share one transaction. This also supports retry after an earlier
        // feedback write committed without its corresponding status transition.
        const allFeedbacks = await prisma.interviewFeedback.findMany({
            where: { requestId: id }
        });
        const relevantFeedbacks = selectedCandidateIds.length > 0
            ? allFeedbacks.filter(f => f.candidateId && selectedCandidateIds.includes(f.candidateId))
            : allFeedbacks;
        const priorFeedback = selectedCandidateIds.length > 0
            ? relevantFeedbacks.find(f => f.candidateId === candidateId)
            : relevantFeedbacks.find(f => f.candidateId === (candidateId || null)) ?? (!candidateId ? relevantFeedbacks[0] : undefined);
        if (priorFeedback && priorFeedback.submittedBy !== userId) {
            return res.status(409).json({ status: 'error', message: 'Interview feedback for this candidate was already submitted' });
        }
        const projectedFeedbacks = priorFeedback
            ? relevantFeedbacks
            : [...relevantFeedbacks, { candidateId: candidateId || null, decision }];
        const totalSelected = selectedCandidateIds.length || 1;
        const feedbackCount = selectedCandidateIds.length > 0
            ? new Set(projectedFeedbacks.map(f => f.candidateId).filter((value): value is string => Boolean(value))).size
            : projectedFeedbacks.length;
        const allFeedbackReceived = feedbackCount >= totalSelected;

        // Get candidate info for activity log
        let candidateLabel = 'candidate';
        if (candidateId) {
            const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
            if (candidate?.fullName) {
                candidateLabel = candidate.fullName;
            }
        }

        let newStatus: string | null = null;
        if (allFeedbackReceived) {
            const anyProceed = projectedFeedbacks.some(f => f.decision === 'PROCEED');
            newStatus = anyProceed ? 'INTERVIEW_FEEDBACK_PENDING' : 'CANDIDATE_REJECTED_INTERVIEW';
        }

        let interviewFeedback: any = priorFeedback;
        const feedbackData = {
            requestId: id,
            candidateId: candidateId || null,
            decision,
            overallRating: overallRating || null,
            technicalSkills: technicalSkills || null,
            culturalFit: culturalFit || null,
            communication: communication || null,
            feedback,
            concerns: concerns || null,
            submittedBy: userId
        };
        const activityMessage = decision === 'PROCEED'
            ? `Hiring Manager approved ${candidateLabel} to proceed after interview`
            : `Hiring Manager rejected ${candidateLabel} after interview`;
        const persistFeedback = async (tx: any) => {
            interviewFeedback = await tx.interviewFeedback.create({
                data: feedbackData,
                include: {
                    submittedByUser: {
                        select: { id: true, firstName: true, lastName: true, email: true }
                    }
                }
            });
            await tx.requestActivity.create({
                data: {
                    requestId: id,
                    authorId: userId,
                    authorName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Hiring Manager',
                    authorRole: 'Hiring Manager',
                    activityType: decision === 'PROCEED' ? 'APPROVAL' : 'REJECTION',
                    message: activityMessage,
                    isSystemGenerated: false
                }
            });
        };

        const updatedRequest = newStatus
            ? await transitionHttpRequest({
                req,
                request,
                toStatus: newStatus,
                source: 'interview.feedback',
                comment: feedback,
                ...(!priorFeedback ? { transactionMutations: async (tx: any) => persistFeedback(tx) } : {}),
            })
            : await (async () => {
                if (priorFeedback) {
                    throw new AppError('Interview feedback is already submitted for this candidate; waiting for remaining feedback', 409);
                }
                await prisma.$transaction(async (tx: any) => persistFeedback(tx));
                return request;
            })();

        res.json({
            status: 'success',
            data: {
                request: updatedRequest,
                interviewFeedback,
                allFeedbackReceived
            }
        });
    } catch (error) {
        console.error('Error submitting interview feedback:', error);
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({ status: 'error', message: error.message });
        }
        res.status(500).json({
            status: 'error',
            message: 'Failed to submit interview feedback'
        });
    }
};

/**
 * Update interview schedule (fix typos, reschedule)
 * PUT /requests/:id/schedule
 */
export const updateInterviewSchedule = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }
        const {
            interviewDate,
            interviewTime,
            location,
            meetingLink,
            interviewers,
            notes
        } = req.body;
        const userId = (req as any).user?.id;

        if (!interviewDate || !interviewTime) {
            return res.status(400).json({ status: 'error', message: 'Interview date and time are required' });
        }

        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }

        const allowedStatuses = ['INTERVIEW_SCHEDULED', 'MANAGER_APPROVED'];
        if (!allowedStatuses.includes(request.status)) {
            return res.status(400).json({ status: 'error', message: 'Interview can only be updated in MANAGER_APPROVED or INTERVIEW_SCHEDULED status' });
        }

        // Find the first schedule for this request (support multi-schedule)
        const existingSchedule = await prisma.interviewSchedule.findFirst({
            where: { requestId: id }
        });
        if (!existingSchedule) {
            return res.status(404).json({ status: 'error', message: 'No interview schedule found for this request' });
        }

        const updated = await prisma.interviewSchedule.update({
            where: { id: existingSchedule.id },
            data: {
                interviewDate: new Date(interviewDate),
                interviewTime,
                location: location || null,
                meetingLink: meetingLink || null,
                interviewers: JSON.stringify(interviewers || []),
                notes: notes || null,
            }
        });

        if (typeof updated.interviewers === 'string') {
            try { (updated as any).interviewers = JSON.parse(updated.interviewers); } catch { (updated as any).interviewers = []; }
        }

        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName,
                authorRole: 'HR Agent',
                activityType: 'SYSTEM',
                message: `Interview details updated: ${interviewDate} at ${interviewTime}`,
                isSystemGenerated: true
            }
        });

        res.json({ status: 'success', data: { interviewSchedule: updated } });
    } catch (error) {
        console.error('Error updating interview schedule:', error);
        res.status(500).json({ status: 'error', message: 'Failed to update interview schedule' });
    }
};

/**
 * Get interview details
 * GET /requests/:id/interview
 */
export const getInterviewDetails = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }

        // Get all interview schedules and all feedback for this request
        const [interviewSchedules, interviewFeedbacks] = await Promise.all([
            prisma.interviewSchedule.findMany({
                where: { requestId: id },
                include: {
                    candidate: true,
                    scheduledByUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                },
                orderBy: { createdAt: 'asc' }
            }),
            prisma.interviewFeedback.findMany({
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
                },
                orderBy: { createdAt: 'asc' }
            })
        ]);

        // Parse interviewers for each schedule
        for (const schedule of interviewSchedules) {
            if (typeof schedule.interviewers === 'string') {
                try {
                    (schedule as any).interviewers = JSON.parse(schedule.interviewers);
                } catch (e) {
                    (schedule as any).interviewers = [];
                }
            }
        }

        res.json({
            status: 'success',
            data: {
                schedule: interviewSchedules[0] || null,
                schedules: interviewSchedules,
                feedback: interviewFeedbacks[0] || null,
                feedbacks: interviewFeedbacks
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