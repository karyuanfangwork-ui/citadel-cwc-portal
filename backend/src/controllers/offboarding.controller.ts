import { Request, Response } from 'express';
import { uploadSingleFile } from '../middleware/upload.middleware';
import { notify, notifyMultiple } from '../services/notification.service';
import { auditLog } from '../utils/audit';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';

import prisma from '../utils/prisma';
import { resolveRequestId } from '../utils/resolve';
export const resignationUpload = { single: (field: string) => uploadSingleFile(field) };

export const createOffboardingRequest = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const requestId = await resolveRequestId(idOrRef);
        if (!requestId) return res.status(404).json({ status: 'error', message: 'Request not found' });
        const { employeeFirstName, employeeLastName, employeeEmail, department, managerId, lastWorkingDay, reasonForDeparture } = req.body;
        const request = await prisma.request.findUnique({ where: { id: requestId } });
        if (!request) return res.status(404).json({ error: 'Request not found' });
        const existing = await prisma.offboardingRequest.findUnique({ where: { requestId } });
        if (existing) return res.status(400).json({ error: 'Offboarding request already exists for this request' });
        const offboarding = await prisma.offboardingRequest.create({
            data: {
                requestId,
                employeeFirstName,
                employeeLastName,
                employeeEmail,
                department,
                managerId,
                lastWorkingDay: new Date(lastWorkingDay),
                reasonForDeparture,
                overallStatus: 'PENDING',
                currentPhase: 'NOTICE_PERIOD',
            },
            include: {
                request: true,
                manager: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
        });
        await prisma.request.update({
            where: { id: requestId },
            data: { status: 'OFFBOARDING_SUBMITTED' },
        });
        res.status(201).json(offboarding);
    } catch (error) {
        console.error('Error creating offboarding request:', error);
        res.status(500).json({ error: 'Failed to create offboarding request' });
    }
};

export const getOffboardingRequest = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const requestId = await resolveRequestId(idOrRef);
        if (!requestId) return res.status(404).json({ status: 'error', message: 'Request not found' });
        const offboarding = await prisma.offboardingRequest.findUnique({
            where: { requestId },
            include: {
                request: true,
                manager: { select: { id: true, firstName: true, lastName: true, email: true, department: true } },
                employee: { select: { id: true, firstName: true, lastName: true, email: true } },
                tasks: {
                    orderBy: { createdAt: 'asc' },
                    include: { assignedToUser: { select: { id: true, firstName: true, lastName: true, email: true } } },
                },
            },
        });
        if (!offboarding) return res.status(404).json({ error: 'Offboarding request not found' });
        res.json(offboarding);
    } catch (error) {
        console.error('Error fetching offboarding request:', error);
        res.status(500).json({ error: 'Failed to fetch offboarding request' });
    }
};

export const updateOffboardingStatus = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const requestId = await resolveRequestId(idOrRef);
        if (!requestId) return res.status(404).json({ status: 'error', message: 'Request not found' });
        const { overallStatus, currentPhase, exitInterviewScheduledDate, lastWorkingDay, department, ...rest } = req.body;
        const user = (req as any).user;

        const currentRequest = await prisma.request.findUnique({ where: { id: requestId } });
        if (!currentRequest) return res.status(404).json({ error: 'Request not found' });

        const updates = {
            ...rest,
            ...(exitInterviewScheduledDate !== undefined && {
                exitInterviewScheduledDate: exitInterviewScheduledDate
                    ? new Date(exitInterviewScheduledDate.includes('T') ? exitInterviewScheduledDate : exitInterviewScheduledDate + 'T00:00:00.000Z')
                    : null,
            }),
            ...(lastWorkingDay !== undefined && {
                lastWorkingDay: new Date(lastWorkingDay.includes('T') ? lastWorkingDay : lastWorkingDay + 'T00:00:00.000Z'),
            }),
        };

        if (currentPhase === 'FINAL_WEEK') {
            const current = await prisma.offboardingRequest.findUnique({
                where: { requestId },
                select: { resignationLetterAttached: true, exitInterviewScheduledDate: true },
            });
            if (!current?.resignationLetterAttached) {
                return res.status(400).json({
                    error: 'Cannot advance to Final Week',
                    message: 'The acceptance of resignation letter must be marked as attached before advancing.',
                });
            }
            if (!current?.exitInterviewScheduledDate) {
                return res.status(400).json({
                    error: 'Cannot advance to Final Week',
                    message: 'An exit interview date must be scheduled before advancing.',
                });
            }
        }

        if (overallStatus === 'COMPLETED') {
            const current = await prisma.offboardingRequest.findUnique({
                where: { requestId },
                select: { currentPhase: true, tasks: { select: { status: true } } },
            });
            if (current?.currentPhase !== 'EXIT_PROCEDURES') {
                return res.status(400).json({
                    error: 'Cannot complete offboarding',
                    message: 'All phases must be completed before closing. Please advance through all steps first.',
                });
            }
            const pendingCount = current.tasks.filter(t => t.status !== 'COMPLETED').length;
            if (current.tasks.length > 0 && pendingCount > 0) {
                return res.status(400).json({
                    error: 'Cannot complete offboarding',
                    message: `${pendingCount} task${pendingCount > 1 ? 's are' : ' is'} still incomplete.`,
                    pendingCount,
                    totalCount: current.tasks.length,
                });
            }
        }

        const offboarding = await prisma.offboardingRequest.update({
            where: { requestId },
            data: { overallStatus, currentPhase, ...updates },
            include: { request: true, tasks: true },
        });

        // Sync lastWorkingDay change to request custom_fields.lastDay
        if (lastWorkingDay !== undefined) {
            const currentFields = (currentRequest.customFields || {}) as Record<string, any>;
            await prisma.request.update({
                where: { id: requestId },
                data: { customFields: { ...currentFields, lastDay: lastWorkingDay } },
            });
        }

        // Close open AssetAssignments when hardwareReturned is toggled on
        if (rest.hardwareReturned === true && offboarding.employeeId) {
            const openAssignments = await prisma.assetAssignment.findMany({
                where: { userId: offboarding.employeeId, returnedAt: null },
            });
            for (const assignment of openAssignments) {
                await prisma.$transaction([
                    prisma.assetAssignment.update({
                        where: { id: assignment.id },
                        data: { returnedAt: new Date(), notes: 'Returned during offboarding' },
                    }),
                    prisma.asset.update({ where: { id: assignment.assetId }, data: { status: 'IN_STOCK' } }),
                ]);
            }
        }

        const statusMap: Record<string, string> = {
            'NOTICE_PERIOD':       'OFFBOARDING_NOTICE_PERIOD',
            'KNOWLEDGE_TRANSFER':  'OFFBOARDING_KNOWLEDGE_TRANSFER',
            'FINAL_WEEK':          'OFFBOARDING_FINAL_WEEK',
            'EXIT_PROCEDURES':     'OFFBOARDING_EXIT_PROCEDURES',
        };

        let finalStatus = currentRequest.status;
        if (currentPhase && statusMap[currentPhase]) {
            finalStatus = statusMap[currentPhase] as any;
        }

        if (overallStatus === 'COMPLETED') {
            finalStatus = 'OFFBOARDING_COMPLETED';
        }

        if (finalStatus !== currentRequest.status) {
            await prisma.request.update({
                where: { id: requestId },
                data: { 
                    status: finalStatus as any,
                    ...(finalStatus === 'OFFBOARDING_COMPLETED' && { closedAt: new Date(), completedAt: new Date() })
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

        res.json(offboarding);
    } catch (error) {
        console.error('Error updating offboarding status:', error);
        res.status(500).json({ error: 'Failed to update offboarding status' });
    }
};

export const createOffboardingTask = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const requestId = await resolveRequestId(idOrRef);
        if (!requestId) return res.status(404).json({ status: 'error', message: 'Request not found' });
        const { taskName, taskDescription, taskCategory, assignedTo, dueDate, priority } = req.body;
        const offboarding = await prisma.offboardingRequest.findUnique({ where: { requestId } });
        if (!offboarding) return res.status(404).json({ error: 'Offboarding request not found' });
        const task = await prisma.offboardingTask.create({
            data: {
                offboardingId: offboarding.id,
                taskName,
                taskDescription,
                taskCategory,
                assignedTo,
                dueDate: dueDate ? new Date(dueDate) : null,
                priority: priority || 'MEDIUM',
            },
            include: {
                assignedToUser: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
        });
        res.status(201).json(task);
    } catch (error) {
        console.error('Error creating offboarding task:', error);
        res.status(500).json({ error: 'Failed to create offboarding task' });
    }
};

export const getOffboardingTasks = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const requestId = await resolveRequestId(idOrRef);
        if (!requestId) return res.status(404).json({ status: 'error', message: 'Request not found' });
        const offboarding = await prisma.offboardingRequest.findUnique({
            where: { requestId },
            select: { id: true },
        });
        if (!offboarding) return res.status(404).json({ error: 'Offboarding request not found' });
        const tasks = await prisma.offboardingTask.findMany({
            where: { offboardingId: offboarding.id },
            include: {
                assignedToUser: { select: { id: true, firstName: true, lastName: true, email: true } },
                completedByUser: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'asc' },
        });
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching offboarding tasks:', error);
        res.status(500).json({ error: 'Failed to fetch offboarding tasks' });
    }
};

export const updateOffboardingTask = async (req: Request, res: Response) => {
    try {
        const { taskId }  = req.params as Record<string, string>;
        const { status, completedBy, notes, ...updates } = req.body;
        const userRoles = (req as any).user?.roles || [];
        const task = await prisma.offboardingTask.findUnique({
            where: { id: taskId },
            include: { offboarding: { include: { request: true } } },
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
        const updatedTask = await prisma.offboardingTask.update({
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
        console.error('Error updating offboarding task:', error);
        res.status(500).json({ error: 'Failed to update offboarding task' });
    }
};

export const deleteOffboardingTask = async (req: Request, res: Response) => {
    try {
        const { taskId }  = req.params as Record<string, string>;
        await prisma.offboardingTask.delete({ where: { id: taskId } });
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting offboarding task:', error);
        res.status(500).json({ error: 'Failed to delete offboarding task' });
    }
};

export const getOffboardingProgress = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const requestId = await resolveRequestId(idOrRef);
        if (!requestId) return res.status(404).json({ status: 'error', message: 'Request not found' });
        const offboarding = await prisma.offboardingRequest.findUnique({
            where: { requestId },
            include: { tasks: true },
        });
        if (!offboarding) return res.status(404).json({ error: 'Offboarding request not found' });
        const totalTasks = offboarding.tasks.length;
        const completedTasks = offboarding.tasks.filter(t => t.status === 'COMPLETED').length;
        const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        res.json({
            overallStatus: offboarding.overallStatus,
            currentPhase: offboarding.currentPhase,
            completionPercentage,
            tasks: {
                total: totalTasks,
                completed: completedTasks,
                pending: totalTasks - completedTasks,
            },
        });
    } catch (error) {
        console.error('Error fetching offboarding progress:', error);
        res.status(500).json({ error: 'Failed to fetch offboarding progress' });
    }
};

export const uploadResignationLetter = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const requestId = await resolveRequestId(idOrRef);
        if (!requestId) return res.status(404).json({ status: 'error', message: 'Request not found' });
        const file = (req as any).file;
        const userId = (req as any).user?.id;
        const userName = `${(req as any).user?.firstName || ''} ${(req as any).user?.lastName || ''}`.trim();
        if (!file) return res.status(400).json({ error: 'File is required' });
        const offboarding = await prisma.offboardingRequest.findUnique({ where: { requestId } });
        if (!offboarding) return res.status(404).json({ error: 'Offboarding request not found' });
        const fileUrl = (file as any).key;
        await prisma.offboardingRequest.update({
            where: { requestId },
            data: {
                resignationLetterUrl: fileUrl,
                resignationLetterFileName: file.originalname,
                resignationLetterAttached: true,
            },
        });
        await prisma.requestActivity.create({
            data: {
                requestId,
                authorId: userId,
                authorName: userName,
                authorRole: 'HR Agent',
                activityType: 'ATTACHMENT',
                message: `Resignation letter uploaded: ${file.originalname}`,
                isSystemGenerated: false,
            },
        });
        res.json({ fileUrl, fileName: file.originalname, resignationLetterAttached: true });
    } catch (error) {
        console.error('Error uploading resignation letter:', error);
        res.status(500).json({ error: 'Failed to upload resignation letter' });
    }
};

export const deleteResignationLetter = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const requestId = await resolveRequestId(idOrRef);
        if (!requestId) return res.status(404).json({ status: 'error', message: 'Request not found' });
        const offboarding = await prisma.offboardingRequest.findUnique({ where: { requestId } });
        if (!offboarding) return res.status(404).json({ error: 'Offboarding request not found' });
        if (offboarding.resignationLetterUrl) {
            const filePath = path.join(__dirname, '../../', offboarding.resignationLetterUrl);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        await prisma.offboardingRequest.update({
            where: { requestId },
            data: {
                resignationLetterUrl: null,
                resignationLetterFileName: null,
                resignationLetterAttached: false,
            },
        });
        res.json({ message: 'Resignation letter removed' });
    } catch (error) {
        console.error('Error deleting resignation letter:', error);
        res.status(500).json({ error: 'Failed to remove resignation letter' });
    }
};

export async function createDefaultOffboardingTasks(offboardingId: string, lastWorkingDay: Date) {
    const templates = await prisma.offboardingTaskTemplate.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
    });
    if (templates.length === 0) return;
    await prisma.offboardingTask.createMany({
        data: templates.map(t => ({
            offboardingId,
            taskName: t.taskName,
            taskDescription: t.taskDescription,
            taskCategory: t.taskCategory,
            priority: t.priority,
            dueDate: t.dueDayOffset !== 0
                ? new Date(lastWorkingDay.getTime() + t.dueDayOffset * 86400000)
                : lastWorkingDay,
        })),
    });

    console.log(`✅ Created ${templates.length} offboarding tasks from templates`);

    // ── Notify the dedicated IT agent if any IT-category tasks were created ──
    const hasItTasks = templates.some(t => t.taskCategory.toUpperCase() === 'IT');
    if (!hasItTasks) return;

    // Resolve the offboarding request + parent ticket for notification context
    const offboarding = await prisma.offboardingRequest.findUnique({
        where: { id: offboardingId },
        select: {
            requestId: true,
            employeeFirstName: true,
            employeeLastName: true,
            department: true,
            lastWorkingDay: true,
        },
    });
    if (!offboarding) return;

    // Read the dedicated IT agent from system settings (shared with onboarding)
    const itAgentSetting = await prisma.systemSetting.findUnique({
        where: { key: 'onboarding_it_agent_user_id' },
    });

    if (!itAgentSetting || !itAgentSetting.value) {
        logger.warn('[Offboarding] No dedicated IT agent configured (system setting "onboarding_it_agent_user_id" not set) — skipping IT task notification');
        return;
    }

    const itAgentId = itAgentSetting.value;

    // Verify the agent still exists and is active
    const itAgent = await prisma.user.findUnique({
        where: { id: itAgentId },
        select: { id: true, isActive: true },
    });

    if (!itAgent || !itAgent.isActive) {
        logger.warn(`[Offboarding] Configured IT agent ${itAgentId} not found or inactive — skipping IT task notification`);
        return;
    }

    const employeeName = `${offboarding.employeeFirstName} ${offboarding.employeeLastName}`;
    const itTaskCount = templates.filter(t => t.taskCategory.toUpperCase() === 'IT').length;

    await notifyMultiple(
        [itAgentId],
        'OFFBOARDING_IT_TASKS_CREATED',
        {
            employeeName,
            department: offboarding.department || '',
            lastWorkingDay: offboarding.lastWorkingDay.toLocaleDateString('en-GB'),
            itTaskCount: String(itTaskCount),
        },
        offboarding.requestId,
    );

    logger.info(`[Offboarding] Notified dedicated IT agent ${itAgentId} about ${itTaskCount} IT task(s) for ${employeeName}`);
}
