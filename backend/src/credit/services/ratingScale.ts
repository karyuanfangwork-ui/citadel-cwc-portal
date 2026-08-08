import { RiskRating } from '@prisma/client';

/**
 * The single rating scale for the credit module.
 *
 * Ascending from best to worst, matching the RiskRating Prisma enum. This is the
 * same ordering the approval matrix has always used (approvalMatrix.service.ts
 * RATING_ORDER) — that constant should now delegate here rather than keep its
 * own copy.
 *
 * Historical note: scoreOverride.service.ts previously defined a competing
 * 20-notch scale with modifier grades (AA+, BBB-, CCC+ ...) that the system does
 * not issue, and which omitted CC, C and NR. Notch deltas computed on it
 * disagreed with the deltas scoring.service.ts computed on this one, so the two
 * override paths applied different definitions of a "material" override.
 */
export const RATING_ORDINALS: Record<string, number> = {
  AAA: 1, AA: 2, A: 3, BBB: 4, BB: 5,
  B: 6, CCC: 7, CC: 8, C: 9, D: 10, NR: 11,
};

/** Sentinel for an unrecognised rating. Large so unknowns never look adjacent. */
export const UNKNOWN_RATING_ORDINAL = 99;

/** Overrides of this many notches or more require dual approval. */
export const MATERIAL_OVERRIDE_NOTCHES = 2;

export function isKnownRating(rating: string | null | undefined): boolean {
  return !!rating && Object.prototype.hasOwnProperty.call(RATING_ORDINALS, rating);
}

export function ratingOrdinal(rating: string | null | undefined): number {
  if (!isKnownRating(rating)) return UNKNOWN_RATING_ORDINAL;
  return RATING_ORDINALS[rating as string];
}

/**
 * Absolute notch distance between two ratings.
 *
 * When either rating is unrecognised the result is at least
 * MATERIAL_OVERRIDE_NOTCHES, so an unparseable rating fails safe into the
 * dual-approval path rather than slipping through as a trivial change.
 */
export function notchDelta(a: string, b: string): number {
  if (!isKnownRating(a) || !isKnownRating(b)) {
    return MATERIAL_OVERRIDE_NOTCHES;
  }
  return Math.abs(RATING_ORDINALS[a] - RATING_ORDINALS[b]);
}

/** Type guard for narrowing a validated string to the Prisma enum. */
export function asRiskRating(rating: string): RiskRating {
  if (!isKnownRating(rating)) {
    throw new Error(`Unknown risk rating: ${rating}`);
  }
  return rating as RiskRating;
}