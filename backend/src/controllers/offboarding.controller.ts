import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

const resignationStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const dir = path.join(__dirname, '../../uploads/resignation-letters');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const suffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `resignation-${suffix}${path.extname(file.originalname)}`);
    },
});

export const resignationUpload = multer({
    storage: resignationStorage,
    fileFilter: (_req, file, cb) => {
        const allowed = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/png',
        ];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only PDF, DOC, DOCX, JPG, PNG files are allowed'));
    },
    limits: { fileSize: 10 * 1024 * 1024 },
});

export const createOffboardingRequest = async (req: Request, res: Response) => {
    try {
        const { id: requestId } = req.params;
        const {
            employeeFirstName,
            employeeLastName,
            employeeEmail,
            department,
            managerId,
            lastWorkingDay,
            reasonForDeparture,
        } = req.body;

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
        const { id: requestId } = req.params;

        const offboarding = await prisma.offboardingRequest.findUnique({
            where: { requestId },
            include: {
                request: true,
                manager: { select: { id: true, firstName: true, lastName: true, email: true, department: true } },
                employee: { select: { id: true, firstName: true, lastName: true, email: true } },
                tasks: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        assignedToUser: { select: { id: true, firstName: true, lastName: true, email: true } },
                    },
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
        const { id: requestId } = req.params;
        const { overallStatus, currentPhase, exitInterviewScheduledDate, ...rest } = req.body;
        const updates = {
            ...rest,
            ...(exitInterviewScheduledDate !== undefined && {
                exitInterviewScheduledDate: exitInterviewScheduledDate
                    ? new Date(exitInterviewScheduledDate.includes('T') ? exitInterviewScheduledDate : exitInterviewScheduledDate + 'T00:00:00.000Z')
                    : null,
            }),
        };

        // Gate: advancing to FINAL_WEEK requires resignation letter + exit interview date
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

        // Gate: can only complete from EXIT_PROCEDURES phase — check BEFORE updating
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

        const statusMap: Record<string, string> = {
            'NOTICE_PERIOD':       'OFFBOARDING_NOTICE_PERIOD',
            'KNOWLEDGE_TRANSFER':  'OFFBOARDING_KNOWLEDGE_TRANSFER',
            'FINAL_WEEK':          'OFFBOARDING_FINAL_WEEK',
            'EXIT_PROCEDURES':     'OFFBOARDING_EXIT_PROCEDURES',
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
                data: { status: 'OFFBOARDING_COMPLETED', closedAt: new Date() },
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
        const { id: requestId } = req.params;
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
        const { id: requestId } = req.params;

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
        const { taskId } = req.params;
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
        const { taskId } = req.params;
        await prisma.offboardingTask.delete({ where: { id: taskId } });
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting offboarding task:', error);
        res.status(500).json({ error: 'Failed to delete offboarding task' });
    }
};

export const getOffboardingProgress = async (req: Request, res: Response) => {
    try {
        const { id: requestId } = req.params;

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
        const { id: requestId } = req.params;
        const file = (req as any).file;
        const userId = (req as any).user?.id;
        const userName = `${(req as any).user?.firstName || ''} ${(req as any).user?.lastName || ''}`.trim();

        if (!file) return res.status(400).json({ error: 'File is required' });

        const offboarding = await prisma.offboardingRequest.findUnique({ where: { requestId } });
        if (!offboarding) return res.status(404).json({ error: 'Offboarding request not found' });

        // Delete old file if present
        if (offboarding.resignationLetterUrl) {
            const oldPath = path.join(__dirname, '../../', offboarding.resignationLetterUrl);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        const fileUrl = `/uploads/resignation-letters/${file.filename}`;

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

        res.json({
            fileUrl,
            fileName: file.originalname,
            resignationLetterAttached: true,
        });
    } catch (error) {
        console.error('Error uploading resignation letter:', error);
        res.status(500).json({ error: 'Failed to upload resignation letter' });
    }
};

export const deleteResignationLetter = async (req: Request, res: Response) => {
    try {
        const { id: requestId } = req.params;

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
}
