import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/error.middleware';

const prisma = new PrismaClient();

const VALID_ROLES = ['staff', 'agent', 'ceo', 'hiring_manager', 'all'];
const VALID_COLOR_SCHEMES = ['blue', 'indigo', 'purple', 'amber', 'orange', 'green', 'emerald', 'yellow', 'red'];

export class BannerConfigController {
  getAll = asyncHandler(async (_req: Request, res: Response) => {
    const configs = await prisma.bannerConfig.findMany({
      orderBy: [{ role: 'asc' }, { status: 'asc' }],
    });
    res.json({ status: 'success', data: { configs } });
  });

  getActive = asyncHandler(async (_req: Request, res: Response) => {
    const configs = await prisma.bannerConfig.findMany({
      where: { isActive: true },
      orderBy: [{ role: 'asc' }, { status: 'asc' }],
    });
    res.json({ status: 'success', data: { configs } });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const { role, status, icon, title, description, colorScheme, isActive } = req.body;

    if (!role || !status || !icon || !title || !description || !colorScheme) {
      res.status(400).json({ status: 'error', message: 'role, status, icon, title, description, colorScheme are required' });
      return;
    }
    if (!VALID_ROLES.includes(role)) {
      res.status(400).json({ status: 'error', message: `role must be one of: ${VALID_ROLES.join(', ')}` });
      return;
    }
    if (!VALID_COLOR_SCHEMES.includes(colorScheme)) {
      res.status(400).json({ status: 'error', message: `colorScheme must be one of: ${VALID_COLOR_SCHEMES.join(', ')}` });
      return;
    }

    const config = await prisma.bannerConfig.create({
      data: { role, status, icon, title, description, colorScheme, isActive: isActive ?? true },
    });
    res.status(201).json({ status: 'success', data: { config } });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { role, status, icon, title, description, colorScheme, isActive } = req.body;

    if (role && !VALID_ROLES.includes(role)) {
      res.status(400).json({ status: 'error', message: `role must be one of: ${VALID_ROLES.join(', ')}` });
      return;
    }
    if (colorScheme && !VALID_COLOR_SCHEMES.includes(colorScheme)) {
      res.status(400).json({ status: 'error', message: `colorScheme must be one of: ${VALID_COLOR_SCHEMES.join(', ')}` });
      return;
    }

    if (role !== undefined || status !== undefined) {
      const current = await prisma.bannerConfig.findUnique({ where: { id }, select: { role: true, status: true } });
      if (!current) {
        res.status(404).json({ status: 'error', message: 'Banner config not found' });
        return;
      }
      const newRole = role ?? current.role;
      const newStatus = status ?? current.status;
      const conflict = await prisma.bannerConfig.findFirst({ where: { role: newRole, status: newStatus, NOT: { id } } });
      if (conflict) {
        res.status(409).json({ status: 'error', message: `Banner config for role="${newRole}" status="${newStatus}" already exists` });
        return;
      }
    }

    const config = await prisma.bannerConfig.update({
      where: { id },
      data: { role, status, icon, title, description, colorScheme, isActive },
    });
    res.json({ status: 'success', data: { config } });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await prisma.bannerConfig.delete({ where: { id } });
    res.json({ status: 'success', data: null });
  });
}

export const bannerConfigController = new BannerConfigController();
