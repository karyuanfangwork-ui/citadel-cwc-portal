import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { notify } from '../services/notification.service';
import { auditLog } from '../utils/audit';
import { shouldResumeOnTransition, pauseSla, resumeSla } from '../services/sla-pause.service';

const prisma = new PrismaClient();

/**
 * Create a new onboarding request
 * POST /api/v1/requests/:id/onboarding/create
 */
export const createOnboardingRequest = async (req: Request, res: Response) => {
    try {
        const { id: requestId }  = req.params as Record<string, string>;
        const {
            newHireFirstName,
            newHireLastName,
            newHireEmail,
            newHirePhone,
            jobTitle,
            department,
            hiringManagerId,
            startDate,
            employmentType,
        } = req.body;

        const request = await prisma.request.findUnique({
            where: { id: requestId },
        });

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const existingOnboarding = await prisma.onboardingRequest.findUnique({
            where: { requestId },
        });

        if (existingOnboarding) {
            return res.status(400).json({ error: 'Onboarding request already exists for this request' });
        }

        const onboarding = await prisma.onboardingRequest.create({
            data: {
                requestId,
                newHireFirstName,
                newHireLastName,
                newHireEmail,
                newHirePhone,
                jobTitle,
                department,
                hiringManagerId,
                startDate: new Date(startDate),
                employmentType,
                overallStatus: 'PENDING',
                currentPhase: 'PRE_ARRIVAL',
            },
            include: {
                request: true,
                hiringManager: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
            },
        });

        await prisma.request.update({
            where: { id: requestId },
            data: { status: 'ONBOARDING_SUBMITTED' },
        });

        res.status(201).json(onboarding);
    } catch (error) {
        console.error('Error creating onboarding request:', error);
        res.status(500).json({ error: 'Failed to create onboarding request' });
    }
};

/**
 * Get onboarding request details
 * GET /api/v1/requests/:id/onboarding
 */
export const getOnboardingRequest = async (req: Request, res: Response) => {
    try {
        const { id: requestId }  = req.params as Record<string, string>;

        const onboarding = await prisma.onboardingRequest.findUnique({
            where: { requestId },
            include: {
                request: true,
                hiringManager: {
                    select: { id: true, firstName: true, lastName: true, email: true, department: true },
                },
                newHire: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
                buddy: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
                tasks: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        assignedToUser: {
                            select: { id: true, firstName: true, lastName: true, email: true },
                        },
                    },
                },
            },
        });

        if (!onboarding) {
            return res.status(404).json({ error: 'Onboarding request not found' });
        }

        res.json(onboarding);
    } catch (error) {
        console.error('Error fetching onboarding request:', error);
        res.status(500).json({ error: 'Failed to fetch onboarding request' });
    }
};

/**
 * Update onboarding status
 * PUT /api/v1/requests/:id/onboarding/update-status
 */
export const updateOnboardingStatus = async (req: Request, res: Response) => {
    try {
        const { id: requestId }  = req.params as Record<string, string>;
        const { overallStatus, currentPhase, ...updates } = req.body;
        const user = (req as any).user;

        const currentRequest = await prisma.request.findUnique({ where: { id: requestId } });
        if (!currentRequest) return res.status(404).json({ error: 'Request not found' });

        const onboarding = await prisma.onboardingRequest.update({
            where: { requestId },
            data: {
                overallStatus,
                currentPhase,
                ...updates,
            },
            include: {
                request: true,
                tasks: true,
            },
        });

        // Create AssetAssignment when hardwareAssigned is toggled on with an assetId
        if (updates.hardwareAssigned === true && updates.assetId) {
            const asset = await prisma.asset.findUnique({ where: { id: updates.assetId } });
            if (asset && asset.status !== 'ASSIGNED') {
                const assignToUserId = onboarding.newHireId;
                if (assignToUserId) {
                    await prisma.$transaction([
                        prisma.assetAssignment.create({
                            data: {
                                assetId: updates.assetId,
                                userId: assignToUserId,
                                assignedById: user?.id || onboarding.hiringManagerId,
                                reason: 'Onboarding',
                                linkedRequestId: requestId,
                            },
                        }),
                        prisma.asset.update({ where: { id: updates.assetId }, data: { status: 'ASSIGNED' } }),
                    ]);
                }
            }
        }

        const statusMap: Record<string, string> = {
            'HR_APPROVAL': 'ONBOARDING_PENDING_HR_APPROVAL',
            'PRE_ARRIVAL': 'ONBOARDING_PRE_ARRIVAL_SETUP',
            'DAY_1_READY': 'ONBOARDING_READY_FOR_DAY_1',
            'DAY_1': 'ONBOARDING_DAY_1_ORIENTATION',
            'WEEK_1': 'ONBOARDING_WEEK_1_INTEGRATION',
            'MONTH_1': 'ONBOARDING_MONTH_1_MILESTONE',
            'MONTH_2': 'ONBOARDING_MONTH_2_MILESTONE',
            'MONTH_3': 'ONBOARDING_MONTH_3_MILESTONE',
        };

        let finalStatus = currentRequest.status;
        if (currentPhase && statusMap[currentPhase]) {
            finalStatus = statusMap[currentPhase] as any;
        }

        if (overallStatus === 'COMPLETED') {
            const taskCounts = await prisma.onboardingTask.groupBy({
                by: ['status'],
                where: { onboardingId: onboarding.id },
                _count: true,
            });
            const pendingCount = taskCounts
                .filter(t => t.status !== 'COMPLETED')
                .reduce((sum, t) => sum + t._count, 0);
            const totalCount = taskCounts.reduce((sum, t) => sum + t._count, 0);

            if (totalCount > 0 && pendingCount > 0) {
                return res.status(400).json({
                    error: 'Cannot complete onboarding',
                    message: `${pendingCount} task${pendingCount > 1 ? 's are' : ' is'} still incomplete. Please complete all tasks before closing this onboarding.`,
                    pendingCount,
                    totalCount,
                });
            }
            finalStatus = 'ONBOARDING_COMPLETED';
        }

        if (finalStatus !== currentRequest.status) {
            // SLA pause/resume for onboarding status transitions
            const { shouldPause, shouldResume } = await shouldResumeOnTransition(currentRequest.status, finalStatus);
            if (shouldPause) {
                await pauseSla(requestId);
            } else if (shouldResume) {
                await resumeSla(requestId);
            }

            await prisma.request.update({
                where: { id: requestId },
                data: { 
                    status: finalStatus as any,
                    ...(finalStatus === 'ONBOARDING_COMPLETED' && { closedAt: new Date(), completedAt: new Date() })
                },
            });

            await prisma.requestActivity.create({
                data: {
                    requestId: requestId,
                    authorId: user?.id,
                    authorName: user ? `${user.firstName} ${user.lastName}` : 'System',
                    authorRole: user?.roles?.[0] || 'SYSTEM',
                    activityType: 'STATUS_CHANGE',
                    message: `Status changed to ${finalStatus}`,
                    isSystemGenerated: true,
                    metadata: { newStatus: finalStatus },
                },
            });

            await notify({
                userId: currentRequest.requesterId,
                eventType: 'STATUS_CHANGED',
                variables: {
                    referenceNumber: currentRequest.referenceNumber,
                    newStatus: finalStatus,
                },
                relatedRequestId: requestId,
            });

            await auditLog(req, 'STATUS_CHANGED', 'request', requestId, {
                newStatus: finalStatus,
                referenceNumber: currentRequest.referenceNumber,
            }, {
                oldStatus: currentRequest.status,
            });
        }

        res.json(onboarding);
    } catch (error) {
        console.error('Error updating onboarding status:', error);
        res.status(500).json({ error: 'Failed to update onboarding status' });
    }
};

export const createOnboardingTask = async (req: Request, res: Response) => {
    try {
        const { id: requestId }  = req.params as Record<string, string>;
        const { taskName, taskDescription, taskCategory, assignedTo, dueDate, priority } = req.body;
        const onboarding = await prisma.onboardingRequest.findUnique({ where: { requestId } });
        if (!onboarding) return res.status(404).json({ error: 'Onboarding request not found' });
        const task = await prisma.onboardingTask.create({
            data: {
                onboardingId: onboarding.id,
                taskName,
                taskDescription,
                taskCategory,
                assignedTo,
                dueDate: dueDate ? new Date(dueDate) : null,
                priority: priority || 'MEDIUM',
            },
            include: {
                assignedToUser: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
            },
        });
        res.status(201).json(task);
    } catch (error) {
        console.error('Error creating onboarding task:', error);
        res.status(500).json({ error: 'Failed to create onboarding task' });
    }
};

export const getOnboardingTasks = async (req: Request, res: Response) => {
    try {
        const { id: requestId }  = req.params as Record<string, string>;
        const onboarding = await prisma.onboardingRequest.findUnique({
            where: { requestId },
            select: { id: true },
        });
        if (!onboarding) return res.status(404).json({ error: 'Onboarding request not found' });
        const tasks = await prisma.onboardingTask.findMany({
            where: { onboardingId: onboarding.id },
            include: {
                assignedToUser: { select: { id: true, firstName: true, lastName: true, email: true } },
                completedByUser: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'asc' },
        });
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching onboarding tasks:', error);
        res.status(500).json({ error: 'Failed to fetch onboarding tasks' });
    }
};

export const updateOnboardingTask = async (req: Request, res: Response) => {
    try {
        const { taskId }  = req.params as Record<string, string>;
        const { status, completedBy, notes, ...updates } = req.body;
        const userRoles = (req as any).user?.roles || [];
        const task = await prisma.onboardingTask.findUnique({
            where: { id: taskId },
            include: { onboarding: { include: { request: true } } },
        });
        if (!task) return res.status(404).json({ error: 'Task not found' });
        const currentUser = await prisma.user.findUnique({
            where: { id: (req as any).user?.id },
            select: { agentTeam: true },
        });
        const isAdmin = userRoles.includes('ADMIN');
        const isAgent = userRoles.includes('AGENT');
        const userAgentTeam = currentUser?.agentTeam?.toUpperCase() || '';
        const taskCategory = task.taskCategory?.toUpperCase() || '';
        const hasPermission = isAdmin ||
            (isAgent && userAgentTeam === 'IT' && taskCategory === 'IT') ||
            (isAgent && userAgentTeam === 'HR' && ['HR', 'ADMIN', 'TRAINING'].includes(taskCategory));
        if (!hasPermission) {
            return res.status(403).json({
                error: 'You do not have permission to update this task',
                message: `${taskCategory} tasks can only be updated by ${taskCategory === 'IT' ? 'IT agents' : 'HR agents'}`,
            });
        }
        const updatedTask = await prisma.onboardingTask.update({
            where: { id: taskId },
            data: {
                status,
                completedBy,
                completedAt: status === 'COMPLETED' ? new Date() : null,
                notes,
                ...updates,
            },
            include: {
                assignedToUser: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
        });
        res.json(updatedTask);
    } catch (error) {
        console.error('Error updating onboarding task:', error);
        res.status(500).json({ error: 'Failed to update onboarding task' });
    }
};

export const deleteOnboardingTask = async (req: Request, res: Response) => {
    try {
        const { taskId }  = req.params as Record<string, string>;
        await prisma.onboardingTask.delete({ where: { id: taskId } });
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting onboarding task:', error);
        res.status(500).json({ error: 'Failed to delete onboarding task' });
    }
};

export const completeMilestone = async (req: Request, res: Response) => {
    try {
        const { id: requestId }  = req.params as Record<string, string>;
        const { milestone } = req.body;
        const milestoneField = `${milestone}Completed`;
        const onboarding = await prisma.onboardingRequest.update({
            where: { requestId },
            data: { [milestoneField]: new Date() },
        });
        res.json(onboarding);
    } catch (error) {
        console.error('Error completing milestone:', error);
        res.status(500).json({ error: 'Failed to complete milestone' });
    }
};

/**
 * Update onboarding start date
 * PATCH /api/v1/requests/:id/onboarding/start-date
 * Only ADMIN or HR AGENT can update the start date
 */
export const updateStartDate = async (req: Request, res: Response) => {
    try {
        const { id: requestId }  = req.params as Record<string, string>;
        const { startDate } = req.body;
        const user = (req as any).user;
        const userRoles = user?.roles || [];

        if (!startDate) {
            return res.status(400).json({ error: 'startDate is required' });
        }

        const parsedDate = new Date(startDate);
        if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({ error: 'Invalid startDate format' });
        }

        // Permission check — ADMIN or HR agent only
        const isAdmin = userRoles.includes('ADMIN');
        const isHRAgent = userRoles.includes('AGENT');
        let isHR = false;
        if (isHRAgent) {
            const dbUser = await prisma.user.findUnique({
                where: { id: user?.id },
                select: { agentTeam: true },
            });
            isHR = dbUser?.agentTeam?.toUpperCase() === 'HR';
        }

        if (!isAdmin && !isHR) {
            return res.status(403).json({ error: 'Only ADMIN or HR agent can update the start date' });
        }

        const onboarding = await prisma.onboardingRequest.findUnique({ where: { requestId } });
        if (!onboarding) {
            return res.status(404).json({ error: 'Onboarding request not found' });
        }

        const oldStartDate = onboarding.startDate;

        const updated = await prisma.onboardingRequest.update({
            where: { requestId },
            data: { startDate: parsedDate },
        });

        // Audit log
        await prisma.requestActivity.create({
            data: {
                requestId,
                authorId: user?.id,
                authorName: user ? `${user.firstName} ${user.lastName}` : 'System',
                authorRole: userRoles[0] || 'SYSTEM',
                activityType: 'SYSTEM',
                message: `Start date updated from ${new Date(oldStartDate).toLocaleDateString('en-GB')} to ${parsedDate.toLocaleDateString('en-GB')}`,
                isSystemGenerated: true,
            },
        });

        await auditLog(req, 'UPDATE', 'onboardingRequest', onboarding.id, {
            field: 'startDate',
            oldValue: oldStartDate,
            newValue: parsedDate,
        }, {});

        res.json(updated);
    } catch (error) {
        console.error('Error updating onboarding start date:', error);
        res.status(500).json({ error: 'Failed to update start date' });
    }
};

export const assignBuddy = async (req: Request, res: Response) => {
    try {
        const { id: requestId }  = req.params as Record<string, string>;
        const { buddyId } = req.body;
        const onboarding = await prisma.onboardingRequest.update({
            where: { requestId },
            data: { buddyAssigned: buddyId },
            include: {
                buddy: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
        });
        res.json(onboarding);
    } catch (error) {
        console.error('Error assigning buddy:', error);
        res.status(500).json({ error: 'Failed to assign buddy' });
    }
};

export const getOnboardingProgress = async (req: Request, res: Response) => {
    try {
        const { id: requestId }  = req.params as Record<string, string>;
        const onboarding = await prisma.onboardingRequest.findUnique({
            where: { requestId },
            include: { tasks: true },
        });
        if (!onboarding) return res.status(404).json({ error: 'Onboarding request not found' });
        const totalTasks = onboarding.tasks.length;
        const completedTasks = onboarding.tasks.filter(t => t.status === 'COMPLETED').length;
        const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        res.json({
            overallStatus: onboarding.overallStatus,
            currentPhase: onboarding.currentPhase,
            completionPercentage,
            tasks: {
                total: totalTasks,
                completed: completedTasks,
                pending: totalTasks - completedTasks,
            },
        });
    } catch (error) {
        console.error('Error fetching onboarding progress:', error);
        res.status(500).json({ error: 'Failed to fetch onboarding progress' });
    }
};
