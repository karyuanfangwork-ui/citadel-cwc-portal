import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';

import prisma from '../utils/prisma';

export class WorkflowTransitionController {
  getAll = asyncHandler(async (_req: Request, res: Response) => {
    const transitions = await prisma.workflowTransition.findMany({
      orderBy: [{ fromStatus: 'asc' }, { toStatus: 'asc' }],
    });
    res.json({ status: 'success', data: { transitions } });
  });

  getStatuses = asyncHandler(async (_req: Request, res: Response) => {
    const fromRows = await prisma.workflowTransition.findMany({ select: { fromStatus: true }, distinct: ['fromStatus'] });
    const toRows = await prisma.workflowTransition.findMany({ select: { toStatus: true }, distinct: ['toStatus'] });
    const statuses = [...new Set([...fromRows.map(r => r.fromStatus), ...toRows.map(r => r.toStatus)])].sort();
    res.json({ status: 'success', data: { statuses } });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const { fromStatus, toStatus, transitionLabel, requiresComment, autoAssignRole, autoAssignUserId, isActive } = req.body;

    if (!fromStatus || !toStatus) {
      res.status(400).json({ status: 'error', message: 'fromStatus and toStatus are required' });
      return;
    }
    if (fromStatus === toStatus) {
      res.status(400).json({ status: 'error', message: 'fromStatus and toStatus must be different' });
      return;
    }

    const existing = await prisma.workflowTransition.findFirst({
      where: { fromStatus, toStatus, tenantId: null, workflowTypeId: null },
    });
    if (existing) {
      res.status(409).json({ status: 'error', message: `Transition ${fromStatus} → ${toStatus} already exists` });
      return;
    }

    const transition = await prisma.workflowTransition.create({
      data: {
        fromStatus,
        toStatus,
        transitionLabel: transitionLabel ?? null,
        requiresComment: requiresComment ?? false,
        autoAssignRole: autoAssignRole ?? null,
        autoAssignUserId: autoAssignUserId ?? null,
        isActive: isActive ?? true,
      },
    });
    res.status(201).json({ status: 'success', data: { transition } });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { fromStatus, toStatus, transitionLabel, requiresComment, autoAssignRole, autoAssignUserId, isActive } = req.body;

    if (fromStatus !== undefined && toStatus !== undefined && fromStatus === toStatus) {
      res.status(400).json({ status: 'error', message: 'fromStatus and toStatus must be different' });
      return;
    }

    if (fromStatus !== undefined || toStatus !== undefined) {
      const current = await prisma.workflowTransition.findUnique({ where: { id: String(id) } });
      if (!current) {
        res.status(404).json({ status: 'error', message: 'Transition not found' });
        return;
      }
      const newFrom = fromStatus ?? current.fromStatus;
      const newTo = toStatus ?? current.toStatus;
      if (newFrom !== current.fromStatus || newTo !== current.toStatus) {
        const conflict = await prisma.workflowTransition.findFirst({
          where: { fromStatus: newFrom, toStatus: newTo, NOT: { id: String(id) } },
        });
        if (conflict) {
          res.status(409).json({ status: 'error', message: `Transition ${newFrom} → ${newTo} already exists` });
          return;
        }
      }
    }

    const transition = await prisma.workflowTransition.update({
      where: { id: String(id) },
      data: {
        ...(fromStatus !== undefined && { fromStatus }),
        ...(toStatus !== undefined && { toStatus }),
        ...(transitionLabel !== undefined && { transitionLabel }),
        ...(requiresComment !== undefined && { requiresComment }),
        ...(autoAssignRole !== undefined && { autoAssignRole }),
        ...(autoAssignUserId !== undefined && { autoAssignUserId }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json({ status: 'success', data: { transition } });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await prisma.workflowTransition.delete({ where: { id: String(id) } });
    res.json({ status: 'success', message: 'Transition deleted' });
  });
}
