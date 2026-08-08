/**
 * Rating Band Config Controller — Phase 5 admin CRUD for configurable
 * score-to-rating bands.
 */
import { Request, Response } from 'express';
import { getActiveRatingBands, seedDefaultRatingBands, ratingBandService } from '../services/ratingBand.service';
import { MUTABLE_BAND_STATUSES } from '../services/ratingBand.service';
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
  const band = await prisma.ratingBandConfig.create({
    data: {
      scoreMin,
      scoreMax,
      rating,
      riskCategory,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
      // LOS-010 — a newly created band is a DRAFT and has no approver yet.
      // approvedById is set by approveBandSet() when a checker actually approves.
      approvedById: null,
    },
  });
  res.status(201).json({ status: 'success', data: { band } });
});

/** PATCH /credit/rating-bands/:id — update a band config */
export const updateRatingBand = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };

  // LOS-010 — direct edits are only valid on a DRAFT band. Editing an ACTIVE
  // band's thresholds in place would change the live methodology without the
  // draft/submit/approve/activate lifecycle and without a maker-checker record.
  const existing = await prisma.ratingBandConfig.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!existing) {
    throw new AppError('Rating band not found', 404);
  }
  if (!MUTABLE_BAND_STATUSES.includes(existing.status)) {
    throw new AppError(
      `Cannot edit a ${existing.status} rating band. Create a new draft band set and take it through submit/approve/activate.`,
      400,
    );
  }

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

// ── LOS-010 — Governed lifecycle: DRAFT → SUBMITTED → APPROVED → ACTIVE ──

/** POST /credit/rating-bands/band-sets — create a draft band set */
export const createDraftBandSet = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id;
  const { name, description, bands } = req.body;
  if (!name || !Array.isArray(bands) || bands.length === 0) {
    throw new AppError('name and a non-empty bands array are required', 400);
  }
  const result = await ratingBandService.createDraftBandSet({ name, description, bands, makerId: actorId });
  res.status(201).json({ status: 'success', data: result });
});

/** POST /credit/rating-bands/band-sets/submit — submit a draft band set for approval */
export const submitBandSetForApproval = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id;
  const { bandIds } = req.body;
  if (!Array.isArray(bandIds) || bandIds.length === 0) {
    throw new AppError('bandIds must be a non-empty array', 400);
  }
  const count = await ratingBandService.submitBandSetForApproval(bandIds, actorId);
  res.json({ status: 'success', data: { submitted: count } });
});

/** POST /credit/rating-bands/band-sets/approve — approve a submitted band set */
export const approveBandSet = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id;
  const { bandIds } = req.body;
  if (!Array.isArray(bandIds) || bandIds.length === 0) {
    throw new AppError('bandIds must be a non-empty array', 400);
  }
  const count = await ratingBandService.approveBandSet(bandIds, actorId);
  res.json({ status: 'success', data: { approved: count } });
});

/** POST /credit/rating-bands/band-sets/activate — activate an approved band set */
export const activateBandSet = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id;
  const { bandIds } = req.body;
  if (!Array.isArray(bandIds) || bandIds.length === 0) {
    throw new AppError('bandIds must be a non-empty array', 400);
  }
  const result = await ratingBandService.activateBandSet(bandIds, actorId);
  res.json({ status: 'success', data: result });
});

/** GET /credit/rating-bands/band-sets/validate — validate the active band set */
export const validateActiveBandSet = asyncHandler(async (_req: Request, res: Response) => {
  const result = await ratingBandService.validateActiveBandSet();
  res.json({ status: 'success', data: result });
});