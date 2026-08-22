import { Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { createRedisClient } from '../utils/redis';
import { logger } from '../utils/logger';

const redis = createRedisClient();
const ROLE_CACHE_KEY = 'sla:escalation:valid-roles';
const ROLE_CACHE_TTL_SECONDS = 300;

async function getValidRoleNames(): Promise<string[]> {
  try {
    const cached = await redis.get(ROLE_CACHE_KEY);
    if (cached) return JSON.parse(cached) as string[];
  } catch (err) {
    logger.warn('Escalation role cache read failed', { err });
  }

  const roles = await prisma.role.findMany({ select: { name: true } });
  const names = roles.map(({ name }) => name);
  try {
    await redis.setex(ROLE_CACHE_KEY, ROLE_CACHE_TTL_SECONDS, JSON.stringify(names));
  } catch (err) {
    logger.warn('Escalation role cache write failed', { err });
  }
  return names;
}

function isKnownPrismaError(err: unknown, code: string): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;
}

export const escalationRuleController = {
  listByRequestType: asyncHandler(async (req: AuthRequest, res: Response) => {
    const requestTypeId = req.params.requestTypeId as string;
    const rules = await prisma.escalationRule.findMany({
      where: { requestTypeId },
      orderBy: { triggerHoursAfterBreach: 'asc' },
    });
    res.json({ data: { rules } });
  }),

  listOverview: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { deskId, categoryId, requestTypeId } = req.query as {
      deskId?: string;
      categoryId?: string;
      requestTypeId?: string;
    };
    const requestTypeWhere = {
      ...(requestTypeId ? { id: requestTypeId } : {}),
      ...(categoryId ? { serviceCategoryId: categoryId } : {}),
      ...(deskId ? { serviceCategory: { serviceDeskId: deskId } } : {}),
    };
    const rules = await prisma.escalationRule.findMany({
      where: Object.keys(requestTypeWhere).length > 0 ? { requestType: requestTypeWhere } : undefined,
      include: {
        requestType: {
          select: {
            id: true,
            name: true,
            slaHours: true,
            serviceCategory: {
              select: {
                id: true,
                name: true,
                serviceDesk: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { triggerHoursAfterBreach: 'asc' },
    });
    res.json({ data: { rules } });
  }),

  create: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { requestTypeId, notifyRoles, label } = req.body;
    let { triggerHoursAfterBreach } = req.body;
    if (!requestTypeId || triggerHoursAfterBreach == null || !Array.isArray(notifyRoles)) {
      res.status(400).json({ message: 'requestTypeId, triggerHoursAfterBreach, and notifyRoles are required' });
      return;
    }
    triggerHoursAfterBreach = Number(triggerHoursAfterBreach);
    if (!Number.isInteger(triggerHoursAfterBreach) || triggerHoursAfterBreach < 0 || triggerHoursAfterBreach > 720) {
      res.status(400).json({ message: 'triggerHoursAfterBreach must be an integer between 0 and 720' });
      return;
    }
    const validRoles = await getValidRoleNames();
    if (notifyRoles.length === 0 || !notifyRoles.every((r: string) => validRoles.includes(r))) {
      res.status(400).json({ message: 'notifyRoles must be a non-empty array of valid role names' });
      return;
    }
    try {
      const rule = await prisma.escalationRule.create({
        data: { requestTypeId, triggerHoursAfterBreach, notifyRoles, label: label || null },
      });
      res.status(201).json({ data: { rule } });
    } catch (err) {
      if (isKnownPrismaError(err, 'P2003')) {
        res.status(400).json({ message: 'Request type not found' });
        return;
      }
      if (isKnownPrismaError(err, 'P2002')) {
        res.status(409).json({ message: 'An escalation rule with this trigger time already exists for this request type' });
        return;
      }
      throw err;
    }
  }),

  update: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string;
    const { triggerHoursAfterBreach, notifyRoles, label, isActive } = req.body;
    try {
      if (notifyRoles !== undefined) {
        const validRoles = await getValidRoleNames();
        if (!Array.isArray(notifyRoles) || notifyRoles.length === 0 || !notifyRoles.every((r: string) => validRoles.includes(r))) {
          res.status(400).json({ message: 'notifyRoles must be a non-empty array of valid role names' });
          return;
        }
      }
      if (triggerHoursAfterBreach !== undefined && (!Number.isInteger(Number(triggerHoursAfterBreach)) || Number(triggerHoursAfterBreach) < 0 || Number(triggerHoursAfterBreach) > 720)) {
        res.status(400).json({ message: 'triggerHoursAfterBreach must be an integer between 0 and 720' });
        return;
      }
      const rule = await prisma.escalationRule.update({
        where: { id },
        data: {
          ...(triggerHoursAfterBreach != null && { triggerHoursAfterBreach: Number(triggerHoursAfterBreach) }),
          ...(notifyRoles !== undefined && { notifyRoles }),
          ...(label !== undefined && { label }),
          ...(isActive !== undefined && { isActive }),
        },
      });
      res.json({ data: { rule } });
    } catch (err) {
      if (isKnownPrismaError(err, 'P2025')) {
        res.status(404).json({ message: 'Escalation rule not found' });
        return;
      }
      if (isKnownPrismaError(err, 'P2002')) {
        res.status(409).json({ message: 'An escalation rule with this trigger time already exists for this request type' });
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
      if (isKnownPrismaError(err, 'P2025')) {
        res.status(404).json({ message: 'Escalation rule not found' });
        return;
      }
      throw err;
    }
  }),
};
