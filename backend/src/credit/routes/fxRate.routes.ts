/**
 * §F23 — FX Rate Admin Routes
 *
 * CRUD endpoints for managing foreign exchange rates.
 * Requires credit:admin permission.
 */

import { Router, Response } from 'express';
import { authenticate, requirePermission, AuthRequest } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { validateUUID } from '../../middleware/uuidValidate.middleware';
import { z } from 'zod';
import { createFxRate, listFxRates } from '../services/fxRate.service';
import prisma from '../../utils/prisma';
import { asyncHandler, AppError } from '../../middleware/error.middleware';

const router = Router();
router.use(authenticate);

// ── Validators ─────────────────────────────────────────────────────────

const createFxRateSchema = z.object({
  currency: z.string().length(3, 'Currency must be a 3-letter ISO 4217 code'),
  rateToBase: z.number().positive('Rate must be positive'),
  effectiveDate: z.string().datetime({ message: 'effectiveDate must be an ISO 8601 date string' }),
});

// ── Routes ─────────────────────────────────────────────────────────────

/**
 * POST /fx-rates
 * Create a new FX rate entry.
 * Requires: credit:admin
 */
router.post(
  '/',
  requirePermission('credit:admin'),
  validate(createFxRateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { currency, rateToBase, effectiveDate } = req.body as z.infer<typeof createFxRateSchema>;

    const fxRate = await createFxRate({
      currency,
      rateToBase,
      effectiveDate: new Date(effectiveDate),
      createdById: req.user!.id,
    });

    res.status(201).json({ status: 'success', data: { fxRate } });
  }),
);

/**
 * GET /fx-rates
 * List FX rates, optionally filtered by currency.
 * Requires: credit:admin
 */
router.get(
  '/',
  requirePermission('credit:admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const currency = req.query.currency as string | undefined;
    const fxRates = await listFxRates(currency ? { currency } : undefined);
    res.json({ status: 'success', data: { fxRates } });
  }),
);

/**
 * GET /fx-rates/:id
 * Get a single FX rate by ID.
 * Requires: credit:admin
 */
router.get(
  '/:id',
  requirePermission('credit:admin'),
  validateUUID('id'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string;
    const fxRate = await prisma.creditFxRate.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!fxRate) {
      throw new AppError('FX rate not found', 404);
    }
    res.json({ status: 'success', data: { fxRate } });
  }),
);

/**
 * DELETE /fx-rates/:id
 * Delete an FX rate entry.
 * Requires: credit:admin
 */
router.delete(
  '/:id',
  requirePermission('credit:admin'),
  validateUUID('id'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string;
    const fxRate = await prisma.creditFxRate.findUnique({
      where: { id },
    });
    if (!fxRate) {
      throw new AppError('FX rate not found', 404);
    }
    await prisma.creditFxRate.delete({ where: { id } });
    res.json({ status: 'success', data: null });
  }),
);

export default router;