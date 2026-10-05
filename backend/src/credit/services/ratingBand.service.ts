import prisma from '../../utils/prisma';
import { RiskRating } from '../types/credit.types';
import { AppError } from '../../middleware/error.middleware';
import { ratingBandSetSchema, createRatingBandSetSchema } from '../validators/ratingBandConfig.validator';
import { PlatformAuditChainService } from '../../services/platformAuditChain.service';

/**
 * LOS-010 — Only an ACTIVE band set affects scoring.
 *
 * This previously accepted `['ACTIVE', 'APPROVED']`, so a set that had been
 * approved but never deliberately activated already changed live ratings.
 * Activation is the step that makes a methodology effective and it must be the
 * only thing scoring reads.
 */
export const EFFECTIVE_BAND_STATUSES: string[] = ['ACTIVE'];

/** Only a DRAFT band may be edited in place; anything further requires the lifecycle. */
export const MUTABLE_BAND_STATUSES: string[] = ['DRAFT'];

export interface RatingBand {
  scoreMin: number;
  scoreMax: number;
  rating: RiskRating;
  riskCategory: string;
}

// Canonical bands — the single source of truth for P2.4 seeding.
// These are seeded as ACTIVE v1 and must never be removed from production.
// The FALLBACK_BANDS constant below is DEPRECATED and will be removed
// once all environments have a seeded active band set.
const CANONICAL_BANDS: RatingBand[] = [
  { scoreMin: 85, scoreMax: 100, rating: RiskRating.AAA, riskCategory: 'LOW' },
  { scoreMin: 78, scoreMax: 84, rating: RiskRating.AA, riskCategory: 'LOW' },
  { scoreMin: 70, scoreMax: 77, rating: RiskRating.A, riskCategory: 'LOW' },
  { scoreMin: 62, scoreMax: 69, rating: RiskRating.BBB, riskCategory: 'MODERATE' },
  { scoreMin: 55, scoreMax: 61, rating: RiskRating.BB, riskCategory: 'MODERATE' },
  { scoreMin: 48, scoreMax: 54, rating: RiskRating.B, riskCategory: 'MODERATE' },
  { scoreMin: 40, scoreMax: 47, rating: RiskRating.CCC, riskCategory: 'HIGH' },
  { scoreMin: 30, scoreMax: 39, rating: RiskRating.CC, riskCategory: 'HIGH' },
  { scoreMin: 20, scoreMax: 29, rating: RiskRating.C, riskCategory: 'HIGH' },
  { scoreMin: 0, scoreMax: 19, rating: RiskRating.D, riskCategory: 'PROHIBITED' },
];

/** @deprecated Use mapScoreToRatingFromBands() instead. Static fallback for unseeded DBs. */
export const FALLBACK_BANDS = CANONICAL_BANDS;

type RatingBandGovernanceContext = {
  tenantId: string;
  actorId: string;
  actorEmail: string;
  departmentId?: string | null;
  correlationId?: string | null;
};

function requireGovernanceContext(context: RatingBandGovernanceContext): void {
  if (!context.tenantId || !context.actorId || !context.actorEmail) {
    throw new AppError('Tenant and authenticated actor context are required for rating-band governance.', 500);
  }
}

function appendBandSetAudit(
  context: RatingBandGovernanceContext,
  action: string,
  setId: string,
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown>,
  tx: any,
) {
  return PlatformAuditChainService.appendEvent({
    tenantId: context.tenantId,
    departmentId: context.departmentId,
    actorId: context.actorId,
    actorEmail: context.actorEmail,
    action,
    resourceType: 'RatingBandSet',
    resourceId: setId,
    correlationId: context.correlationId,
    oldValues,
    newValues,
  }, tx);
}

class RatingBandService {
  /**
   * Get the active rating bands — only returns APPROVED/ACTIVE bands from DB.
   * P2.4: No longer falls back to hardcoded bands in production scoring.
   * Callers that need fallback behavior should use getActiveRatingBandsWithFallback().
   */
  async getActiveRatingBands(): Promise<RatingBand[]> {
    const now = new Date();
    const bands = await prisma.ratingBandConfig.findMany({
      where: {
        status: { in: EFFECTIVE_BAND_STATUSES },
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      orderBy: { scoreMin: 'desc' },
      select: {
        id: true,
        scoreMin: true,
        scoreMax: true,
        rating: true,
        riskCategory: true,
        status: true,
      },
    });

    return bands.map((b) => ({
      scoreMin: b.scoreMin,
      scoreMax: b.scoreMax,
      rating: b.rating as RiskRating,
      riskCategory: b.riskCategory,
    }));
  }

  /**
   * LOS-014 — Get the version of the currently active band set.
   * Returns null if no active bands exist (unseeded DB).
   * The version is the same for all bands in a set (they are created/activated together),
   * so we take the max to be safe.
   */
  async getActiveBandSetVersion(): Promise<number | null> {
    const now = new Date();
    const result = await prisma.ratingBandConfig.findFirst({
      where: {
        status: { in: EFFECTIVE_BAND_STATUSES },
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return result?.version ?? null;
  }

  /**
   * Get active rating bands, falling back to CANONICAL_BANDS when DB is unseeded.
   * This is the safe version for scoring.service.ts which must always return a result.
   */
  async getActiveRatingBandsWithFallback(): Promise<RatingBand[]> {
    const bands = await this.getActiveRatingBands();
    if (bands.length > 0) return bands;
    // Unseeded DB — return canonical bands (same data, just not in DB yet)
    return CANONICAL_BANDS;
  }

  async resolveScoreToRatingWithVersion(totalScore: number): Promise<{ rating: RiskRating | null; version: number | null }> {
    const now = new Date();
    const bands = await prisma.ratingBandConfig.findMany({
      where: {
        status: { in: EFFECTIVE_BAND_STATUSES },
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      orderBy: { scoreMin: 'desc' },
      select: { scoreMin: true, scoreMax: true, rating: true, version: true, name: true, bandSetId: true },
    });
    if (bands.length === 0) return { rating: null, version: null };

    const activeSetKeys = new Set(bands.map((band) => band.bandSetId ?? `legacy:${band.name}:${band.version}`));
    if (activeSetKeys.size !== 1) {
      throw new AppError('Multiple effective rating-band sets are active; scoring is blocked until one set remains.', 409);
    }
    const versions = new Set(bands.map((band) => band.version));
    if (versions.size !== 1) {
      throw new AppError('The active rating-band set has inconsistent row versions; scoring is blocked.', 409);
    }

    const matches = bands.filter((band) => totalScore >= band.scoreMin && totalScore <= band.scoreMax);
    if (matches.length > 1) {
      throw new AppError('The active rating-band set contains overlapping ranges; scoring is blocked.', 409);
    }
    const selected = matches[0] ?? bands[bands.length - 1];
    return { rating: selected.rating as RiskRating, version: selected.version };
  }

  /** Map score with configured bands; null means no active configured bands. */
  async mapScoreToRatingFromBands(totalScore: number): Promise<RiskRating | null> {
    const resolved = await this.resolveScoreToRatingWithVersion(totalScore);
    return resolved.rating;
  }

  /**
   * Validate a rating band set configuration.
   * Checks full 0–100 coverage, no gaps, no overlaps, valid ratings.
   */
  validateBandSet(bands: { scoreMin: number; scoreMax: number; rating: string; riskCategory: string }[]): {
    valid: boolean;
    errors: string[];
  } {
    const result = ratingBandSetSchema.safeParse(bands);
    if (result.success) {
      const expectedCategory: Record<string, string> = {
        AAA: 'LOW', AA: 'LOW', A: 'LOW',
        BBB: 'MODERATE', BB: 'MODERATE', B: 'MODERATE',
        CCC: 'HIGH', CC: 'HIGH', C: 'HIGH',
        D: 'PROHIBITED',
      };
      const mappingErrors = bands.flatMap((band, index) => expectedCategory[band.rating] === band.riskCategory
        ? []
        : [`Band ${index + 1} rating ${band.rating} must use risk category ${expectedCategory[band.rating]}.`]);
      const sortedByScore = [...bands].sort((a, b) => a.scoreMin - b.scoreMin);
      const ratingOrder = ['D', 'C', 'CC', 'CCC', 'B', 'BB', 'BBB', 'A', 'AA', 'AAA'];
      const orderErrors: string[] = [];
      for (let index = 1; index < sortedByScore.length; index += 1) {
        if (ratingOrder.indexOf(sortedByScore[index].rating) <= ratingOrder.indexOf(sortedByScore[index - 1].rating)) {
          orderErrors.push(`Rating ${sortedByScore[index].rating} must rank above ${sortedByScore[index - 1].rating} as the score range increases.`);
        }
      }
      return { valid: mappingErrors.length === 0 && orderErrors.length === 0, errors: [...mappingErrors, ...orderErrors] };
    }
    return {
      valid: false,
      errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
    };
  }

  /**
   * Create a DRAFT rating band set.
   * Only the maker can create; approval/activation is a separate step.
   */
  async listBandSets() {
    return prisma.ratingBandSet.findMany({
      orderBy: [{ createdAt: 'desc' }, { version: 'desc' }],
      include: { bands: { orderBy: { scoreMin: 'asc' } } },
    });
  }

  async createDraftBandSet(input: {
    name: string;
    description?: string;
    reason: string;
    bands: { scoreMin: number; scoreMax: number; rating: string; riskCategory: string }[];
    context: RatingBandGovernanceContext;
  }) {
    requireGovernanceContext(input.context);
    if (typeof input.name !== 'string' || !input.name.trim()) {
      throw new AppError('A rating-band set name is required.', 400);
    }
    if (typeof input.reason !== 'string' || input.reason.trim().length < 5 || input.reason.length > 1000) {
      throw new AppError('A rating-band change reason of 5–1000 characters is required.', 400);
    }
    const validated = createRatingBandSetSchema.safeParse({ bands: input.bands, name: input.name, description: input.description });
    if (!validated.success) {
      throw new AppError(`Invalid rating band set: ${validated.error.errors.map((error) => error.message).join('; ')}`, 400);
    }
    const bandErrors = this.validateBandSet(validated.data.bands);
    if (!bandErrors.valid) throw new AppError(bandErrors.errors.join(' '), 400);
    return prisma.$transaction(async (tx) => {
      const standaloneDrafts = await tx.ratingBandConfig.findMany({
        where: { status: 'DRAFT', bandSetId: null },
        select: { id: true, name: true, version: true, scoreMin: true, scoreMax: true, rating: true, riskCategory: true },
      });
      const groups = new Map<string, typeof standaloneDrafts>();
      for (const row of standaloneDrafts) {
        const key = `${row.name ?? ''}::${row.version}`;
        groups.set(key, [...(groups.get(key) ?? []), row]);
      }
      const proposedBands = [...validated.data.bands].sort((a, b) => a.scoreMin - b.scoreMin);
      const exactCandidateGroups = [...groups.values()].filter((group) => {
        if (group.length !== proposedBands.length || !this.validateBandSet(group).valid) return false;
        const candidate = [...group].sort((a, b) => a.scoreMin - b.scoreMin);
        return candidate.every((band, index) => {
          const proposal = proposedBands[index];
          return band.scoreMin === proposal.scoreMin && band.scoreMax === proposal.scoreMax
            && band.rating === proposal.rating && band.riskCategory === proposal.riskCategory;
        });
      });
      if (exactCandidateGroups.length > 1) {
        throw new AppError('Multiple standalone draft sets exactly match this proposal; reconcile the duplicate candidates before linking one.', 409);
      }
      const exactCandidate = exactCandidateGroups[0];

      const latest = await tx.ratingBandSet.findFirst({
        where: { name: input.name.trim() },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const version = (latest?.version ?? 0) + 1;
      const now = new Date();
      const set = await tx.ratingBandSet.create({
        data: {
          name: input.name.trim(),
          description: input.description ?? null,
          reason: input.reason.trim(),
          version,
          status: 'DRAFT',
          createdById: input.context.actorId,
          effectiveFrom: now,
        },
      });

      let persistedBands;
      let linkedExistingBandIds: string[] = [];
      if (exactCandidate) {
        linkedExistingBandIds = exactCandidate.map((band) => band.id);
        const linked = await tx.ratingBandConfig.updateMany({
          where: { id: { in: linkedExistingBandIds }, status: 'DRAFT', bandSetId: null },
          data: { bandSetId: set.id },
        });
        if (linked.count !== linkedExistingBandIds.length) {
          throw new AppError('Standalone candidate set changed concurrently; creation was rolled back.', 409);
        }
        persistedBands = await tx.ratingBandConfig.findMany({ where: { bandSetId: set.id }, orderBy: { scoreMin: 'asc' } });
      } else {
        persistedBands = await tx.ratingBandConfig.createManyAndReturn({
          data: validated.data.bands.map((band) => ({
            scoreMin: band.scoreMin,
            scoreMax: band.scoreMax,
            rating: band.rating as RiskRating,
            riskCategory: band.riskCategory,
            status: 'DRAFT',
            name: set.name,
            description: set.description,
            version: set.version,
            bandSetId: set.id,
            approvedById: null,
            effectiveFrom: now,
          })),
        });
      }
      await appendBandSetAudit(input.context, 'CREDIT_RATING_BAND_SET_CREATED', set.id, null, {
        status: 'DRAFT',
        name: set.name,
        version: set.version,
        reason: set.reason,
        bandIds: persistedBands.map((band) => band.id),
        bandCount: persistedBands.length,
        linkedExistingBandIds,
        proposalSource: exactCandidate ? 'exact-matching-unattributed-draft-import' : 'new-human-authored-set',
        priorCandidateMaker: exactCandidate ? 'unknown; not inferred' : null,
      }, tx);
      return { ...set, bands: persistedBands };
    });
  }


  async submitBandSetForApproval(setId: string, context: RatingBandGovernanceContext) {
    requireGovernanceContext(context);
    return prisma.$transaction(async (tx) => {
      const set = await tx.ratingBandSet.findUnique({ where: { id: setId }, include: { bands: true } });
      if (!set) throw new AppError('Rating-band set not found.', 404);
      if (set.status !== 'DRAFT') throw new AppError('Only a DRAFT rating-band set can be submitted.', 409);
      if (set.createdById !== context.actorId) throw new AppError('Only the set maker can submit this rating-band draft.', 403);
      const validation = this.validateBandSet(set.bands);
      if (!validation.valid) throw new AppError(validation.errors.join(' '), 400);

      const transition = await tx.ratingBandSet.updateMany({
        where: { id: setId, status: 'DRAFT', createdById: context.actorId },
        data: { status: 'SUBMITTED', submittedById: context.actorId, submittedAt: new Date() },
      });
      if (transition.count !== 1) throw new AppError('Rating-band set changed concurrently; reload and retry submission.', 409);
      const bandTransition = await tx.ratingBandConfig.updateMany({
        where: { bandSetId: setId, status: 'DRAFT' },
        data: { status: 'SUBMITTED' },
      });
      if (bandTransition.count !== set.bands.length) throw new AppError('Rating-band membership changed; submission was rolled back.', 409);
      const updated = await tx.ratingBandSet.findUnique({ where: { id: setId }, include: { bands: true } });
      await appendBandSetAudit(context, 'CREDIT_RATING_BAND_SET_SUBMITTED', setId, { status: 'DRAFT' }, {
        status: 'SUBMITTED', name: set.name, version: set.version, bandCount: set.bands.length,
      }, tx);
      return updated;
    });
  }

  async approveBandSet(setId: string, context: RatingBandGovernanceContext) {
    requireGovernanceContext(context);
    return prisma.$transaction(async (tx) => {
      const set = await tx.ratingBandSet.findUnique({ where: { id: setId }, include: { bands: true } });
      if (!set) throw new AppError('Rating-band set not found.', 404);
      if (set.status !== 'SUBMITTED') throw new AppError('Only a SUBMITTED rating-band set can be approved.', 409);
      if (context.actorId === set.createdById || context.actorId === set.submittedById) {
        throw new AppError('Rating-band approval requires a checker different from the maker and submitter.', 403);
      }
      const validation = this.validateBandSet(set.bands);
      if (!validation.valid) throw new AppError(validation.errors.join(' '), 400);

      const transition = await tx.ratingBandSet.updateMany({
        where: { id: setId, status: 'SUBMITTED', approvedById: null },
        data: { status: 'APPROVED', approvedById: context.actorId, approvedAt: new Date() },
      });
      if (transition.count !== 1) throw new AppError('Rating-band set changed concurrently; reload and retry approval.', 409);
      const bandTransition = await tx.ratingBandConfig.updateMany({
        where: { bandSetId: setId, status: 'SUBMITTED' },
        data: { status: 'APPROVED', approvedById: context.actorId },
      });
      if (bandTransition.count !== set.bands.length) throw new AppError('Rating-band membership changed; approval was rolled back.', 409);
      const updated = await tx.ratingBandSet.findUnique({ where: { id: setId }, include: { bands: true } });
      await appendBandSetAudit(context, 'CREDIT_RATING_BAND_SET_APPROVED', setId, { status: 'SUBMITTED' }, {
        status: 'APPROVED', name: set.name, version: set.version, bandCount: set.bands.length,
      }, tx);
      return updated;
    });
  }

  async activateBandSet(setId: string, context: RatingBandGovernanceContext, policyApprovalReference: string) {
    requireGovernanceContext(context);
    if (!policyApprovalReference?.trim() || policyApprovalReference.trim().length < 5 || policyApprovalReference.trim().length > 200) {
      throw new AppError('A policy-owner approval reference of 5–200 characters is required.', 400);
    }

    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('credit-rating-band-set-activation'))`;
      const set = await tx.ratingBandSet.findUnique({ where: { id: setId }, include: { bands: true } });
      if (!set) throw new AppError('Rating-band set not found.', 404);
      if (set.status !== 'APPROVED' || !set.approvedById) throw new AppError('Only an APPROVED rating-band set can be activated.', 409);
      if (context.actorId === set.createdById || context.actorId === set.submittedById || context.actorId === set.approvedById) {
        throw new AppError('Rating-band activation requires an operator distinct from the maker, submitter, and checker.', 403);
      }
      const validation = this.validateBandSet(set.bands);
      if (!validation.valid) throw new AppError(validation.errors.join(' '), 400);
      const unmanagedActiveBands = await tx.ratingBandConfig.count({ where: { status: 'ACTIVE', bandSetId: null } });
      if (unmanagedActiveBands > 0) {
        throw new AppError('Active unmanaged rating bands exist; reconcile them into a reviewed set before activation.', 409);
      }

      const now = new Date();
      const activeSets = await tx.ratingBandSet.findMany({ where: { status: 'ACTIVE' }, include: { bands: true } });
      for (const activeSet of activeSets) {
        const previousValidation = this.validateBandSet(activeSet.bands);
        if (!previousValidation.valid || activeSet.bands.length === 0) {
          throw new AppError(`Active rating-band set v${activeSet.version} is incomplete or invalid; activation was rolled back.`, 409);
        }
        const rows = await tx.ratingBandConfig.updateMany({
          where: { bandSetId: activeSet.id, status: 'ACTIVE' },
          data: { status: 'SUPERSEDED', effectiveTo: new Date(now.getTime() - 1) },
        });
        if (rows.count !== activeSet.bands.length) throw new AppError('Active rating-band membership changed; activation was rolled back.', 409);
        await tx.ratingBandSet.update({ where: { id: activeSet.id }, data: { status: 'SUPERSEDED', effectiveTo: new Date(now.getTime() - 1) } });
      }

      const transition = await tx.ratingBandSet.updateMany({
        where: { id: setId, status: 'APPROVED', approvedById: set.approvedById },
        data: {
          status: 'ACTIVE',
          activatedById: context.actorId,
          activatedAt: now,
          effectiveFrom: now,
          effectiveTo: null,
          policyApprovalReference: policyApprovalReference.trim(),
        },
      });
      if (transition.count !== 1) throw new AppError('Rating-band set changed concurrently; reload and retry activation.', 409);
      const activated = await tx.ratingBandConfig.updateMany({
        where: { bandSetId: setId, status: 'APPROVED' },
        data: { status: 'ACTIVE', effectiveFrom: now, effectiveTo: null },
      });
      if (activated.count !== set.bands.length) throw new AppError('Rating-band membership changed; activation was rolled back.', 409);
      const updated = await tx.ratingBandSet.findUnique({ where: { id: setId }, include: { bands: true } });
      await appendBandSetAudit(context, 'CREDIT_RATING_BAND_SET_ACTIVATED', setId, { status: 'APPROVED' }, {
        status: 'ACTIVE',
        name: set.name,
        version: set.version,
        bandCount: activated.count,
        policyApprovalReference: policyApprovalReference.trim(),
        supersededSetIds: activeSets.map((activeSet) => activeSet.id),
      }, tx);
      return { set: updated, activated: activated.count, superseded: activeSets.length };
    });
  }


  /**
   * Seed the canonical rating bands as ACTIVE v1.
   * Idempotent — skips if any ACTIVE bands exist.
   */
  async seedCanonicalBands(approverId?: string): Promise<number> {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('Canonical rating-band seeding is disabled in production; use the reviewed maker-checker activation lifecycle.', 403);
    }
    const existing = await prisma.ratingBandConfig.count({
      where: { status: { in: ['ACTIVE', 'APPROVED'] } },
    });
    if (existing > 0) return 0;

    await prisma.ratingBandConfig.createMany({
      data: CANONICAL_BANDS.map((b) => ({
        scoreMin: b.scoreMin,
        scoreMax: b.scoreMax,
        rating: b.rating as any,
        riskCategory: b.riskCategory,
        status: 'ACTIVE',
        name: 'Canonical Rating Bands v1',
        version: 1,
        approvedById: approverId ?? null,
        effectiveFrom: new Date(),
      })),
    });

    return CANONICAL_BANDS.length;
  }

  /**
   * Smoke validation: verify an active band set exists and maps boundary scores correctly.
   * Returns { ok: boolean, errors: string[] }.
   */
  async validateActiveBandSet(): Promise<{ ok: boolean; errors: string[] }> {
    const bands = await this.getActiveRatingBands();
    const errors: string[] = [];

    if (bands.length === 0) {
      errors.push('No active rating band set found. Seed canonical bands or activate an approved set.');
      return { ok: false, errors };
    }

    // Verify 0–100 coverage
    const sorted = [...bands].sort((a, b) => a.scoreMin - b.scoreMin);
    if (sorted[0].scoreMin !== 0) {
      errors.push(`Active band set does not start at 0 (starts at ${sorted[0].scoreMin}).`);
    }
    if (sorted[sorted.length - 1].scoreMax !== 100) {
      errors.push(`Active band set does not end at 100 (ends at ${sorted[sorted.length - 1].scoreMax}).`);
    }

    // Verify no gaps
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].scoreMin > sorted[i - 1].scoreMax + 1) {
        errors.push(`Gap between ${sorted[i - 1].rating} (${sorted[i - 1].scoreMax}) and ${sorted[i].rating} (${sorted[i].scoreMin}).`);
      }
    }

    // Verify boundary scores map correctly
    const boundaryTests: [number, RiskRating][] = [
      [100, RiskRating.AAA], [85, RiskRating.AAA], [84, RiskRating.AA], [70, RiskRating.A], [62, RiskRating.BBB],
      [55, RiskRating.BB], [48, RiskRating.B], [40, RiskRating.CCC], [30, RiskRating.CC], [20, RiskRating.C], [0, RiskRating.D],
    ];
    for (const [score, expected] of boundaryTests) {
      const found = bands.find(b => score >= b.scoreMin && score <= b.scoreMax);
      if (!found) {
        errors.push(`Score ${score} does not map to any band (expected ${expected}).`);
      } else if (found.rating !== expected) {
        errors.push(`Score ${score} maps to ${found.rating} but expected ${expected}.`);
      }
    }

    return { ok: errors.length === 0, errors };
  }
}

export const ratingBandService = new RatingBandService();

// Re-export named functions for backward compatibility
export async function getActiveRatingBands(): Promise<RatingBand[]> {
  return ratingBandService.getActiveRatingBands();
}

export async function resolveScoreToRatingWithVersion(totalScore: number): Promise<{ rating: RiskRating | null; version: number | null }> {
  return ratingBandService.resolveScoreToRatingWithVersion(totalScore);
}

export async function mapScoreToRatingFromBands(totalScore: number): Promise<RiskRating | null> {
  return ratingBandService.mapScoreToRatingFromBands(totalScore);
}

export async function seedDefaultRatingBands(approvedById?: string): Promise<void> {
  await ratingBandService.seedCanonicalBands(approvedById);
}