import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Create a new onboarding request
 * POST /api/v1/requests/:id/onboarding/create
 */
export const createOnboardingRequest = async (req: Request, res: Response) => {
    try {
        const { id: requestId } = req.params;
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

        // Verify request exists
        const request = await prisma.request.findUnique({
            where: { id: requestId },
        });

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Check if onboarding already exists
        const existingOnboarding = await prisma.onboardingRequest.findUnique({
            where: { requestId },
        });

        if (existingOnboarding) {
            return res.status(400).json({ error: 'Onboarding request already exists for this request' });
        }

        // Create onboarding request
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
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
        });

        // Update request status
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
        const { id: requestId } = req.params;

        const onboarding = await prisma.onboardingRequest.findUnique({
            where: { requestId },
            include: {
                request: true,
                hiringManager: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        department: true,
                    },
                },
                newHire: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                buddy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                tasks: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        assignedToUser: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                            },
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
        const { id: requestId } = req.params;
        const { overallStatus, currentPhase, ...updates } = req.body;

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

        // Update request status based on onboarding phase
        const statusMap: Record<string, string> = {
            'PRE_ARRIVAL': 'ONBOARDING_PRE_ARRIVAL_SETUP',
            'DAY_1': 'ONBOARDING_DAY_1_ORIENTATION',
            'WEEK_1': 'ONBOARDING_WEEK_1_INTEGRATION',
            'MONTH_1': 'ONBOARDING_MONTH_1_MILESTONE',
            'MONTH_2': 'ONBOARDING_MONTH_2_MILESTONE',
            'MONTH_3': 'ONBOARDING_MONTH_3_MILESTONE',
        };

        if (currentPhase && statusMap[currentPhase]) {
            await prisma.request.update({
                where: { id: requestId },
                data: { status: statusMap[currentPhase] as any },
            });
        }

        if (overallStatus === 'COMPLETED') {
            await prisma.request.update({
                where: { id: requestId },
                data: {
                    status: 'ONBOARDING_COMPLETED',
                    closedAt: new Date(),
                },
            });
        }

        res.json(onboarding);
    } catch (error) {
        console.error('Error updating onboarding status:', error);
        res.status(500).json({ error: 'Failed to update onboarding status' });
    }
};

/**
 * Create onboarding task
 * POST /api/v1/requests/:id/onboarding/tasks
 */
export const createOnboardingTask = async (req: Request, res: Response) => {
    try {
        const { id: requestId } = req.params;
        const {
            taskName,
            taskDescription,
            taskCategory,
            assignedTo,
            dueDate,
            priority,
        } = req.body;

        // Get onboarding request
        const onboarding = await prisma.onboardingRequest.findUnique({
            where: { requestId },
        });

        if (!onboarding) {
            return res.status(404).json({ error: 'Onboarding request not found' });
        }

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
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
        });

        res.status(201).json(task);
    } catch (error) {
        console.error('Error creating onboarding task:', error);
        res.status(500).json({ error: 'Failed to create onboarding task' });
    }
};

/**
 * Get all onboarding tasks
 * GET /api/v1/requests/:id/onboarding/tasks
 */
export const getOnboardingTasks = async (req: Request, res: Response) => {
    try {
        const { id: requestId } = req.params;

        const onboarding = await prisma.onboardingRequest.findUnique({
            where: { requestId },
            select: { id: true },
        });

        if (!onboarding) {
            return res.status(404).json({ error: 'Onboarding request not found' });
        }

        const tasks = await prisma.onboardingTask.findMany({
            where: { onboardingId: onboarding.id },
            include: {
                assignedToUser: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                completedByUser: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        res.json(tasks);
    } catch (error) {
        console.error('Error fetching onboarding tasks:', error);
        res.status(500).json({ error: 'Failed to fetch onboarding tasks' });
    }
};

/**
 * Update onboarding task
 * PUT /api/v1/requests/:id/onboarding/tasks/:taskId
 */
export const updateOnboardingTask = async (req: Request, res: Response) => {
    try {
        const { id: requestId, taskId } = req.params;
        const { status, completedBy, notes, ...updates } = req.body;
        const userRoles = (req as any).user?.roles || [];

        // Get task and request to check role-based access
        const task = await prisma.onboardingTask.findUnique({
            where: { id: taskId },
            include: { onboarding: { include: { request: true } } },
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Check permissions: only ADMIN or assigned agent for task category
        const isAdmin = userRoles.includes('ADMIN');
        const isAgent = userRoles.includes('AGENT');
        const assignedTeam = task.onboarding.request.assignedTeam?.toUpperCase() || '';
        const taskCategory = task.taskCategory?.toUpperCase() || '';

        const hasPermission = isAdmin ||
            (isAgent && assignedTeam === 'IT' && taskCategory === 'IT') ||
            (isAgent && assignedTeam === 'HR' && ['HR', 'ADMIN', 'TRAINING'].includes(taskCategory));

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
                assignedToUser: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
        });

        res.json(updatedTask);
    } catch (error) {
        console.error('Error updating onboarding task:', error);
        res.status(500).json({ error: 'Failed to update onboarding task' });
    }
};

/**
 * Delete onboarding task
 * DELETE /api/v1/requests/:id/onboarding/tasks/:taskId
 */
export const deleteOnboardingTask = async (req: Request, res: Response) => {
    try {
        const { taskId } = req.params;

        await prisma.onboardingTask.delete({
            where: { id: taskId },
        });

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting onboarding task:', error);
        res.status(500).json({ error: 'Failed to delete onboarding task' });
    }
};

/**
 * Complete a milestone
 * POST /api/v1/requests/:id/onboarding/complete-milestone
 */
export const completeMilestone = async (req: Request, res: Response) => {
    try {
        const { id: requestId } = req.params;
        const { milestone } = req.body; // 'day1', 'week1', 'day30', 'day60', 'day90'

        const milestoneField = `${milestone}Completed`;

        const onboarding = await prisma.onboardingRequest.update({
            where: { requestId },
            data: {
                [milestoneField]: new Date(),
            },
        });

        res.json(onboarding);
    } catch (error) {
        console.error('Error completing milestone:', error);
        res.status(500).json({ error: 'Failed to complete milestone' });
    }
};

/**
 * Assign buddy/mentor
 * POST /api/v1/requests/:id/onboarding/assign-buddy
 */
export const assignBuddy = async (req: Request, res: Response) => {
    try {
        const { id: requestId } = req.params;
        const { buddyId } = req.body;

        const onboarding = await prisma.onboardingRequest.update({
            where: { requestId },
            data: {
                buddyAssigned: buddyId,
            },
            include: {
                buddy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
        });

        res.json(onboarding);
    } catch (error) {
        console.error('Error assigning buddy:', error);
        res.status(500).json({ error: 'Failed to assign buddy' });
    }
};

/**
 * Get onboarding progress
 * GET /api/v1/requests/:id/onboarding/progress
 */
export const getOnboardingProgress = async (req: Request, res: Response) => {
    try {
        const { id: requestId } = req.params;

        const onboarding = await prisma.onboardingRequest.findUnique({
            where: { requestId },
            include: {
                tasks: true,
            },
        });

        if (!onboarding) {
            return res.status(404).json({ error: 'Onboarding request not found' });
        }

        const totalTasks = onboarding.tasks.length;
        const completedTasks = onboarding.tasks.filter(t => t.status === 'COMPLETED').length;
        const completionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        // Count completed milestones
        const milestones = {
            day1: !!onboarding.day1Completed,
            week1: !!onboarding.week1Completed,
            day30: !!onboarding.day30Completed,
            day60: !!onboarding.day60Completed,
            day90: !!onboarding.day90Completed,
        };

        const completedMilestones = Object.values(milestones).filter(Boolean).length;

        res.json({
            overallStatus: onboarding.overallStatus,
            currentPhase: onboarding.currentPhase,
            completionPercentage: Math.round(completionPercentage),
            tasks: {
                total: totalTasks,
                completed: completedTasks,
                pending: totalTasks - completedTasks,
            },
            milestones,
            completedMilestones,
            totalMilestones: 5,
        });
    } catch (error) {
        console.error('Error fetching onboarding progress:', error);
        res.status(500).json({ error: 'Failed to fetch onboarding progress' });
    }
};
