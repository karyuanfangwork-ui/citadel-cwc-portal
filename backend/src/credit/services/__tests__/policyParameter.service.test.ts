jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditPolicyParameter: {
      findMany: jest.fn(),
    },
  },
}));

import prisma from '../../../utils/prisma';
import {
  getNumberPolicy,
  getPolicyParameter,
  getStringPolicy,
} from '../policyParameter.service';

const mockPrisma = prisma as unknown as {
  creditPolicyParameter: { findMany: jest.Mock };
};

describe('policyParameter.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the default when no active policy row exists', async () => {
    mockPrisma.creditPolicyParameter.findMany.mockResolvedValue([]);

    await expect(getNumberPolicy('bureau.freshness_days', 90)).resolves.toBe(90);
  });

  it('returns a generic active policy value', async () => {
    mockPrisma.creditPolicyParameter.findMany.mockResolvedValue([
      {
        key: 'bureau.freshness_days',
        value: 30,
        productType: null,
        lane: null,
        borrowerType: null,
        effectiveFrom: new Date('2026-01-01'),
      },
    ]);

    await expect(getNumberPolicy('bureau.freshness_days', 90)).resolves.toBe(30);
  });

  it('prefers the most specific scoped row over a generic row', async () => {
    mockPrisma.creditPolicyParameter.findMany.mockResolvedValue([
      {
        key: 'readiness.retail.net_dsr.warn_max',
        value: 60,
        productType: null,
        lane: null,
        borrowerType: null,
        effectiveFrom: new Date('2026-01-01'),
      },
      {
        key: 'readiness.retail.net_dsr.warn_max',
        value: 55,
        productType: 'PERSONAL_LOAN',
        lane: 'PERSONAL_FAST',
        borrowerType: 'INDIVIDUAL',
        effectiveFrom: new Date('2026-02-01'),
      },
    ]);

    await expect(getNumberPolicy('readiness.retail.net_dsr.warn_max', 60, {
      productType: 'PERSONAL_LOAN',
      lane: 'PERSONAL_FAST',
      borrowerType: 'INDIVIDUAL',
    })).resolves.toBe(55);
  });

  it('returns default for invalid numeric values', async () => {
    mockPrisma.creditPolicyParameter.findMany.mockResolvedValue([
      {
        key: 'readiness.exposure.warning_utilisation_pct',
        value: 'not-a-number',
        productType: null,
        lane: null,
        borrowerType: null,
        effectiveFrom: new Date('2026-01-01'),
      },
    ]);

    await expect(getNumberPolicy('readiness.exposure.warning_utilisation_pct', 90)).resolves.toBe(90);
  });

  it('returns default when the policy table is not available yet', async () => {
    mockPrisma.creditPolicyParameter.findMany.mockRejectedValue({ code: 'P2021' });

    await expect(getStringPolicy('bureau.cap.ccris_saa.max_rating', 'BBB')).resolves.toBe('BBB');
  });

  it('supports generic JSON policy values', async () => {
    mockPrisma.creditPolicyParameter.findMany.mockResolvedValue([
      {
        key: 'custom.policy',
        value: { enabled: true, threshold: 3 },
        productType: null,
        lane: null,
        borrowerType: null,
        effectiveFrom: new Date('2026-01-01'),
      },
    ]);

    await expect(getPolicyParameter('custom.policy', { enabled: false })).resolves.toEqual({
      enabled: true,
      threshold: 3,
    });
  });
});
