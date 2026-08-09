/**
 * LOS-011 — missing core evidence must not score as neutral.
 */
import { resolveMissingFactorScore, MissingDataPolicyConfig } from '../missingDataPolicy.service';
import { AppError } from '../../../middleware/error.middleware';

function policies(overrides: Partial<Record<string, MissingDataPolicyConfig>> = {}) {
  return {
    cashflow: { factor: 'cashflow', policy: 'BLOCK' as const, penaltyScore: 25, neutralScore: 50 },
    leverage: { factor: 'leverage', policy: 'PENALTY' as const, penaltyScore: 25, neutralScore: 50 },
    industry: { factor: 'industry', policy: 'NEUTRAL' as const, penaltyScore: 25, neutralScore: 50 },
    ...overrides,
  } as Record<string, MissingDataPolicyConfig>;
}

describe('resolveMissingFactorScore', () => {
  it('applies the penalty score under PENALTY', () => {
    const { score, record } = resolveMissingFactorScore('leverage', 'debt_to_equity', policies());
    expect(score).toBe(25);
    expect(record).toEqual({ factor: 'leverage', subField: 'debt_to_equity', policy: 'PENALTY', appliedScore: 25 });
  });

  it('applies the neutral score under NEUTRAL', () => {
    expect(resolveMissingFactorScore('industry', 'outlook', policies()).score).toBe(50);
  });

  it('throws AppError(400) under BLOCK, not a bare Error', () => {
    // A bare Error surfaces as a 500 and reads as a system fault rather than an
    // incomplete file the analyst can actually fix.
    try {
      resolveMissingFactorScore('cashflow', 'dsr_percent', policies());
      throw new Error('expected resolveMissingFactorScore to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).statusCode).toBe(400);
      expect((e as AppError).message).toMatch(/dsr_percent/);
    }
  });

  it('names the factor and field so the blocker is actionable', () => {
    try {
      resolveMissingFactorScore('cashflow', 'dsr_percent', policies());
    } catch (e) {
      expect((e as AppError).message).toMatch(/cashflow/);
    }
  });

  it('falls back to a conservative policy for an unconfigured factor', () => {
    // An unknown factor must not silently score 50.
    const { score } = resolveMissingFactorScore('brand_new_factor', 'x', policies());
    expect(score).toBeLessThanOrEqual(25);
  });
});