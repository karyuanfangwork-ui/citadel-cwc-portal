/**
 * §6.2 — Credit Policy Limit Routes
 *
 * CRUD + evaluation endpoint for credit policy limits.
 */

import { Router, Response } from 'express';
import { authenticate, requirePermission, AuthRequest } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { validateUUID } from '../../middleware/uuidValidate.middleware';
import { z } from 'zod';
import { policyLimitService } from '../services/policyLimit.service';
import { asyncHandler, AppError } from '../../middleware/error.middleware';

const router = Router();
router.use(authenticate);

// ── Validators ─────────────────────────────────────────────────────────

const createLimitSchema = z.object({
  type: z.enum(['SINGLE_BORROWER', 'SECTOR', 'PRODUCT']),
  label: z.string().min(1).max(255),
  maxValue: z.number().positive(),
  thresholdPct: z.number().min(1).max(100).optional().default(80),
  currency: z.string().length(3).optional().default('MYR'),
  sector: z.string().max(100).optional(),
  productType: z.string().max(50).optional(),
});

const updateLimitSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  maxValue: z.number().positive().optional(),
  thresholdPct: z.number().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  sector: z.string().max(100).nullable().optional(),
  productType: z.string().max(50).nullable().optional(),
});

// ── CRUD Routes ───────────────────────────────────────────────────────

/**
 * GET /policy-limits
 * List all policy limits (optionally filter by type/isActive)
 * Requires: credit:admin
 */
router.get(
  '/',
  requirePermission('credit:admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const type = req.query.type as string | undefined;
    const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
    const result = await policyLimitService.listLimits(
      type ? { type: type as any, isActive } : isActive !== undefined ? { isActive } : undefined,
    );
    res.json(result);
  }),
);

/**
 * GET /policy-limits/:id
 * Get a single policy limit
 * Requires: credit:admin
 */
router.get(
  '/:id',
  requirePermission('credit:admin'),
  validateUUID('id'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await policyLimitService.getLimit(req.params.id as string);
    res.json(result);
  }),
);

/**
 * POST /policy-limits
 * Create a new policy limit
 * Requires: credit:admin
 */
router.post(
  '/',
  requirePermission('credit:admin'),
  validate(createLimitSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) throw new AppError('Unauthorized', 401);
    const result = await policyLimitService.createLimit({
      ...req.body,
      createdById: userId,
    });
    res.status(201).json(result);
  }),
);

/**
 * PATCH /policy-limits/:id
 * Update a policy limit
 * Requires: credit:admin
 */
router.patch(
  '/:id',
  requirePermission('credit:admin'),
  validateUUID('id'),
  validate(updateLimitSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await policyLimitService.updateLimit(req.params.id as string, req.body);
    res.json(result);
  }),
);

/**
 * DELETE /policy-limits/:id
 * Delete a policy limit
 * Requires: credit:admin
 */
router.delete(
  '/:id',
  requirePermission('credit:admin'),
  validateUUID('id'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await policyLimitService.deleteLimit(req.params.id as string);
    res.status(204).send();
  }),
);

// ── Evaluation Route ──────────────────────────────────────────────────

/**
 * GET /policy-limits/evaluate/:applicationId
 * Evaluate an application against all active policy limits
 * Returns hard blocks + soft warnings
 * Requires: credit:read
 */
router.get(
  '/evaluate/:applicationId',
  requirePermission('credit:read'),
  validateUUID('applicationId'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await policyLimitService.evaluatePolicy(req.params.applicationId as string);
    res.json(result);
  }),
);

export default router;