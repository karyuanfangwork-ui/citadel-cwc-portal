import prisma from '../../utils/prisma';
import { RiskRating } from '../types/credit.types';

export interface RatingBand {
  scoreMin: number;
  scoreMax: number;
  rating: RiskRating;
  riskCategory: string;
}

// Hardcoded fallback — mirrors the canonical thresholds in scoring.service.ts
// so behavior is unchanged when no RatingBandConfig rows exist.
const FALLBACK_BANDS: RatingBand[] = [
  { scoreMin: 85, scoreMax: 100, rating: 'AAA' as RiskRating, riskCategory: 'LOW' },
  { scoreMin: 78, scoreMax: 84, rating: 'AA' as RiskRating, riskCategory: 'LOW' },
  { scoreMin: 70, scoreMax: 77, rating: 'A' as RiskRating, riskCategory: 'LOW' },
  { scoreMin: 62, scoreMax: 69, rating: 'BBB' as RiskRating, riskCategory: 'MODERATE' },
  { scoreMin: 55, scoreMax: 61, rating: 'BB' as RiskRating, riskCategory: 'MODERATE' },
  { scoreMin: 48, scoreMax: 54, rating: 'B' as RiskRating, riskCategory: 'MODERATE' },
  { scoreMin: 40, scoreMax: 47, rating: 'CCC' as RiskRating, riskCategory: 'HIGH' },
  { scoreMin: 30, scoreMax: 39, rating: 'CC' as RiskRating, riskCategory: 'HIGH' },
  { scoreMin: 20, scoreMax: 29, rating: 'C' as RiskRating, riskCategory: 'HIGH' },
  { scoreMin: 0, scoreMax: 19, rating: 'D' as RiskRating, riskCategory: 'PROHIBITED' },
];

/**
 * Get the active rating bands — either the configured RatingBandConfig rows
 * that are currently effective (effectiveFrom <= now AND (effectiveTo IS NULL
 * OR effectiveTo >= now)), or the hardcoded fallback if none are configured.
 */
export async function getActiveRatingBands(): Promise<RatingBand[]> {
  const now = new Date();
  const bands = await prisma.ratingBandConfig.findMany({
    where: {
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    orderBy: { scoreMin: 'desc' },
    select: {
      scoreMin: true,
      scoreMax: true,
      rating: true,
      riskCategory: true,
    },
  });

  if (bands.length === 0) {
    return FALLBACK_BANDS;
  }

  return bands.map((b) => ({
    scoreMin: b.scoreMin,
    scoreMax: b.scoreMax,
    rating: b.rating as RiskRating,
    riskCategory: b.riskCategory,
  }));
}

/**
 * Map a total score to a risk rating using the active configured bands,
 * falling back to the hardcoded thresholds when no bands are active.
 */
export async function mapScoreToRatingFromBands(totalScore: number): Promise<RiskRating> {
  const bands = await getActiveRatingBands();
  for (const band of bands) {
    if (totalScore >= band.scoreMin && totalScore <= band.scoreMax) {
      return band.rating;
    }
  }
  // Score below all band minimums — return the worst rating
  return bands[bands.length - 1]?.rating ?? ('D' as RiskRating);
}

/**
 * Seed the default rating bands (mirrors the canonical thresholds). Called
 * during deployment or manually. Idempotent — skips if bands already exist.
 */
export async function seedDefaultRatingBands(approvedById?: string): Promise<void> {
  const existing = await prisma.ratingBandConfig.count();
  if (existing > 0) return;

  await prisma.ratingBandConfig.createMany({
    data: FALLBACK_BANDS.map((b) => ({
      scoreMin: b.scoreMin,
      scoreMax: b.scoreMax,
      rating: b.rating as any,
      riskCategory: b.riskCategory,
      version: 1,
      approvedById: approvedById ?? null,
    })),
  });
}