/**
 * Rating Band Config Controller — Phase 5 admin CRUD for configurable
 * score-to-rating bands.
 */
import { Request, Response } from 'express';
import { seedDefaultRatingBands, ratingBandService } from '../services/ratingBand.service';
import { MUTABLE_BAND_STATUSES } from '../services/ratingBand.service';
import prisma from '../../utils/prisma';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';

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
  const bands = await ratingBandService.getActiveRatingBands();
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
      status: 'DRAFT',
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
    select: { status: true, bandSetId: true },
  });
  if (!existing) {
    throw new AppError('Rating band not found', 404);
  }
  if (existing.bandSetId) {
    throw new AppError('Bands inside a versioned set are immutable; create a new draft version to change methodology.', 409);
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

function ratingBandGovernanceContext(req: Request) {
  const actor = (req as AuthRequest).user;
  if (!actor?.id || !actor.email || !actor.tenantId) {
    throw new AppError('Tenant and authenticated actor context are required for rating-band governance.', 500);
  }
  return {
    actorId: actor.id,
    actorEmail: actor.email,
    tenantId: actor.tenantId,
    correlationId: req.get('x-correlation-id'),
  };
}

/** GET /credit/rating-bands/band-sets — list immutable versioned sets */
export const listRatingBandSets = asyncHandler(async (_req: Request, res: Response) => {
  const sets = await ratingBandService.listBandSets();
  res.json({ status: 'success', data: { sets } });
});

/** POST /credit/rating-bands/band-sets — create a complete human-owned draft */
export const createDraftBandSet = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, reason, bands } = req.body;
  const set = await ratingBandService.createDraftBandSet({
    name,
    description,
    reason,
    bands,
    context: ratingBandGovernanceContext(req),
  });
  res.status(201).json({ status: 'success', data: { set } });
});

export const submitBandSetForApproval = asyncHandler(async (req: Request, res: Response) => {
  const set = await ratingBandService.submitBandSetForApproval(String(req.params.id), ratingBandGovernanceContext(req));
  res.json({ status: 'success', data: { set } });
});

export const approveBandSet = asyncHandler(async (req: Request, res: Response) => {
  const set = await ratingBandService.approveBandSet(String(req.params.id), ratingBandGovernanceContext(req));
  res.json({ status: 'success', data: { set } });
});

export const activateBandSet = asyncHandler(async (req: Request, res: Response) => {
  const result = await ratingBandService.activateBandSet(
    String(req.params.id),
    ratingBandGovernanceContext(req),
    String(req.body.policyApprovalReference ?? ''),
  );
  res.json({ status: 'success', data: result });
});

/** GET /credit/rating-bands/band-sets/validate — validate the active band set */
export const validateActiveBandSet = asyncHandler(async (_req: Request, res: Response) => {
  const result = await ratingBandService.validateActiveBandSet();
  res.json({ status: 'success', data: result });
});