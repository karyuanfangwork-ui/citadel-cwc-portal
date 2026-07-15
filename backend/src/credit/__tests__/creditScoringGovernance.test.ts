/**
 * P1.6 — Scoring Governance Foundation Tests
 *
 * Validates Zod schemas and governance invariants for credit scoring
 * configuration:
 *   1. Factor weights sum to 100
 *   2. Rating bands don't overlap
 *   3. Rating bands cover the full 0–100 range
 *   4. market_conditions placeholder emits a warning (not silently skipped)
 *   5. Scorecard version has valid factor structure
 */

import {
  factorWeightsArraySchema,
  factorWeightsObjectSchema,
  ratingBandsSchema,
  ratingBandEntrySchema,
  creditScorecardVersionInputSchema,
  checkGovernanceWarnings,
  type FactorWeightEntry,
  type RatingBandEntry,
} from '../validators/scoringValidators';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Standard 9-factor weights that sum to 100 */
const validFactorWeights: FactorWeightEntry[] = [
  { name: 'financial_performance', weight: 20 },
  { name: 'leverage', weight: 15 },
  { name: 'liquidity', weight: 12 },
  { name: 'cashflow', weight: 18 },
  { name: 'management', weight: 10 },
  { name: 'industry', weight: 8 },
  { name: 'collateral', weight: 7 },
  { name: 'relationship', weight: 5 },
  { name: 'market_conditions', weight: 5 },
];

/** Valid rating bands covering 0–100 with no overlaps */
const validRatingBands: RatingBandEntry[] = [
  { min: 85, max: 100, rating: 'AAA' },
  { min: 78, max: 84, rating: 'AA' },
  { min: 70, max: 77, rating: 'A' },
  { min: 62, max: 69, rating: 'BBB' },
  { min: 55, max: 61, rating: 'BB' },
  { min: 48, max: 54, rating: 'B' },
  { min: 40, max: 47, rating: 'CCC' },
  { min: 30, max: 39, rating: 'CC' },
  { min: 20, max: 29, rating: 'C' },
  { min: 0, max: 19, rating: 'D' },
];

// ==========================================================================
// 1. Factor weights sum to 100
// ==========================================================================

describe('P1.6 Scoring Governance — Factor weights', () => {
  describe('factorWeightsArraySchema', () => {
    it('accepts factor weights that sum to exactly 100', () => {
      const result = factorWeightsArraySchema.safeParse(validFactorWeights);
      expect(result.success).toBe(true);
    });

    it('accepts factor weights that sum to 100.005 (within 0.01 tolerance)', () => {
      const weights = validFactorWeights.map((w, i) =>
        i === 0 ? { ...w, weight: 20.005 } : w,
      );
      const result = factorWeightsArraySchema.safeParse(weights);
      expect(result.success).toBe(true);
    });

    it('rejects factor weights that sum to less than 100', () => {
      const weights: FactorWeightEntry[] = [
        { name: 'financial_performance', weight: 20 },
        { name: 'leverage', weight: 15 },
        { name: 'market_conditions', weight: 5 },
        // Total = 40, not 100
      ];
      const result = factorWeightsArraySchema.safeParse(weights);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('sum to 100');
      }
    });

    it('rejects factor weights that sum to more than 100', () => {
      const weights = validFactorWeights.map((w) => ({
        ...w,
        weight: w.weight * 2,
      }));
      const result = factorWeightsArraySchema.safeParse(weights);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('sum to 100');
      }
    });

    it('rejects a weight above 100', () => {
      const weights = validFactorWeights.map((w, i) =>
        i === 0 ? { ...w, weight: 150 } : w,
      );
      const result = factorWeightsArraySchema.safeParse(weights);
      expect(result.success).toBe(false);
    });

    it('rejects a negative weight', () => {
      const weights = validFactorWeights.map((w, i) =>
        i === 0 ? { ...w, weight: -5 } : w,
      );
      const result = factorWeightsArraySchema.safeParse(weights);
      expect(result.success).toBe(false);
    });

    it('rejects an empty array', () => {
      const result = factorWeightsArraySchema.safeParse([]);
      expect(result.success).toBe(false);
    });

    it('rejects an entry missing the name field', () => {
      const weights = [
        { weight: 20 },
        { name: 'leverage', weight: 80 },
      ] as any;
      const result = factorWeightsArraySchema.safeParse(weights);
      expect(result.success).toBe(false);
    });

    it('rejects an entry missing the weight field', () => {
      const weights = [
        { name: 'financial_performance' },
        { name: 'leverage', weight: 80 },
      ] as any;
      const result = factorWeightsArraySchema.safeParse(weights);
      expect(result.success).toBe(false);
    });
  });

  describe('factorWeightsObjectSchema', () => {
    it('accepts a valid 9-factor object that sums to 100', () => {
      const obj = {
        financial_performance: 20,
        leverage: 15,
        liquidity: 12,
        cashflow: 18,
        management: 10,
        industry: 8,
        collateral: 7,
        relationship: 5,
        market_conditions: 5,
      };
      const result = factorWeightsObjectSchema.safeParse(obj);
      expect(result.success).toBe(true);
    });

    it('rejects a 9-factor object that does not sum to 100', () => {
      const obj = {
        financial_performance: 10,
        leverage: 10,
        liquidity: 10,
        cashflow: 10,
        management: 10,
        industry: 10,
        collateral: 10,
        relationship: 10,
        market_conditions: 5,
        // Total = 85
      };
      const result = factorWeightsObjectSchema.safeParse(obj);
      expect(result.success).toBe(false);
    });

    it('rejects an object missing a factor group key', () => {
      const obj = {
        financial_performance: 20,
        leverage: 15,
        liquidity: 12,
        cashflow: 18,
        management: 10,
        industry: 8,
        collateral: 7,
        relationship: 10,
        // missing market_conditions
      };
      const result = factorWeightsObjectSchema.safeParse(obj);
      expect(result.success).toBe(false);
    });
  });
});

// ==========================================================================
// 2. Rating bands don't overlap
// ==========================================================================

describe('P1.6 Scoring Governance — Rating band overlaps', () => {
  it('rejects overlapping rating bands', () => {
    const overlappingBands: RatingBandEntry[] = [
      { min: 0, max: 60, rating: 'A' },
      { min: 50, max: 100, rating: 'B' },
      // 50–60 is in both bands → overlap
    ];
    const result = ratingBandsSchema.safeParse(overlappingBands);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/overlap|cover/);
    }
  });

  it('rejects bands where one is fully contained in another', () => {
    const containedBands: RatingBandEntry[] = [
      { min: 0, max: 100, rating: 'A' },
      { min: 20, max: 80, rating: 'B' },
    ];
    const result = ratingBandsSchema.safeParse(containedBands);
    expect(result.success).toBe(false);
  });

  it('accepts valid non-overlapping bands', () => {
    const result = ratingBandsSchema.safeParse(validRatingBands);
    expect(result.success).toBe(true);
  });
});

// ==========================================================================
// 3. Rating bands cover the full 0–100 range
// ==========================================================================

describe('P1.6 Scoring Governance — Rating band full-range coverage', () => {
  it('rejects bands that do not start at 0', () => {
    const bandsMissingZero: RatingBandEntry[] = [
      { min: 10, max: 100, rating: 'A' },
    ];
    const result = ratingBandsSchema.safeParse(bandsMissingZero);
    expect(result.success).toBe(false);
  });

  it('rejects bands that do not reach 100', () => {
    const bandsMissing100: RatingBandEntry[] = [
      { min: 0, max: 90, rating: 'A' },
    ];
    const result = ratingBandsSchema.safeParse(bandsMissing100);
    expect(result.success).toBe(false);
  });

  it('rejects bands with a gap in the middle', () => {
    const bandsWithGap: RatingBandEntry[] = [
      { min: 0, max: 40, rating: 'A' },
      // Gap from 41 to 59
      { min: 60, max: 100, rating: 'B' },
    ];
    const result = ratingBandsSchema.safeParse(bandsWithGap);
    expect(result.success).toBe(false);
  });

  it('accepts bands that exactly cover 0–100 with no gaps', () => {
    const result = ratingBandsSchema.safeParse(validRatingBands);
    expect(result.success).toBe(true);
  });

  it('rejects a band where min > max', () => {
    const invalidBand: RatingBandEntry[] = [
      { min: 50, max: 40, rating: 'A' },
      { min: 41, max: 100, rating: 'B' },
    ];
    const result = ratingBandsSchema.safeParse(invalidBand);
    expect(result.success).toBe(false);
  });
});

// ==========================================================================
// 4. market_conditions placeholder emits a warning
// ==========================================================================

describe('P1.6 Scoring Governance — market_conditions warning', () => {
  it('emits a warning when market_conditions has weight > 0 (uses placeholder data)', () => {
    const warnings = checkGovernanceWarnings(validFactorWeights);
    const mcWarning = warnings.find((w) => w.field === 'market_conditions');
    expect(mcWarning).toBeDefined();
    expect(mcWarning!.severity).toBe('warning');
    expect(mcWarning!.message).toContain('placeholder');
  });

  it('emits a warning when market_conditions weight is 0 (excluded but unimplemented)', () => {
    const weights: FactorWeightEntry[] = validFactorWeights.map((w) =>
      w.name === 'market_conditions' ? { ...w, weight: 0 } : w,
    );
    const warnings = checkGovernanceWarnings(weights);
    const mcWarning = warnings.find((w) => w.field === 'market_conditions');
    expect(mcWarning).toBeDefined();
    expect(mcWarning!.severity).toBe('warning');
    expect(mcWarning!.message).toContain('excluded');
  });

  it('emits a warning for object-format factor weights with market_conditions > 0', () => {
    const obj = {
      financial_performance: 20,
      leverage: 15,
      liquidity: 12,
      cashflow: 18,
      management: 10,
      industry: 8,
      collateral: 7,
      relationship: 13,
      market_conditions: 5,
    };
    const warnings = checkGovernanceWarnings(obj);
    const mcWarning = warnings.find((w) => w.field === 'market_conditions');
    expect(mcWarning).toBeDefined();
    expect(mcWarning!.message).toContain('placeholder');
  });

  it('does NOT silently skip market_conditions — the warning is always emitted', () => {
    // The whole point: the scoring service silently resolves market_conditions
    // as a placeholder. checkGovernanceWarnings must ALWAYS surface this.
    const warnings = checkGovernanceWarnings(validFactorWeights);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings.some((w) => w.field === 'market_conditions')).toBe(true);
  });
});

// ==========================================================================
// 5. Scorecard version has valid factor structure
// ==========================================================================

describe('P1.6 Scoring Governance — Scorecard version structure', () => {
  it('accepts a valid scorecard version input', () => {
    const input = {
      factorWeights: validFactorWeights,
      ratingBands: validRatingBands,
    };
    const result = creditScorecardVersionInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts a scorecard version with retail factor weights', () => {
    const retailWeights: FactorWeightEntry[] = [
      { name: 'financial_performance', weight: 10 },
      { name: 'leverage', weight: 10 },
      { name: 'liquidity', weight: 10 },
      { name: 'cashflow', weight: 30 },
      { name: 'management', weight: 10 },
      { name: 'industry', weight: 10 },
      { name: 'collateral', weight: 10 },
      { name: 'relationship', weight: 5 },
      { name: 'market_conditions', weight: 5 },
    ];
    const input = {
      factorWeights: validFactorWeights,
      retailFactorWeights: retailWeights,
    };
    const result = creditScorecardVersionInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects retail factor weights that do not sum to 100', () => {
    const badRetail: FactorWeightEntry[] = [
      { name: 'cashflow', weight: 50 },
      { name: 'leverage', weight: 20 },
      // total = 70, not 100
    ];
    const input = {
      factorWeights: validFactorWeights,
      retailFactorWeights: badRetail,
    };
    const result = creditScorecardVersionInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects factor weights with invalid structure (missing name)', () => {
    const badWeights = [
      { weight: 50 },
      { name: 'leverage', weight: 50 },
    ] as any;
    const input = {
      factorWeights: badWeights,
    };
    const result = creditScorecardVersionInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('accepts a scorecard version without ratingBands (optional)', () => {
    const input = {
      factorWeights: validFactorWeights,
    };
    const result = creditScorecardVersionInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects overlapping rating bands in the scorecard version', () => {
    const badBands: RatingBandEntry[] = [
      { min: 0, max: 60, rating: 'A' },
      { min: 55, max: 100, rating: 'B' },
    ];
    const input = {
      factorWeights: validFactorWeights,
      ratingBands: badBands,
    };
    const result = creditScorecardVersionInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ==========================================================================
// ratingBandEntrySchema — unit-level validation
// ==========================================================================

describe('P1.6 Scoring Governance — ratingBandEntrySchema', () => {
  it('accepts a valid rating band entry', () => {
    const result = ratingBandEntrySchema.safeParse({
      min: 85,
      max: 100,
      rating: 'AAA',
    });
    expect(result.success).toBe(true);
  });

  it('rejects min below 0', () => {
    const result = ratingBandEntrySchema.safeParse({
      min: -1,
      max: 100,
      rating: 'AAA',
    });
    expect(result.success).toBe(false);
  });

  it('rejects max above 100', () => {
    const result = ratingBandEntrySchema.safeParse({
      min: 0,
      max: 101,
      rating: 'AAA',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid rating', () => {
    const result = ratingBandEntrySchema.safeParse({
      min: 0,
      max: 100,
      rating: 'INVALID',
    });
    expect(result.success).toBe(false);
  });
});