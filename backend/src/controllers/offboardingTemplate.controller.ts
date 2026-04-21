import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const listTemplates = async (req: Request, res: Response) => {
    try {
        const templates = await prisma.offboardingTaskTemplate.findMany({
            orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        });
        res.json({ data: templates });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
};

export const createTemplate = async (req: Request, res: Response) => {
    try {
        const { taskName, taskDescription, taskCategory, priority, dueDayOffset, displayOrder } = req.body;
        if (!taskName || !taskCategory || !priority) {
            return res.status(400).json({ error: 'taskName, taskCategory, and priority are required' });
        }
        const template = await prisma.offboardingTaskTemplate.create({
            data: {
                taskName,
                taskDescription: taskDescription || null,
                taskCategory,
                priority,
                dueDayOffset: dueDayOffset ?? 0,
                displayOrder: displayOrder ?? 0,
            },
        });
        res.status(201).json(template);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create template' });
    }
};

export const updateTemplate = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { taskName, taskDescription, taskCategory, priority, dueDayOffset, displayOrder, isActive } = req.body;
        const template = await prisma.offboardingTaskTemplate.update({
            where: { id },
            data: { taskName, taskDescription, taskCategory, priority, dueDayOffset, displayOrder, isActive },
        });
        res.json(template);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update template' });
    }
};

export const deleteTemplate = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.offboardingTaskTemplate.delete({ where: { id } });
        res.json({ message: 'Template deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete template' });
    }
};
