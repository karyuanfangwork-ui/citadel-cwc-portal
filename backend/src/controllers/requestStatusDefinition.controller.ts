import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/error.middleware';

const prisma = new PrismaClient();

export class RequestStatusDefinitionController {
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const { category } = req.query;
    const definitions = await prisma.requestStatusDefinition.findMany({
      where: category ? { category: String(category) } : undefined,
      orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
    });
    res.json({ status: 'success', data: { definitions } });
  });

  getActive = asyncHandler(async (req: Request, res: Response) => {
    const { category } = req.query;
    const definitions = await prisma.requestStatusDefinition.findMany({
      where: {
        isActive: true,
        ...(category ? { category: String(category) } : {}),
      },
      orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
    });
    res.json({ status: 'success', data: { definitions } });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const { code, label, description, category, displayOrder, isActive } = req.body;
    if (!code || !label) {
      return res.status(400).json({ status: 'error', message: 'code and label are required' });
    }
    const existing = await prisma.requestStatusDefinition.findUnique({ where: { code } });
    if (existing) {
      return res.status(409).json({ status: 'error', message: `Status definition with code '${code}' already exists` });
    }
    const definition = await prisma.requestStatusDefinition.create({
      data: { code, label, description, category, displayOrder: displayOrder ?? 0, isActive: isActive ?? true },
    });
    res.status(201).json({ status: 'success', data: { definition } });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { code, label, description, category, displayOrder, isActive } = req.body;
    if (code !== undefined) {
      const conflict = await prisma.requestStatusDefinition.findFirst({ where: { code, NOT: { id: String(id) } } });
      if (conflict) {
        return res.status(409).json({ status: 'error', message: `Status definition with code '${code}' already exists` });
      }
    }
    const definition = await prisma.requestStatusDefinition.update({
      where: { id: String(id) },
      data: { code, label, description, category, displayOrder, isActive },
    });
    res.json({ status: 'success', data: { definition } });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const definition = await prisma.requestStatusDefinition.findUnique({ where: { id: String(id) } });
    if (!definition) {
      return res.status(404).json({ status: 'error', message: 'Status definition not found' });
    }
    const bannerCount = await prisma.bannerConfig.count({ where: { status: definition.code } });
    if (bannerCount > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Cannot delete: ${bannerCount} banner config(s) reference this status code`,
      });
    }
    await prisma.requestStatusDefinition.delete({ where: { id: String(id) } });
    res.json({ status: 'success', message: 'Status definition deleted' });
  });
}
