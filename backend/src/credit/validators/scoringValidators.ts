import { z } from 'zod';

// ============================================================================
// Scoring Governance Validators — P1.6
//
// Zod schemas that enforce structural invariants for credit scoring
// configuration: factor weight sums, rating band coverage, and
// market_conditions placeholder warnings.
// ============================================================================

// ---------------------------------------------------------------------------
// Factor Weight schemas
// ---------------------------------------------------------------------------

/**
 * Single factor weight entry — a named weight (e.g. { name: 'leverage', weight: 15 }).
 * Used when factor weights are stored as an array of named entries rather than
 * a flat object.
 */
export const factorWeightEntrySchema = z.object({
  name: z.string().min(1, 'Factor weight name is required'),
  weight: z.number().min(0, 'Weight must be >= 0').max(100, 'Weight must be <= 100'),
});

export type FactorWeightEntry = z.infer<typeof factorWeightEntrySchema>;

/**
 * Validates an array of factor weight entries.
 * Each entry must have name + weight fields.
 * Weights must sum to approximately 100 (within 0.01 tolerance).
 */
export const factorWeightsArraySchema = z
  .array(factorWeightEntrySchema)
  .min(1, 'At least one factor weight is required')
  .refine(
    (weights) => {
      const total = weights.reduce((sum, fw) => sum + fw.weight, 0);
      return Math.abs(total - 100) <= 0.01;
    },
    { message: 'Factor weights must sum to 100 (within 0.01 tolerance)' },
  );

/**
 * Factor weights as a flat object (legacy / existing format used in
 * CreditScorecardVersion.factorWeights). Each key is a factor name
 * and each value is a number 0–100.
 */
export const FACTOR_GROUP_NAMES = [
  'financial_performance',
  'leverage',
  'liquidity',
  'cashflow',
  'management',
  'industry',
  'collateral',
  'relationship',
  'market_conditions',
] as const;

export type FactorGroupName = (typeof FACTOR_GROUP_NAMES)[number];

export const factorWeightsObjectSchema = z
  .object(
    Object.fromEntries(
      FACTOR_GROUP_NAMES.map((name) => [
        name,
        z.number().min(0, `${name} weight must be >= 0`).max(100, `${name} weight must be <= 100`),
      ]),
    ),
  )
  .refine(
    (data) => {
      const total = Object.values(data as Record<string, number>).reduce(
        (sum, val) => sum + val,
        0,
      );
      return Math.abs(total - 100) <= 0.01;
    },
    { message: 'Factor weights must sum to 100 (within 0.01 tolerance)' },
  );

// ---------------------------------------------------------------------------
// Rating Band schemas
// ---------------------------------------------------------------------------

const RISK_RATINGS = [
  'AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D', 'NR',
] as const;

/**
 * Single rating band — maps a score range to a risk rating.
 */
export const ratingBandEntrySchema = z.object({
  min: z.number().min(0, 'Rating band min must be >= 0').max(100, 'Rating band min must be <= 100'),
  max: z.number().min(0, 'Rating band max must be >= 0').max(100, 'Rating band max must be <= 100'),
  rating: z.enum(RISK_RATINGS),
});

export type RatingBandEntry = z.infer<typeof ratingBandEntrySchema>;

/**
 * Validates an array of rating bands.
 * - No two bands may overlap (each score belongs to at most one band).
 * - The union of all bands must cover the full 0–100 range with no gaps.
 */
export const ratingBandsSchema = z
  .array(ratingBandEntrySchema)
  .min(1, 'At least one rating band is required')
  .refine(
    (bands) => {
      // Check each band: min <= max
      for (const band of bands) {
        if (band.min > band.max) return false;
      }
      // Sort bands by min to check for overlaps and gaps
      const sorted = [...bands].sort((a, b) => a.min - b.min);
      // First band must start at 0
      if (sorted[0].min !== 0) return false;
      // Last band must end at 100
      if (sorted[sorted.length - 1].max !== 100) return false;
      // Check for overlaps and gaps
      for (let i = 1; i < sorted.length; i++) {
        // Adjacent bands must be contiguous: previous max + 1 == current min
        // (since bands are integer-scored, a band ending at 19 and next starting
        // at 20 is contiguous)
        if (sorted[i - 1].max + 1 !== sorted[i].min) return false;
      }
      return true;
    },
    {
      message:
        'Rating bands must not overlap and must cover the full 0–100 range without gaps',
    },
  );

// ---------------------------------------------------------------------------
// CreditScorecardVersion input schema
// ---------------------------------------------------------------------------

/**
 * Full scorecard version input validator.
 * Validates factorWeights (array or object), retailFactorWeights (optional),
 * and ratingBands (optional for version creation but needed for governance).
 */
export const creditScorecardVersionInputSchema = z
  .object({
    factorWeights: factorWeightsArraySchema,
    retailFactorWeights: factorWeightsArraySchema.optional(),
    ratingBands: ratingBandsSchema.optional(),
  })
  .refine(
    (data) => {
      // If retailFactorWeights is provided, it must also sum to ~100
      if (data.retailFactorWeights) {
        const total = data.retailFactorWeights.reduce(
          (sum, fw) => sum + fw.weight,
          0,
        );
        return Math.abs(total - 100) <= 0.01;
      }
      return true;
    },
    {
      message: 'Retail factor weights must sum to 100 (within 0.01 tolerance)',
      path: ['retailFactorWeights'],
    },
  );

export type CreditScorecardVersionInput = z.infer<
  typeof creditScorecardVersionInputSchema
>;

// ---------------------------------------------------------------------------
// market_conditions placeholder warning
// ---------------------------------------------------------------------------

/**
 * Result of checking a scorecard version for governance warnings.
 * Warnings are non-blocking issues that should be surfaced to the user.
 */
export interface GovernanceWarning {
  field: string;
  message: string;
  severity: 'warning';
}

/**
 * Check a factorWeights array (or object) for governance warnings.
 * Currently checks:
 *   - market_conditions placeholder: if the weight is 0 or very low,
 *     or if market_conditions data source is missing, emit a warning.
 *
 * This function is called alongside Zod validation so that structural
 * errors are caught by the schema and *semantic* concerns surface as warnings.
 */
export function checkGovernanceWarnings(
  factorWeights: FactorWeightEntry[] | Record<string, number>,
): GovernanceWarning[] {
  const warnings: GovernanceWarning[] = [];

  // Normalize to array format
  const entries: FactorWeightEntry[] = Array.isArray(factorWeights)
    ? factorWeights
    : Object.entries(factorWeights).map(([name, weight]) => ({ name, weight }));

  const mc = entries.find(
    (e) => e.name === 'market_conditions',
  );

  if (mc) {
    // market_conditions currently has no real data source — the scoring
    // service always resolves it as a placeholder. If the weight is > 0
    // the factor affects scores without real data, which is a governance
    // concern. If the weight is 0 it's explicitly excluded, but the admin
    // should still be warned that the factor is unimplemented.
    warnings.push({
      field: 'market_conditions',
      message:
        mc.weight > 0
          ? `market_conditions has weight ${mc.weight} but uses a placeholder data source (NEUTRAL score). Consider setting weight to 0 until real market data is available.`
          : 'market_conditions is excluded (weight 0) because no real data source exists. Re-evaluate when market data integration is implemented.',
      severity: 'warning',
    });
  }

  return warnings;
}