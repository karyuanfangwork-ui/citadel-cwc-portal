import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { pauseSla, resumeSla } from '../services/sla-pause.service';

const prisma = new PrismaClient();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveRequestId(idOrRef: string): Promise<string | null> {
    if (UUID_RE.test(idOrRef)) return idOrRef;
    const row = await prisma.request.findFirst({
        where: { referenceNumber: idOrRef, deletedAt: null },
        select: { id: true },
    });
    return row?.id ?? null;
}

/**
 * Start HR reference check
 * POST /requests/:id/start-screening
 */
export const startHRScreening = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }
        const { notes } = req.body;
        const userId = (req as any).user?.id;

        // Get the request and interview feedback
        const request = await prisma.request.findUnique({
            where: { id },
            include: {
                interviewFeedbacks: true
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
        // Verify interview feedback exists and at least one has decision PROCEED
        if (!request.interviewFeedbacks || request.interviewFeedbacks.length === 0 || !request.interviewFeedbacks.some((f: any) => f.decision === 'PROCEED')) {
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
        /* unused */ await await prisma.request.update({
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
                message: `Reference check initiated${notes ? ': ' + notes : ''}`,
                isSystemGenerated: true
            }
        });

        res.json({
            status: 'success',
            data: hrScreening
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
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }
        const {
            referencesCheckStatus,
            referencesCheckNotes,
            referencesContacted,
            overallStatus: agentOverallStatus
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

        // Determine overall status — reference check is the deciding factor
        // (background check is auto-passed since it was removed from the UI)
        let calculatedStatus = agentOverallStatus || 'IN_PROGRESS';

        // If not explicitly set by agent, calculate based on reference check status
        if (!agentOverallStatus) {
            const refPassed = referencesCheckStatus === 'PASSED' || referencesCheckStatus === 'COMPLETED';

            if (refPassed) {
                calculatedStatus = 'COMPLETED';
            } else if (referencesCheckStatus === 'FAILED') {
                calculatedStatus = 'ISSUES_FOUND';
            }
        }

        // Update screening record — auto-pass background check (removed from UI)
        const updatedScreening = await prisma.hRScreening.update({
            where: { id: request.hrScreening.id },
            data: {
                backgroundCheckStatus: 'PASSED',
                backgroundCheckNotes: 'Auto-passed (removed from workflow)',
                referencesCheckStatus: referencesCheckStatus || request.hrScreening.referencesCheckStatus,
                referencesCheckNotes: referencesCheckNotes || request.hrScreening.referencesCheckNotes,
                referencesContacted: referencesContacted ? JSON.stringify(referencesContacted) : request.hrScreening.referencesContacted,
                overallStatus: calculatedStatus,
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

        // If screening is COMPLETED or REJECTED, update the request status
        if (calculatedStatus === 'COMPLETED') {
            await prisma.request.update({
                where: { id },
                data: { status: 'LOA_PENDING_APPROVAL' }
            });
            // Pause SLA — request entered LOA_PENDING_APPROVAL
            await pauseSla(id);
        } else if (calculatedStatus === 'REJECTED') {
            await prisma.request.update({
                where: { id },
                data: { status: 'REJECTED' }
            });
            // Resume SLA — leaving approval pause status (if any)
            await resumeSla(id);
        }

        // Create activity log
        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName,
                authorRole: 'HR Agent',
                activityType: 'SYSTEM',
                message: `Reference check updated - Status: ${calculatedStatus}, References: ${referencesCheckStatus || 'unchanged'}`,
                isSystemGenerated: true
            }
        });

        // Prepare response data with parsed fields
        const responseData = {
            ...updatedScreening,
            referencesContacted: updatedScreening.referencesContacted ?
                (typeof updatedScreening.referencesContacted === 'string' ?
                    JSON.parse(updatedScreening.referencesContacted) :
                    updatedScreening.referencesContacted) :
                []
        };

        res.json({
            status: 'success',
            data: responseData
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
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }

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

        // Parse referencesContacted if it's a string
        if (hrScreening && typeof hrScreening.referencesContacted === 'string') {
            try {
                (hrScreening as any).referencesContacted = JSON.parse(hrScreening.referencesContacted);
            } catch (e) {
                (hrScreening as any).referencesContacted = [];
            }
        }

        res.json({
            status: 'success',
            data: hrScreening
        });
    } catch (error) {
        console.error('Error getting screening details:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get screening details'
        });
    }
};
