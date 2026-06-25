import { resolveMissingFactorScore, getMissingDataPolicies, MissingDataPolicyConfig } from '../missingDataPolicy.service';

describe('resolveMissingFactorScore', () => {
  const policies: Record<string, MissingDataPolicyConfig> = {
    financial_performance: { factor: 'financial_performance', policy: 'NEUTRAL', penaltyScore: 25 },
    leverage: { factor: 'leverage', policy: 'PENALTY', penaltyScore: 20 },
    liquidity: { factor: 'liquidity', policy: 'BLOCK', penaltyScore: 25 },
  };

  it('returns 50 for NEUTRAL policy', () => {
    const { score, record } = resolveMissingFactorScore('financial_performance', 'ros', policies);
    expect(score).toBe(50);
    expect(record.policy).toBe('NEUTRAL');
    expect(record.appliedScore).toBe(50);
  });

  it('returns the penalty score for PENALTY policy', () => {
    const { score, record } = resolveMissingFactorScore('leverage', 'debt_to_equity', policies);
    expect(score).toBe(20);
    expect(record.policy).toBe('PENALTY');
    expect(record.appliedScore).toBe(20);
  });

  it('throws for BLOCK policy with a clear message', () => {
    expect(() => resolveMissingFactorScore('liquidity', 'current_ratio', policies)).toThrow(
      /current_ratio.*liquidity.*BLOCK/,
    );
  });

  it('defaults to NEUTRAL when factor has no configured policy', () => {
    const { score, record } = resolveMissingFactorScore('unknown_factor', 'sub_field', policies);
    expect(score).toBe(50);
    expect(record.policy).toBe('NEUTRAL');
  });
});

describe('getMissingDataPolicies', () => {
  it('returns default policies for all 9 factor groups', async () => {
    const policies = await getMissingDataPolicies();
    expect(Object.keys(policies)).toHaveLength(9);
    expect(policies.financial_performance.policy).toBe('NEUTRAL');
    expect(policies.cashflow.policy).toBe('NEUTRAL');
  });
});