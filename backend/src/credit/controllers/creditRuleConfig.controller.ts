import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import prisma from '../../utils/prisma';
import { asyncHandler, AppError } from '../../middleware/error.middleware';
import { resolveRequiredDocuments, resolveRequiredFields } from '../services/creditRuleEngine.service';
import { creditRuleConfigSetService } from '../services/creditRuleConfigSet.service';

const db = prisma as any;

export const creditRuleConfigController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    const rules = await db.creditRuleConfig.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ status: 'success', data: { rules } });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const data = req.body.kind === 'REQUIRED_FIELD'
      ? { ...req.body, isActive: false }
      : req.body;
    const rule = await db.creditRuleConfig.create({ data });
    res.status(201).json({ status: 'success', data: { rule } });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const existing = await db.creditRuleConfig.findUnique({
      where: { id },
      select: { id: true, kind: true },
    });
    if (!existing) throw new AppError('Rule config not found', 404);
    if (existing.kind === 'REQUIRED_FIELD') {
      throw new AppError('Required-field rules are immutable through legacy CRUD; create a governed rule-set version instead.', 409);
    }

    const rule = await db.creditRuleConfig.update({
      where: { id },
      data: req.body,
    });
    res.json({ status: 'success', data: { rule } });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const existing = await db.creditRuleConfig.findUnique({
      where: { id },
      select: { id: true, kind: true },
    });
    if (!existing) throw new AppError('Rule config not found', 404);
    if (existing.kind === 'REQUIRED_FIELD') {
      throw new AppError('Required-field rules cannot be deleted through legacy CRUD; preserve candidates and manage active versions through the governed lifecycle.', 409);
    }

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

function requiredRuleSetContext(req: AuthRequest) {
  const actor = req.user;
  if (!actor?.id || !actor.email || !actor.tenantId) {
    throw new AppError('Tenant and authenticated actor context are required for rule-set governance.', 500);
  }
  return {
    actorId: actor.id,
    actorEmail: actor.email,
    tenantId: actor.tenantId,
    correlationId: req.get('x-correlation-id'),
  };
}

export const listRequiredFieldRuleSets = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const ruleSets = await creditRuleConfigSetService.list();
  res.json({ status: 'success', data: { ruleSets } });
});

export const getRequiredFieldRuleSet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ruleSet = await creditRuleConfigSetService.get(String(req.params.id));
  res.json({ status: 'success', data: { ruleSet } });
});

export const createRequiredFieldRuleSet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ruleSet = await creditRuleConfigSetService.create(req.body, requiredRuleSetContext(req));
  res.status(201).json({ status: 'success', data: { ruleSet } });
});

export const submitRequiredFieldRuleSet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ruleSet = await creditRuleConfigSetService.submit(String(req.params.id), requiredRuleSetContext(req));
  res.json({ status: 'success', data: { ruleSet } });
});

export const approveRequiredFieldRuleSet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ruleSet = await creditRuleConfigSetService.approve(String(req.params.id), requiredRuleSetContext(req));
  res.json({ status: 'success', data: { ruleSet } });
});

export const activateRequiredFieldRuleSet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ruleSet = await creditRuleConfigSetService.activate(
    String(req.params.id),
    requiredRuleSetContext(req),
    String(req.body.policyApprovalReference ?? ''),
  );
  res.json({ status: 'success', data: { ruleSet } });
});
