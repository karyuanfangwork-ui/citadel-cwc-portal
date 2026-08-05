import { Request, Response } from 'express';
import prisma from '../../utils/prisma';
import { asyncHandler, AppError } from '../../middleware/error.middleware';
import { resolveRequiredDocuments, resolveRequiredFields } from '../services/creditRuleEngine.service';

const db = prisma as any;

export const creditRuleConfigController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    const rules = await db.creditRuleConfig.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ status: 'success', data: { rules } });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const rule = await db.creditRuleConfig.create({
      data: req.body,
    });
    res.status(201).json({ status: 'success', data: { rule } });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const existing = await db.creditRuleConfig.findUnique({ where: { id } });
    if (!existing) throw new AppError('Rule config not found', 404);

    const rule = await db.creditRuleConfig.update({
      where: { id },
      data: req.body,
    });
    res.json({ status: 'success', data: { rule } });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const existing = await db.creditRuleConfig.findUnique({ where: { id } });
    if (!existing) throw new AppError('Rule config not found', 404);

    await db.creditRuleConfig.delete({ where: { id } });
    res.status(204).send();
  }),

  resolvedForApplication: asyncHandler(async (req: Request, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const app = await db.creditApplication.findUnique({
      where: { id: applicationId },
      include: { borrowerProfile: { select: { borrowerType: true } } },
    }) as any;

    if (!app) throw new AppError('Application not found', 404);

    const scope = {
      productType: app.productType ?? null,
      lane: (app.lane as string) ?? 'PERSONAL_FAST',
      borrowerType: app.borrowerProfile?.borrowerType ?? 'INDIVIDUAL',
    };

    const [documents, fields] = await Promise.all([
      resolveRequiredDocuments(scope),
      resolveRequiredFields(scope),
    ]);

    res.json({ status: 'success', data: { scope, documents, fields } });
  }),
};
