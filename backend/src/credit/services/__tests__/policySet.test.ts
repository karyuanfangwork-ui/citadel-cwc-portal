const parameterFindManyMock = jest.fn();
const ruleConfigFindManyMock = jest.fn();
const limitFindManyMock = jest.fn();

jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditPolicyParameter: { findMany: parameterFindManyMock },
    creditRuleConfig: { findMany: ruleConfigFindManyMock },
    creditPolicyLimit: { findMany: limitFindManyMock },
  },
}));

import { gatherPolicySet, getPolicySetVersion, clearPolicySetCache } from '../policySet.service';
import { computePolicySetVersion } from '../policySetVersion';

beforeEach(() => {
  jest.clearAllMocks();
  clearPolicySetCache();
  parameterFindManyMock.mockResolvedValue([
    { key: 'missing_data.cashflow.policy', value: 'PENALTY', productType: null, lane: null, borrowerType: null },
  ]);
  ruleConfigFindManyMock.mockResolvedValue([
    { kind: 'REQUIRED_DOCUMENT', documentClass: 'BANK_STATEMENT', fieldPath: null, productType: null, lane: null, borrowerType: null },
  ]);
  limitFindManyMock.mockResolvedValue([
    { type: 'SINGLE_BORROWER', maxValue: '5000000', thresholdPct: '80', sector: null, productType: null },
  ]);
});

describe('gatherPolicySet', () => {
  it('reads only active, currently-effective policy parameters', async () => {
    await gatherPolicySet();
    const call = parameterFindManyMock.mock.calls[0][0];
    expect(call.where.isActive).toBe(true);
    expect(call.where.effectiveFrom).toMatchObject({ lte: expect.any(Date) });
    expect(call.where.OR).toEqual([{ effectiveTo: null }, { effectiveTo: { gte: expect.any(Date) } }]);
  });

  it('reads only active rule configs and limits', async () => {
    await gatherPolicySet();
    expect(ruleConfigFindManyMock.mock.calls[0][0].where).toEqual({ isActive: true });
    expect(limitFindManyMock.mock.calls[0][0].where).toEqual({ isActive: true });
  });

  it('returns the three fingerprint sets', async () => {
    const set = await gatherPolicySet();
    expect(set.parameters).toHaveLength(1);
    expect(set.ruleConfigs).toHaveLength(1);
    expect(set.limits).toHaveLength(1);
  });

  it('stringifies Decimal limit values without losing precision', async () => {
    limitFindManyMock.mockResolvedValue([
      { type: 'SECTOR', maxValue: { toString: () => '1234567.89' }, thresholdPct: { toString: () => '75.5' }, sector: 'AGRI', productType: null },
    ]);
    const set = await gatherPolicySet();
    expect(set.limits[0]).toMatchObject({ maxValue: '1234567.89', thresholdPct: '75.5' });
  });
});

describe('getPolicySetVersion', () => {
  it('computes the version from the gathered set', async () => {
    const version = await getPolicySetVersion();
    expect(version).toBe(computePolicySetVersion(await gatherPolicySet()));
    expect(version).toMatch(/^sha256:[0-9a-f]{12}$/);
  });

  it('caches within the same window', async () => {
    await getPolicySetVersion();
    await getPolicySetVersion();
    expect(parameterFindManyMock).toHaveBeenCalledTimes(1);
  });

  it('re-queries after the cache is cleared', async () => {
    await getPolicySetVersion();
    clearPolicySetCache();
    await getPolicySetVersion();
    expect(parameterFindManyMock).toHaveBeenCalledTimes(2);
  });

  it('reflects a configuration change once the cache is cleared', async () => {
    const before = await getPolicySetVersion();
    limitFindManyMock.mockResolvedValue([
      { type: 'SINGLE_BORROWER', maxValue: '9000000', thresholdPct: '80', sector: null, productType: null },
    ]);
    clearPolicySetCache();
    expect(await getPolicySetVersion()).not.toBe(before);
  });
});
