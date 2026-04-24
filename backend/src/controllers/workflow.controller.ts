import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/error.middleware';

const prisma = new PrismaClient();

// @desc    Get all workflow types
// @route   GET /api/v1/admin/workflows
// @access  Private (Admin only)
export const getWorkflowTypes = asyncHandler(async (req: Request, res: Response) => {
    const workflows = await prisma.workflowType.findMany({
        include: {
            steps: {
                orderBy: { displayOrder: 'asc' }
            },
            _count: {
                select: { requestTypes: true }
            }
        },
        orderBy: { displayOrder: 'asc' }
    });

    res.json(workflows);
});

// @desc    Get single workflow type by ID
// @route   GET /api/v1/admin/workflows/:id
// @access  Private (Admin only)
export const getWorkflowType = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const workflow = await prisma.workflowType.findUnique({
        where: { id },
        include: {
            steps: {
                orderBy: { displayOrder: 'asc' }
            }
        }
    });

    if (!workflow) {
        res.status(404);
        throw new Error('Workflow type not found');
    }

    res.json(workflow);
});

// @desc    Get workflow type by code
// @route   GET /api/v1/admin/workflows/code/:code
// @access  Private
export const getWorkflowTypeByCode = asyncHandler(async (req: Request, res: Response) => {
    const code = req.params.code as string;

    const workflow = await prisma.workflowType.findUnique({
        where: { code },
        include: {
            steps: {
                orderBy: { displayOrder: 'asc' }
            }
        }
    });

    if (!workflow) {
        res.status(404);
        throw new Error('Workflow type not found');
    }

    res.json(workflow);
});

// @desc    Create workflow type
// @route   POST /api/v1/admin/workflows
// @access  Private (Admin only)
export const createWorkflowType = asyncHandler(async (req: Request, res: Response) => {
    const { name, code, description, steps } = req.body;

    // Check if code already exists
    const existing = await prisma.workflowType.findUnique({
        where: { code }
    });

    if (existing) {
        res.status(400);
        throw new Error('Workflow type with this code already exists');
    }

    const workflow = await prisma.workflowType.create({
        data: {
            name,
            code,
            description,
            steps: steps ? {
                create: steps.map((step: { label: string; status: string; icon?: string; isInitial?: boolean; isFinal?: boolean }, index: number) => ({
                    label: step.label,
                    status: step.status,
                    icon: step.icon || 'radio_button_checked',
                    displayOrder: index + 1,
                    isInitial: step.isInitial || false,
                    isFinal: step.isFinal || false
                }))
            } : undefined
        },
        include: {
            steps: {
                orderBy: { displayOrder: 'asc' }
            }
        }
    });

    res.status(201).json(workflow);
});

// @desc    Update workflow type
// @route   PUT /api/v1/admin/workflows/:id
// @access  Private (Admin only)
export const updateWorkflowType = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { name, code, description, isActive, displayOrder } = req.body;

    const workflow = await prisma.workflowType.update({
        where: { id },
        data: {
            name,
            code,
            description,
            isActive,
            displayOrder
        },
        include: {
            steps: {
                orderBy: { displayOrder: 'asc' }
            }
        }
    });

    res.json(workflow);
});

// @desc    Delete workflow type (soft delete - set inactive)
// @route   DELETE /api/v1/admin/workflows/:id
// @access  Private (Admin only)
export const deleteWorkflowType = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;

    // Check if any request types are using this workflow
    const usageCount = await prisma.requestType.count({
        where: { workflowTypeId: id }
    });

    if (usageCount > 0) {
        res.status(400);
        throw new Error(`Cannot delete workflow. ${usageCount} request type(s) are using this workflow.`);
    }

    await prisma.workflowType.delete({
        where: { id }
    });

    res.json({ message: 'Workflow type deleted successfully' });
});

// @desc    Add step to workflow
// @route   POST /api/v1/admin/workflows/:id/steps
// @access  Private (Admin only)
export const addWorkflowStep = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { label, status, icon, isInitial, isFinal } = req.body;

    // Get current max display order
    const maxOrder = await prisma.workflowStep.aggregate({
        where: { workflowTypeId: id },
        _max: { displayOrder: true }
    });

    const nextOrder = (maxOrder._max.displayOrder || 0) + 1;

    const step = await prisma.workflowStep.create({
        data: {
            workflowTypeId: id,
            label,
            status,
            icon: icon || 'radio_button_checked',
            displayOrder: nextOrder,
            isInitial: isInitial || false,
            isFinal: isFinal || false
        }
    });

    res.status(201).json(step);
});

// @desc    Update workflow step
// @route   PUT /api/v1/admin/workflows/:id/steps/:stepId
// @access  Private (Admin only)
export const updateWorkflowStep = asyncHandler(async (req: Request, res: Response) => {
    const stepId = req.params.stepId as string;
    const { label, status, icon, isInitial, isFinal } = req.body;

    const step = await prisma.workflowStep.update({
        where: { id: stepId },
        data: {
            label,
            status,
            icon,
            isInitial,
            isFinal
        }
    });

    res.json(step);
});

// @desc    Delete workflow step
// @route   DELETE /api/v1/admin/workflows/:id/steps/:stepId
// @access  Private (Admin only)
export const deleteWorkflowStep = asyncHandler(async (req: Request, res: Response) => {
    const stepId = req.params.stepId as string;

    await prisma.workflowStep.delete({
        where: { id: stepId }
    });

    res.json({ message: 'Step deleted successfully' });
});

// @desc    Reorder workflow steps
// @route   PUT /api/v1/admin/workflows/:id/steps/reorder
// @access  Private (Admin only)
export const reorderWorkflowSteps = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { stepIds } = req.body as { stepIds: string[] };

    // Update display order for each step
    const updates = stepIds.map((stepId, index) =>
        prisma.workflowStep.update({
            where: { id: stepId },
            data: { displayOrder: index + 1 }
        })
    );

    await prisma.$transaction(updates);

    const workflow = await prisma.workflowType.findUnique({
        where: { id },
        include: {
            steps: {
                orderBy: { displayOrder: 'asc' }
            }
        }
    });

    res.json(workflow);
});