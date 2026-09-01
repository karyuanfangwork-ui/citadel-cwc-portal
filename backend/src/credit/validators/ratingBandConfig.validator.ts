/**
 * P2.4 — Rating Band Configuration Validator
 *
 * Zod schemas for rating band governance:
 *   - Full 0–100 coverage with no gaps or overlaps
 *   - Integer min/max, min ≤ max
 *   - Valid RiskRating and RiskCategory values
 *   - Version and approval metadata
 */

import { z } from 'zod';
// CA-P3-004a — risk_factor_matrices belongs to the legacy engine and its
// database CHECK constraint lists these six factors.
import { LEGACY_ENGINE_FACTORS } from '../services/riskTaxonomy';

// ---------------------------------------------------------------------------
// Rating band range schema
// ---------------------------------------------------------------------------

export const ratingBandRangeSchema = z.object({
  scoreMin: z.number().int().min(0).max(100),
  scoreMax: z.number().int().min(0).max(100),
  rating: z.enum([
    'AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D',
  ] as const),
  riskCategory: z.enum(['LOW', 'MODERATE', 'HIGH', 'PROHIBITED'] as const),
}).refine((data) => data.scoreMin <= data.scoreMax, {
  message: 'scoreMin must be <= scoreMax',
  path: ['scoreMin'],
});

export type RatingBandRangeInput = z.infer<typeof ratingBandRangeSchema>;

// ---------------------------------------------------------------------------
// Rating band set schema — validates full 0–100 coverage
// ---------------------------------------------------------------------------

export const ratingBandSetSchema = z.array(ratingBandRangeSchema)
  .min(1, 'Rating band set must have at least one band')
  .superRefine((bands, ctx) => {
    if (bands.length === 0) return;

    // Check full 0–100 coverage
    const sorted = [...bands].sort((a, b) => a.scoreMin - b.scoreMin);

    // Must start at 0
    if (sorted[0].scoreMin !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Rating band set must start at score 0, got ${sorted[0].scoreMin}`,
        path: [0, 'scoreMin'],
      });
    }

    // Must end at 100
    if (sorted[sorted.length - 1].scoreMax !== 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Rating band set must end at score 100, got ${sorted[sorted.length - 1].scoreMax}`,
        path: [sorted.length - 1, 'scoreMax'],
      });
    }

    // Check for gaps and overlaps
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      // Gap: previous max + 1 < current min
      if (curr.scoreMin > prev.scoreMax + 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Gap between bands: ${prev.rating} ends at ${prev.scoreMax} but ${curr.rating} starts at ${curr.scoreMin}`,
          path: [i, 'scoreMin'],
        });
      }

      // Overlap: previous max >= current min
      if (curr.scoreMin <= prev.scoreMax) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Overlap between bands: ${prev.rating} ends at ${prev.scoreMax} and ${curr.rating} starts at ${curr.scoreMin}`,
          path: [i, 'scoreMin'],
        });
      }
    }

    // No duplicate ratings
    const ratings = bands.map(b => b.rating);
    const duplicateRatings = ratings.filter((r, i) => ratings.indexOf(r) !== i);
    if (duplicateRatings.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate ratings: ${[...new Set(duplicateRatings)].join(', ')}`,
        path: [],
      });
    }
  });

// ---------------------------------------------------------------------------
// Governance lifecycle schema for rating band sets
// ---------------------------------------------------------------------------

export const ratingBandSetLifecycleSchema = z.object({
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'SUPERSEDED'] as const),
  version: z.number().int().positive(),
  effectiveFrom: z.date().optional().nullable(),
  effectiveTo: z.date().optional().nullable(),
  approvedById: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Rating band set creation schema (full payload)
// ---------------------------------------------------------------------------

export const createRatingBandSetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  bands: ratingBandSetSchema,
});

export type CreateRatingBandSetInput = z.infer<typeof createRatingBandSetSchema>;

// ---------------------------------------------------------------------------
// Rating band set activation schema
// ---------------------------------------------------------------------------

export const activateRatingBandSetSchema = z.object({
  effectiveFrom: z.date().optional().default(() => new Date()),
});

/** Route-level schemas for legacy/admin mutation endpoints. */
export const createRatingBandSchema = z.object({
  body: z.object({
    scoreMin: z.number().int().min(0).max(100),
    scoreMax: z.number().int().min(0).max(100),
    rating: z.enum(['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D']),
    riskCategory: z.enum(['LOW', 'MODERATE', 'HIGH', 'PROHIBITED']),
    effectiveFrom: z.coerce.date().optional(),
  }).refine((data) => data.scoreMin <= data.scoreMax, {
    message: 'scoreMin must be <= scoreMax', path: ['scoreMin'],
  }),
});

export const updateRatingBandSchema = z.object({
  body: z.object({
    scoreMin: z.number().int().min(0).max(100).optional(),
    scoreMax: z.number().int().min(0).max(100).optional(),
    rating: z.enum(['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D']).optional(),
    riskCategory: z.enum(['LOW', 'MODERATE', 'HIGH', 'PROHIBITED']).optional(),
    effectiveTo: z.coerce.date().optional().nullable(),
  }).superRefine((data, ctx) => {
    if (data.scoreMin !== undefined && data.scoreMax !== undefined && data.scoreMin > data.scoreMax) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'scoreMin must be <= scoreMax', path: ['scoreMin'] });
    }
  }),
});

export const upsertRiskFactorMatrixSchema = z.object({
  body: z.object({
    factor: z.enum(LEGACY_ENGINE_FACTORS),
    weight: z.number().min(0).max(100),
    threshold: z.number().optional().nullable(),
    reasonCodes: z.array(z.string().min(1).max(100)).optional().nullable(),
  }),
});

export const createDraftBandSetRouteSchema = z.object({ body: createRatingBandSetSchema });
export const bandIdsSchema = z.object({ body: z.object({ bandIds: z.array(z.string().uuid()).min(1) }) });