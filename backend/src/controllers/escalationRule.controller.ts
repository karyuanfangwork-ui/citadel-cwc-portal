import { Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

export const escalationRuleController = {
  listByRequestType: asyncHandler(async (req: AuthRequest, res: Response) => {
    const requestTypeId = req.params.requestTypeId as string;
    const rules = await prisma.escalationRule.findMany({
      where: { requestTypeId },
      orderBy: { triggerHoursAfterBreach: 'asc' },
    });
    res.json({ data: { rules } });
  }),

  create: asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { requestTypeId, triggerHoursAfterBreach, notifyRoles, label } = req.body;
    if (!requestTypeId || triggerHoursAfterBreach == null || !Array.isArray(notifyRoles)) {
      res.status(400).json({ message: 'requestTypeId, triggerHoursAfterBreach, and notifyRoles are required' });
      return;
    }
    const parsed = Number(triggerHoursAfterBreach);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      res.status(400).json({ message: 'triggerHoursAfterBreach must be a positive integer' });
      return;
    }
    const VALID_ROLES = ['ADMIN', 'AGENT', 'HR', 'IT', 'FINANCE', 'CEO', 'VP', 'GROUP_CEO'];
    if (notifyRoles.length === 0 || !notifyRoles.every((r: string) => VALID_ROLES.includes(r))) {
      res.status(400).json({ message: 'notifyRoles must be a non-empty array of valid role names' });
      return;
    }
    try {
      const rule = await prisma.escalationRule.create({
        data: {
          requestTypeId,
          triggerHoursAfterBreach: parsed,
          notifyRoles,
          label: label || null,
        },
      });
      res.status(201).json({ data: { rule } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        res.status(400).json({ message: 'Request type not found' });
        return;
      }
      throw err;
    }
  }),

  update: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string;
    const { triggerHoursAfterBreach, notifyRoles, label, isActive } = req.body;
    try {
      const rule = await prisma.escalationRule.update({
        where: { id },
        data: {
          ...(triggerHoursAfterBreach != null && { triggerHoursAfterBreach: parseInt(triggerHoursAfterBreach, 10) }),
          ...(notifyRoles !== undefined && { notifyRoles }),
          ...(label !== undefined && { label }),
          ...(isActive !== undefined && { isActive }),
        },
      });
      res.json({ data: { rule } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        res.status(404).json({ message: 'Escalation rule not found' });
        return;
      }
      throw err;
    }
  }),

  delete: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string;
    try {
      await prisma.escalationRule.delete({ where: { id } });
      res.json({ data: { message: 'Escalation rule deleted' } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        res.status(404).json({ message: 'Escalation rule not found' });
        return;
      }
      throw err;
    }
  }),
};
