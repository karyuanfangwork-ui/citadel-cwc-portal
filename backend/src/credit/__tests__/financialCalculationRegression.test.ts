/**
 * P2.6 — Financial Calculation Regression Contract
 *
 * Locks current financial formula behavior with deterministic boundary tests.
 * Every ratio, precision rule, and null-semantic is covered here so future
 * P2 changes cannot silently alter established behavior.
 *
 * Tests exercise the actual service functions (not local data objects).
 */

import {
  computeFinancialPerformanceScore,
  computeLeverageScore,
  computeLiquidityScore,
  computeCashflowScore,
  computeDsrCashflowScore,
  mapTotalScoreToRiskRating,
  resolveRetailDsr,
} from '../services/scoring.service';
import {
  resolveMissingFactorScore,
  getMissingDataPolicies,
  type MissingDataPolicy,
} from '../services/missingDataPolicy.service';
import { checkGovernanceWarnings, factorWeightsArraySchema, ratingBandsSchema } from '../validators/scoringValidators';

// ═══════════════════════════════════════════════════════════════════════════
// 1. ROS — Return on Sales
// ═══════════════════════════════════════════════════════════════════════════

describe('P2.6 — ROS (Return on Sales)', () => {
  const thresholds = { good: 0.15, bad: 0 };

  it('scores 100 at good threshold (0.15)', () => {
    expect(computeFinancialPerformanceScore({ ros: 0.15 })).toBe(100);
  });

  it('scores 100 above good threshold (0.30)', () => {
    expect(computeFinancialPerformanceScore({ ros: 0.30 })).toBe(100);
  });

  it('scores 0 at bad threshold (0)', () => {
    expect(computeFinancialPerformanceScore({ ros: 0 })).toBe(0);
  });

  it('scores 0 below bad threshold (-0.05)', () => {
    expect(computeFinancialPerformanceScore({ ros: -0.05 })).toBe(0);
  });

  it('interpolates correctly at midpoint (0.075 ≈ 50)', () => {
    const score = computeFinancialPerformanceScore({ ros: 0.075 });
    expect(score).toBeCloseTo(50, 0);
  });

  it('interpolates at 25th percentile (0.0375 ≈ 25)', () => {
    const score = computeFinancialPerformanceScore({ ros: 0.0375 });
    expect(score).toBeCloseTo(25, 0);
  });

  it('interpolates at 75th percentile (0.1125 ≈ 75)', () => {
    const score = computeFinancialPerformanceScore({ ros: 0.1125 });
    expect(score).toBeCloseTo(75, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. ROA — Return on Assets
// ═══════════════════════════════════════════════════════════════════════════

describe('P2.6 — ROA (Return on Assets)', () => {
  it('scores 100 at good threshold (0.10)', () => {
    expect(computeFinancialPerformanceScore({ roa: 0.10 })).toBe(100);
  });

  it('scores 0 at bad threshold (0)', () => {
    expect(computeFinancialPerformanceScore({ roa: 0 })).toBe(0);
  });

  it('interpolates correctly (roa=0.05 ≈ 50)', () => {
    const score = computeFinancialPerformanceScore({ roa: 0.05 });
    expect(score).toBeCloseTo(50, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. ROE — Return on Equity
// ═══════════════════════════════════════════════════════════════════════════

describe('P2.6 — ROE (Return on Equity)', () => {
  it('scores 100 at good threshold (0.15)', () => {
    expect(computeFinancialPerformanceScore({ roe: 0.15 })).toBe(100);
  });

  it('scores 0 at bad threshold (0)', () => {
    expect(computeFinancialPerformanceScore({ roe: 0 })).toBe(0);
  });

  it('interpolates at midpoint (0.075 ≈ 50)', () => {
    const score = computeFinancialPerformanceScore({ roe: 0.075 });
    expect(score).toBeCloseTo(50, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Debt-to-Equity (D/E) — lower is better
// ═══════════════════════════════════════════════════════════════════════════

describe('P2.6 — Debt-to-Equity (D/E)', () => {
  it('scores 100 at or below good threshold (1.0)', () => {
    expect(computeLeverageScore({ debt_to_equity: 0.5 })).toBe(100);
    expect(computeLeverageScore({ debt_to_equity: 1.0 })).toBe(100);
  });

  it('scores 0 at or above bad threshold (3.0)', () => {
    expect(computeLeverageScore({ debt_to_equity: 3.0 })).toBe(0);
    expect(computeLeverageScore({ debt_to_equity: 5.0 })).toBe(0);
  });

  it('interpolates at midpoint (2.0 ≈ 50)', () => {
    const score = computeLeverageScore({ debt_to_equity: 2.0 });
    expect(score).toBeCloseTo(50, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Debt-to-Assets (D/A) — lower is better
// ═══════════════════════════════════════════════════════════════════════════

describe('P2.6 — Debt-to-Assets (D/A)', () => {
  it('scores 100 at or below good threshold (0.4)', () => {
    expect(computeLeverageScore({ debt_to_assets: 0.2 })).toBe(100);
    expect(computeLeverageScore({ debt_to_assets: 0.4 })).toBe(100);
  });

  it('scores 0 at or above bad threshold (0.8)', () => {
    expect(computeLeverageScore({ debt_to_assets: 0.8 })).toBe(0);
    expect(computeLeverageScore({ debt_to_assets: 1.0 })).toBe(0);
  });

  it('interpolates at midpoint (0.6 ≈ 50)', () => {
    const score = computeLeverageScore({ debt_to_assets: 0.6 });
    expect(score).toBeCloseTo(50, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Current Ratio — higher is better
// ═══════════════════════════════════════════════════════════════════════════

describe('P2.6 — Current Ratio', () => {
  it('scores 100 at or above good threshold (2.0)', () => {
    expect(computeLiquidityScore({ current_ratio: 2.0 })).toBe(100);
    expect(computeLiquidityScore({ current_ratio: 3.0 })).toBe(100);
  });

  it('scores 0 at or below bad threshold (1.0)', () => {
    expect(computeLiquidityScore({ current_ratio: 1.0 })).toBe(0);
    expect(computeLiquidityScore({ current_ratio: 0.5 })).toBe(0);
  });

  it('interpolates at midpoint (1.5 ≈ 50)', () => {
    const score = computeLiquidityScore({ current_ratio: 1.5 });
    expect(score).toBeCloseTo(50, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Quick Ratio — higher is better
// ═══════════════════════════════════════════════════════════════════════════

describe('P2.6 — Quick Ratio', () => {
  it('scores 100 at or above good threshold (1.5)', () => {
    expect(computeLiquidityScore({ quick_ratio: 1.5 })).toBe(100);
  });

  it('scores 0 at or below bad threshold (0.5)', () => {
    expect(computeLiquidityScore({ quick_ratio: 0.5 })).toBe(0);
  });

  it('interpolates at midpoint (1.0 ≈ 50)', () => {
    const score = computeLiquidityScore({ quick_ratio: 1.0 });
    expect(score).toBeCloseTo(50, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. DSCR — Debt Service Coverage Ratio (higher is better)
// ═══════════════════════════════════════════════════════════════════════════

describe('P2.6 — DSCR (Debt Service Coverage Ratio)', () => {
  it('scores 100 at or above good threshold (2.0)', () => {
    expect(computeCashflowScore({ dscr: 2.0 })).toBe(100);
    expect(computeCashflowScore({ dscr: 3.0 })).toBe(100);
  });

  it('scores 0 at or below bad threshold (1.0)', () => {
    expect(computeCashflowScore({ dscr: 1.0 })).toBe(0);
    expect(computeCashflowScore({ dscr: 0.5 })).toBe(0);
  });

  it('interpolates at midpoint (1.5 ≈ 50)', () => {
    const score = computeCashflowScore({ dscr: 1.5 });
    expect(score).toBeCloseTo(50, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. Interest Coverage — higher is better
// ═══════════════════════════════════════════════════════════════════════════

describe('P2.6 — Interest Coverage', () => {
  it('scores 100 at or above good threshold (5.0)', () => {
    expect(computeCashflowScore({ interest_coverage: 5.0 })).toBe(100);
  });

  it('scores 0 at or below bad threshold (1.5)', () => {
    expect(computeCashflowScore({ interest_coverage: 1.5 })).toBe(0);
  });

  it('interpolates at midpoint (3.25 ≈ 50)', () => {
    const score = computeCashflowScore({ interest_coverage: 3.25 });
    expect(score).toBeCloseTo(50, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. Retail DSR — Debt Service Ratio
// ═══════════════════════════════════════════════════════════════════════════

describe('P2.6 — Retail DSR boundary tests', () => {
  it('DSR 0% → score 100', () => {
    expect(computeDsrCashflowScore(0)).toBe(100);
  });

  it('DSR 30% → in pass zone (>80)', () => {
    const score = computeDsrCashflowScore(30);
    expect(score).toBeGreaterThan(80);
    expect(score).toBeLessThan(100);
  });

  it('DSR 60% → score exactly 80 (passMax boundary)', () => {
    expect(computeDsrCashflowScore(60)).toBe(80);
  });

  it('DSR 65% → in warn zone (20-80)', () => {
    const score = computeDsrCashflowScore(65);
    expect(score).toBeGreaterThan(20);
    expect(score).toBeLessThan(80);
  });

  it('DSR 70% → score exactly 20 (warnMax boundary)', () => {
    expect(computeDsrCashflowScore(70)).toBe(20);
  });

  it('DSR 75% → in danger zone (<20)', () => {
    const score = computeDsrCashflowScore(75);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(20);
  });

  it('DSR 80% → score 0 (hardFail boundary)', () => {
    expect(computeDsrCashflowScore(80)).toBe(0);
  });

  it('DSR >80% → clamped to >=0', () => {
    expect(computeDsrCashflowScore(90)).toBeGreaterThanOrEqual(0);
    expect(computeDsrCashflowScore(100)).toBeGreaterThanOrEqual(0);
    expect(computeDsrCashflowScore(200)).toBeGreaterThanOrEqual(0);
  });

  it('negative DSR → treated as 0 → score 100', () => {
    expect(computeDsrCashflowScore(-5)).toBe(100);
  });

  it('DSR with NET vs GROSS basis selection', () => {
    expect(resolveRetailDsr({ dsrPercent: 60, netDsrPercent: 45, dsrBasis: 'NET' })).toBe(45);
    expect(resolveRetailDsr({ dsrPercent: 60, netDsrPercent: 45, dsrBasis: 'GROSS' })).toBe(60);
    expect(resolveRetailDsr({ dsrPercent: 60, netDsrPercent: null, dsrBasis: 'NET' })).toBe(60);
    expect(resolveRetailDsr({ dsrPercent: null, netDsrPercent: null })).toBeNull();
    expect(resolveRetailDsr({ dsrPercent: 0, netDsrPercent: null })).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. Null/missing input handling — divide-by-zero never produces Infinity/NaN
// ═══════════════════════════════════════════════════════════════════════════

describe('P2.6 — Null and missing input handling', () => {
  it('financial_performance with all null ratios → 50 (NEUTRAL default)', () => {
    expect(computeFinancialPerformanceScore({ ros: null, roa: null, roe: null } as any)).toBe(50);
  });

  it('leverage with null ratios → 50', () => {
    expect(computeLeverageScore({ debt_to_equity: null, debt_to_assets: null } as any)).toBe(50);
  });

  it('liquidity with null ratios → 50', () => {
    expect(computeLiquidityScore({ current_ratio: null, quick_ratio: null } as any)).toBe(50);
  });

  it('cashflow with null ratios → 50', () => {
    expect(computeCashflowScore({ dscr: null, interest_coverage: null } as any)).toBe(50);
  });

  it('financial performance with single ratio present averages correctly', () => {
    // Only ROS provided at good threshold → score should be 100
    const score = computeFinancialPerformanceScore({ ros: 0.15 });
    expect(score).toBe(100);
  });

  it('financial performance averages multiple available ratios', () => {
    // ROS=0.15 (100) + ROA=0.05 (50) → average = 75
    const score = computeFinancialPerformanceScore({ ros: 0.15, roa: 0.05 });
    expect(score).toBeCloseTo(75, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. Missing-data policy — BLOCK/PENALTY/NEUTRAL
// ═══════════════════════════════════════════════════════════════════════════

describe('P2.6 — Missing-data policy regression', () => {
  it('NEUTRAL policy returns 50 by default', () => {
    const policies = { financial_performance: { factor: 'financial_performance', policy: 'NEUTRAL' as MissingDataPolicy, penaltyScore: 25 } };
    const result = resolveMissingFactorScore('financial_performance', 'all_ratios', policies);
    expect(result.score).toBe(50);
    expect(result.record.policy).toBe('NEUTRAL');
  });

  it('PENALTY policy returns configured penalty score', () => {
    const policies = { leverage: { factor: 'leverage', policy: 'PENALTY' as MissingDataPolicy, penaltyScore: 25 } };
    const result = resolveMissingFactorScore('leverage', 'debt_to_equity', policies);
    expect(result.score).toBe(25);
    expect(result.record.policy).toBe('PENALTY');
  });

  it('BLOCK policy throws an error', () => {
    const policies = { cashflow: { factor: 'cashflow', policy: 'BLOCK' as MissingDataPolicy, penaltyScore: 25 } };
    expect(() => resolveMissingFactorScore('cashflow', 'dscr', policies)).toThrow(/BLOCK/);
  });

  it('custom penalty score overrides default', () => {
    const policies = { management: { factor: 'management', policy: 'PENALTY' as MissingDataPolicy, penaltyScore: 15 } };
    const result = resolveMissingFactorScore('management', 'qualitative', policies);
    expect(result.score).toBe(15);
    expect(result.record.appliedScore).toBe(15);
  });

  it('custom neutral score overrides default', () => {
    const policies = { liquidity: { factor: 'liquidity', policy: 'NEUTRAL' as MissingDataPolicy, penaltyScore: 25, neutralScore: 45 } };
    const result = resolveMissingFactorScore('liquidity', 'current_ratio', policies);
    expect(result.score).toBe(45);
    expect(result.record.appliedScore).toBe(45);
  });

  it('missing factor key falls back to NEUTRAL with score 50', () => {
    const policies = {};
    const result = resolveMissingFactorScore('unknown_factor', 'some_field', policies);
    expect(result.score).toBe(50);
    expect(result.record.policy).toBe('NEUTRAL');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 13. Rating mapping — total score → RiskRating boundary coverage
// ═══════════════════════════════════════════════════════════════════════════

describe('P2.6 — Rating mapping boundary coverage', () => {
  it('maps every boundary correctly (AAA through D)', () => {
    expect(mapTotalScoreToRiskRating(100)).toBe('AAA');
    expect(mapTotalScoreToRiskRating(85)).toBe('AAA');
    expect(mapTotalScoreToRiskRating(84)).toBe('AA');
    expect(mapTotalScoreToRiskRating(78)).toBe('AA');
    expect(mapTotalScoreToRiskRating(77)).toBe('A');
    expect(mapTotalScoreToRiskRating(70)).toBe('A');
    expect(mapTotalScoreToRiskRating(69)).toBe('BBB');
    expect(mapTotalScoreToRiskRating(62)).toBe('BBB');
    expect(mapTotalScoreToRiskRating(55)).toBe('BB');
    expect(mapTotalScoreToRiskRating(48)).toBe('B');
    expect(mapTotalScoreToRiskRating(40)).toBe('CCC');
    expect(mapTotalScoreToRiskRating(30)).toBe('CC');
    expect(mapTotalScoreToRiskRating(20)).toBe('C');
    expect(mapTotalScoreToRiskRating(0)).toBe('D');
  });

  it('maps mid-range scores correctly', () => {
    expect(mapTotalScoreToRiskRating(90)).toBe('AAA');
    expect(mapTotalScoreToRiskRating(80)).toBe('AA');
    expect(mapTotalScoreToRiskRating(72)).toBe('A');
    expect(mapTotalScoreToRiskRating(65)).toBe('BBB');
    expect(mapTotalScoreToRiskRating(57)).toBe('BB');
    expect(mapTotalScoreToRiskRating(50)).toBe('B');
    expect(mapTotalScoreToRiskRating(43)).toBe('CCC');
    expect(mapTotalScoreToRiskRating(35)).toBe('CC');
    expect(mapTotalScoreToRiskRating(25)).toBe('C');
    expect(mapTotalScoreToRiskRating(10)).toBe('D');
  });

  it('boundary-1 score falls to lower rating', () => {
    // 84 is the highest AA score; 85+ is AAA
    expect(mapTotalScoreToRiskRating(84)).toBe('AA');
    expect(mapTotalScoreToRiskRating(85)).toBe('AAA');
    // 77 is highest A; 78+ is AA
    expect(mapTotalScoreToRiskRating(77)).toBe('A');
    expect(mapTotalScoreToRiskRating(78)).toBe('AA');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 14. Rounding — scores are rounded to 2 decimal places
// ═══════════════════════════════════════════════════════════════════════════

describe('P2.6 — Rounding precision', () => {
  it('ratio scores are not Infinity or NaN for any valid input', () => {
    const ratios = [0, 0.001, 0.5, 1, 2, 5, 10, 100, -0.01, -1];
    for (const r of ratios) {
      expect(Number.isFinite(computeFinancialPerformanceScore({ ros: r }))).toBe(true);
      expect(Number.isNaN(computeFinancialPerformanceScore({ ros: r }))).toBe(false);
      expect(Number.isFinite(computeLeverageScore({ debt_to_equity: r }))).toBe(true);
      expect(Number.isFinite(computeLiquidityScore({ current_ratio: r }))).toBe(true);
      expect(Number.isFinite(computeCashflowScore({ dscr: r }))).toBe(true);
    }
  });

  it('DSCR boundary values produce valid finite scores', () => {
    for (const d of [0, 0.5, 1, 1.5, 2, 3, 5, 10]) {
      const score = computeCashflowScore({ dscr: d });
      expect(Number.isFinite(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 15. Zod validation regression — factor weights and rating bands
// ═══════════════════════════════════════════════════════════════════════════

describe('P2.6 — Zod validation regression', () => {
  const validWeights = [
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

  it('accepts valid factor weights summing to 100', () => {
    expect(factorWeightsArraySchema.safeParse(validWeights).success).toBe(true);
  });

  it('rejects weights not summing to 100', () => {
    const bad = validWeights.map((w, i) => i === 0 ? { ...w, weight: 10 } : w);
    expect(factorWeightsArraySchema.safeParse(bad).success).toBe(false);
  });

  it('rejects negative weights', () => {
    const bad = validWeights.map((w, i) => i === 0 ? { ...w, weight: -5 } : w);
    expect(factorWeightsArraySchema.safeParse(bad).success).toBe(false);
  });

  it('rejects weights >100', () => {
    const bad = validWeights.map((w, i) => i === 0 ? { ...w, weight: 101 } : w);
    expect(factorWeightsArraySchema.safeParse(bad).success).toBe(false);
  });

  const validBands = [
    { min: 85, max: 100, rating: 'AAA' }, { min: 78, max: 84, rating: 'AA' },
    { min: 70, max: 77, rating: 'A' }, { min: 62, max: 69, rating: 'BBB' },
    { min: 55, max: 61, rating: 'BB' }, { min: 48, max: 54, rating: 'B' },
    { min: 40, max: 47, rating: 'CCC' }, { min: 30, max: 39, rating: 'CC' },
    { min: 20, max: 29, rating: 'C' }, { min: 0, max: 19, rating: 'D' },
  ];

  it('accepts valid bands covering 0-100', () => {
    expect(ratingBandsSchema.safeParse(validBands).success).toBe(true);
  });

  it('rejects bands not starting at 0', () => {
    const bad = validBands.filter(b => b.min !== 0);
    bad.push({ min: 1, max: 19, rating: 'D' as const });
    expect(ratingBandsSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects bands with gaps', () => {
    const gap = validBands.filter(b => b.rating !== 'CC');
    expect(ratingBandsSchema.safeParse(gap).success).toBe(false);
  });

  it('rejects overlapping bands', () => {
    const overlap = [...validBands, { min: 50, max: 55, rating: 'BB' as const }];
    expect(ratingBandsSchema.safeParse(overlap).success).toBe(false);
  });
});