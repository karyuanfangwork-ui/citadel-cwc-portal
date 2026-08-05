/**
 * Rating Band Config Controller — Phase 5 admin CRUD for configurable
 * score-to-rating bands.
 */
import { Request, Response } from 'express';
import { getActiveRatingBands, seedDefaultRatingBands } from '../services/ratingBand.service';
import prisma from '../../utils/prisma';
import { AppError, asyncHandler } from '../../middleware/error.middleware';

/** GET /credit/rating-bands — list all band configs */
export const listRatingBands = asyncHandler(async (_req: Request, res: Response) => {
  const bands = await prisma.ratingBandConfig.findMany({
    orderBy: { scoreMin: 'asc' },
    include: {
      approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  res.json({ status: 'success', data: { bands } });
});

/** GET /credit/rating-bands/active — list currently effective bands */
export const getActiveBands = asyncHandler(async (_req: Request, res: Response) => {
  const bands = await getActiveRatingBands();
  res.json({ status: 'success', data: { bands } });
});

/** POST /credit/rating-bands — create a new band config */
export const createRatingBand = asyncHandler(async (req: Request, res: Response) => {
  const { scoreMin, scoreMax, rating, riskCategory, effectiveFrom } = req.body;
  if (scoreMin == null || scoreMax == null || !rating || !riskCategory) {
    throw new AppError('scoreMin, scoreMax, rating, and riskCategory are required', 400);
  }
  const actorId = (req as any).user?.id;
  const band = await prisma.ratingBandConfig.create({
    data: {
      scoreMin,
      scoreMax,
      rating,
      riskCategory,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
      approvedById: actorId ?? null,
    },
  });
  res.status(201).json({ status: 'success', data: { band } });
});

/** PATCH /credit/rating-bands/:id — update a band config */
export const updateRatingBand = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { scoreMin, scoreMax, rating, riskCategory, effectiveTo } = req.body;
  const band = await prisma.ratingBandConfig.update({
    where: { id },
    data: {
      ...(scoreMin != null ? { scoreMin } : {}),
      ...(scoreMax != null ? { scoreMax } : {}),
      ...(rating ? { rating } : {}),
      ...(riskCategory ? { riskCategory } : {}),
      ...(effectiveTo != null ? { effectiveTo: new Date(effectiveTo) } : {}),
    },
  });
  res.json({ status: 'success', data: { band } });
});

/** POST /credit/rating-bands/seed — seed default bands (idempotent) */
export const seedBands = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id;
  await seedDefaultRatingBands(actorId);
  res.json({ status: 'success', data: { message: 'Default bands seeded' } });
});

/** GET /credit/rating-bands/risk-factors — list all risk factor configs */
export const listRiskFactorMatrices = asyncHandler(async (_req: Request, res: Response) => {
  const matrices = await prisma.riskFactorMatrix.findMany({
    where: { isActive: true },
    orderBy: { factor: 'asc' },
  });
  res.json({ status: 'success', data: { matrices } });
});

/** POST /credit/rating-bands/risk-factors — create/update a risk factor config */
export const upsertRiskFactorMatrix = asyncHandler(async (req: Request, res: Response) => {
  const { factor, weight, threshold, reasonCodes } = req.body;
  if (!factor || weight == null) {
    throw new AppError('factor and weight are required', 400);
  }
  // Deactivate any existing active matrix for this factor, then create a new one
  await prisma.riskFactorMatrix.updateMany({
    where: { factor, isActive: true },
    data: { isActive: false, effectiveTo: new Date() },
  });
  const matrix = await prisma.riskFactorMatrix.create({
    data: {
      factor,
      weight,
      threshold: threshold ?? null,
      reasonCodes: reasonCodes ?? null,
      isActive: true,
    },
  });
  res.status(201).json({ status: 'success', data: { matrix } });
});