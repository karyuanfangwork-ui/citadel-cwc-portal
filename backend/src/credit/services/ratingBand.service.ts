import prisma from '../../utils/prisma';
import { RiskRating } from '../types/credit.types';
import { AppError } from '../../middleware/error.middleware';
import { ratingBandSetSchema, createRatingBandSetSchema } from '../validators/ratingBandConfig.validator';
import { AuditChainService } from './auditChain.service';

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
    const result = await prisma.ratingBandConfig.findFirst({
      where: { status: { in: EFFECTIVE_BAND_STATUSES } },
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

  /**
   * Map a total score to a risk rating using the active configured bands.
   * P2.4: Returns null only when no DB-configured bands exist (unseeded DB).
   * When bands exist but the score falls outside all ranges, returns the worst rating.
   */
  async mapScoreToRatingFromBands(totalScore: number): Promise<RiskRating | null> {
    const bands = await this.getActiveRatingBands();

    if (bands.length === 0) {
      // Unseeded DB — caller falls back to the hardcoded map
      return null;
    }

    for (const band of bands) {
      if (totalScore >= band.scoreMin && totalScore <= band.scoreMax) {
        return band.rating;
      }
    }
    // Score below all band minimums — return the worst rating
    return bands[bands.length - 1].rating;
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
      return { valid: true, errors: [] };
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
  async createDraftBandSet(input: {
    name?: string;
    description?: string;
    bands: { scoreMin: number; scoreMax: number; rating: string; riskCategory: string }[];
    makerId: string;
  }): Promise<any[]> {
    // Validate the band set
    const validated = createRatingBandSetSchema.safeParse({ bands: input.bands, name: input.name, description: input.description });
    if (!validated.success) {
      throw new AppError(`Invalid rating band set: ${validated.error.errors.map(e => e.message).join('; ')}`, 400);
    }

    // Create all bands as DRAFT
    const created = await prisma.ratingBandConfig.createManyAndReturn({
      data: validated.data.bands.map((b) => ({
        scoreMin: b.scoreMin,
        scoreMax: b.scoreMax,
        rating: b.rating as any,
        riskCategory: b.riskCategory,
        status: 'DRAFT',
        name: input.name ?? null,
        description: input.description ?? null,
        version: 1,
        approvedById: null,
      })),
    });

    return created;
  }

  /**
   * Submit a DRAFT band set for approval.
   * Maker-checker: maker submits, approver approves.
   */
  async submitBandSetForApproval(bandIds: string[], _makerId: string): Promise<number> {
    const result = await prisma.ratingBandConfig.updateMany({
      where: { id: { in: bandIds }, status: 'DRAFT' },
      data: { status: 'SUBMITTED' },
    });
    return result.count;
  }

  /**
   * Approve a SUBMITTED band set.
   * P2.4 governance: only credit:admin can approve.
   */
  async approveBandSet(bandIds: string[], approverId: string): Promise<number> {
    const result = await prisma.ratingBandConfig.updateMany({
      where: { id: { in: bandIds }, status: 'SUBMITTED' },
      data: { status: 'APPROVED', approvedById: approverId },
    });

    // Audit the approval
    await AuditChainService.appendEvent(
      'RATING_BAND_CONFIG', // generic entity — audit chain may need adjustment
      'RATING_BAND_APPROVED',
      approverId,
      'approve_rating_band_set',
      null,
      null,
      { bandIds, count: result.count },
    );

    return result.count;
  }

  /**
   * Activate an APPROVED band set. Supersedes any currently ACTIVE set.
   * P2.4 governance: only credit:admin can activate.
   */
  async activateBandSet(bandIds: string[], adminId: string, effectiveFrom?: Date): Promise<{ activated: number; superseded: number }> {
    const now = effectiveFrom ?? new Date();

    // Find any currently ACTIVE bands and supersede them
    const supersededResult = await prisma.ratingBandConfig.updateMany({
      where: { status: 'ACTIVE' },
      data: { status: 'SUPERSEDED', effectiveTo: new Date(now.getTime() - 1) },
    });

    // Activate the approved bands
    const activatedResult = await prisma.ratingBandConfig.updateMany({
      where: { id: { in: bandIds }, status: 'APPROVED' },
      data: { status: 'ACTIVE', effectiveFrom: now },
    });

    // Audit the activation
    await AuditChainService.appendEvent(
      'RATING_BAND_CONFIG',
      'RATING_BAND_ACTIVATED',
      adminId,
      'activate_rating_band_set',
      null,
      null,
      { bandIds, activatedCount: activatedResult.count, supersededCount: supersededResult.count },
    );

    return { activated: activatedResult.count, superseded: supersededResult.count };
  }

  /**
   * Seed the canonical rating bands as ACTIVE v1.
   * Idempotent — skips if any ACTIVE bands exist.
   */
  async seedCanonicalBands(approverId?: string): Promise<number> {
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
  return ratingBandService.getActiveRatingBandsWithFallback();
}

export async function mapScoreToRatingFromBands(totalScore: number): Promise<RiskRating | null> {
  return ratingBandService.mapScoreToRatingFromBands(totalScore);
}

export async function seedDefaultRatingBands(approvedById?: string): Promise<void> {
  await ratingBandService.seedCanonicalBands(approvedById);
}