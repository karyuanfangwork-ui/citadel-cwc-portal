jest.mock('../policyParameter.service', () => ({
  getNumberPolicy: jest.fn(async (_key: string, fallback: number) => fallback),
  getStringPolicy: jest.fn(async (_key: string, fallback: string) => fallback),
}));

import { getNumberPolicy, getStringPolicy } from '../policyParameter.service';
import { resolveMissingFactorScore, getMissingDataPolicies, MissingDataPolicyConfig } from '../missingDataPolicy.service';

const mockedGetNumberPolicy = getNumberPolicy as jest.Mock;
const mockedGetStringPolicy = getStringPolicy as jest.Mock;

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
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetNumberPolicy.mockImplementation(async (_key: string, fallback: number) => fallback);
    mockedGetStringPolicy.mockImplementation(async (_key: string, fallback: string) => fallback);
  });

  it('returns default policies for all 9 factor groups', async () => {
    const policies = await getMissingDataPolicies();
    expect(Object.keys(policies)).toHaveLength(9);
    expect(policies.financial_performance.policy).toBe('NEUTRAL');
    expect(policies.cashflow.policy).toBe('NEUTRAL');
  });

  it('reads PENALTY policy and penalty score from policy parameters', async () => {
    mockedGetStringPolicy.mockImplementation(async (key: string, fallback: string) =>
      key === 'missing_data.cashflow.policy' ? 'PENALTY' : fallback,
    );
    mockedGetNumberPolicy.mockImplementation(async (key: string, fallback: number) =>
      key === 'missing_data.cashflow.penalty_score' ? 10 : fallback,
    );

    const policies = await getMissingDataPolicies();
    const { score, record } = resolveMissingFactorScore('cashflow', 'dscr', policies);

    expect(policies.cashflow.policy).toBe('PENALTY');
    expect(score).toBe(10);
    expect(record.appliedScore).toBe(10);
  });

  it('reads BLOCK policy from policy parameters', async () => {
    mockedGetStringPolicy.mockImplementation(async (key: string, fallback: string) =>
      key === 'missing_data.liquidity.policy' ? 'BLOCK' : fallback,
    );

    const policies = await getMissingDataPolicies();

    expect(() => resolveMissingFactorScore('liquidity', 'current_ratio', policies)).toThrow(/BLOCK/);
  });

  it('reads configured neutral score from policy parameters', async () => {
    mockedGetNumberPolicy.mockImplementation(async (key: string, fallback: number) =>
      key === 'missing_data.neutral_score' ? 55 : fallback,
    );

    const policies = await getMissingDataPolicies();
    const { score, record } = resolveMissingFactorScore('cashflow', 'dscr', policies);

    expect(score).toBe(55);
    expect(record.appliedScore).toBe(55);
  });
});