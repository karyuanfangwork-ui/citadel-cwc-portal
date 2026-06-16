import { Response } from 'express';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

import prisma from '../utils/prisma';

class EntityController {
    // ── Public: active entities for dropdown ─────────────────────

    listActiveEntities = asyncHandler(async (_req: AuthRequest, res: Response) => {
        const entities = await prisma.entity.findMany({
            where: { isActive: true },
            orderBy: { displayOrder: 'asc' },
            select: {
                id: true,
                name: true,
                code: true,
            },
        });
        res.json({ status: 'success', data: { entities } });
    });

    // ── Entity CRUD ──────────────────────────────────────────────────

    listEntities = asyncHandler(async (_req: AuthRequest, res: Response) => {
        const entities = await prisma.entity.findMany({
            orderBy: { displayOrder: 'asc' },
            include: {
                approver: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
            },
        });
        res.json({ status: 'success', data: { entities } });
    });

    createEntity = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { name, code, description, approverId } = req.body;

        if (!name || !code || !approverId) {
            throw new AppError('name, code, and approverId are required', 400);
        }

        const approver = await prisma.user.findUnique({ where: { id: approverId } });
        if (!approver || !approver.isActive) {
            throw new AppError('Approver user not found or inactive', 400);
        }

        // Auto-assign displayOrder: max existing + 10
        const maxOrder = await prisma.entity.aggregate({ _max: { displayOrder: true } });
        const nextOrder = (maxOrder._max.displayOrder ?? 0) + 10;

        const entity = await prisma.entity.create({
            data: {
                name: name.trim(),
                code: code.trim().toUpperCase(),
                description: description?.trim() || null,
                approverId,
                displayOrder: nextOrder,
            },
            include: {
                approver: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
            },
        });

        res.status(201).json({ status: 'success', data: { entity } });
    });

    updateEntity = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.id);
        const { name, code, description, approverId, isActive } = req.body;

        const existing = await prisma.entity.findUnique({ where: { id } });
        if (!existing) throw new AppError('Entity not found', 404);

        if (approverId) {
            const approver = await prisma.user.findUnique({ where: { id: approverId } });
            if (!approver || !approver.isActive) {
                throw new AppError('Approver user not found or inactive', 400);
            }
        }

        const entity = await prisma.entity.update({
            where: { id },
            data: {
                ...(name !== undefined && { name: name.trim() }),
                ...(code !== undefined && { code: code.trim().toUpperCase() }),
                ...(description !== undefined && { description: description?.trim() || null }),
                ...(approverId !== undefined && { approverId }),
                ...(isActive !== undefined && { isActive }),
            },
            include: {
                approver: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
            },
        });

        res.json({ status: 'success', data: { entity } });
    });

    // ── Reorder ─────────────────────────────────────────────────────

    reorderEntities = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id, direction }: { id: string; direction: 'up' | 'down' } = req.body;

        if (!id || !['up', 'down'].includes(direction)) {
            throw new AppError('id and direction (up|down) are required', 400);
        }

        const current = await prisma.entity.findUnique({ where: { id } });
        if (!current) throw new AppError('Entity not found', 404);

        const swapWith = direction === 'up'
            ? await prisma.entity.findFirst({
                where: { displayOrder: { lt: current.displayOrder } },
                orderBy: { displayOrder: 'desc' },
              })
            : await prisma.entity.findFirst({
                where: { displayOrder: { gt: current.displayOrder } },
                orderBy: { displayOrder: 'asc' },
              });

        if (!swapWith) {
            res.json({ status: 'success', data: { entities: null } });
            return;
        }

        // Swap displayOrder values
        const tempOrder = current.displayOrder;
        await prisma.entity.update({ where: { id: current.id }, data: { displayOrder: swapWith.displayOrder } });
        await prisma.entity.update({ where: { id: swapWith.id }, data: { displayOrder: tempOrder } });

        const entities = await prisma.entity.findMany({
            orderBy: { displayOrder: 'asc' },
            include: {
                approver: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
            },
        });

        res.json({ status: 'success', data: { entities } });
    });

    // ── Routing Rules CRUD ───────────────────────────────────────────

    listRoutingRules = asyncHandler(async (req: AuthRequest, res: Response) => {
        const requestTypeId = String(req.params.requestTypeId);

        const rules = await prisma.requestTypeEntityRouting.findMany({
            where: { requestTypeId },
            orderBy: { createdAt: 'asc' },
        });

        res.json({ status: 'success', data: { rules } });
    });

    createRoutingRule = asyncHandler(async (req: AuthRequest, res: Response) => {
        const requestTypeId = String(req.params.requestTypeId);
        const { routingMode, customFieldKey, label } = req.body;

        if (!routingMode || !['REQUESTER_ENTITY', 'CUSTOM_FIELD'].includes(routingMode)) {
            throw new AppError('routingMode must be REQUESTER_ENTITY or CUSTOM_FIELD', 400);
        }
        if (routingMode === 'CUSTOM_FIELD' && !customFieldKey) {
            throw new AppError('customFieldKey is required for CUSTOM_FIELD mode', 400);
        }

        const requestType = await prisma.requestType.findUnique({ where: { id: requestTypeId } });
        if (!requestType) throw new AppError('Request type not found', 404);

        const rule = await prisma.requestTypeEntityRouting.create({
            data: {
                requestTypeId,
                routingMode,
                customFieldKey: customFieldKey?.trim() || null,
                label: label?.trim() || null,
            },
        });

        res.status(201).json({ status: 'success', data: { rule } });
    });

    deleteRoutingRule = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.ruleId);

        const rule = await prisma.requestTypeEntityRouting.findUnique({ where: { id } });
        if (!rule) throw new AppError('Routing rule not found', 404);

        await prisma.requestTypeEntityRouting.delete({ where: { id } });

        res.json({ status: 'success', data: null });
    });
}

export const entityController = new EntityController();