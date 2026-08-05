import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import prisma from '../../../utils/prisma';
import { creditSlaService } from '../creditSla.service';

jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditSlaPolicy: { findFirst: jest.fn(), findMany: jest.fn() },
    creditSlaPolicyBranchOverride: { findMany: jest.fn() },
  },
}));

const mockPrisma = prisma as unknown as {
  creditSlaPolicy: { findMany: jest.Mock };
  creditSlaPolicyBranchOverride: { findMany: jest.Mock };
};

describe('getEffectiveSlaForApplication', () => {
  const baseApp = {
    id: 'a1',
    state: 'CREDIT_ASSESSMENT',
    productType: 'TERM_LOAN',
    branchId: 'b1',
    createdAt: new Date('2026-06-01T00:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses branch override hours when present', async () => {
    mockPrisma.creditSlaPolicyBranchOverride.findMany.mockResolvedValue([{ policyId: 'p1', slaHours: 48 }]);
    mockPrisma.creditSlaPolicy.findMany.mockResolvedValue([{ id: 'p1', slaHours: 120 }]);

    const result = await creditSlaService.getEffectiveSlaForApplication(baseApp);

    expect(result.slaTargetHours).toBe(48);
    expect(result.slaDueAt).toBe('2026-06-03T00:00:00.000Z');
  });

  it('returns null when no policy matches', async () => {
    mockPrisma.creditSlaPolicyBranchOverride.findMany.mockResolvedValue([]);
    mockPrisma.creditSlaPolicy.findMany.mockResolvedValue([]);

    const result = await creditSlaService.getEffectiveSlaForApplication(baseApp);

    expect(result.slaTargetHours).toBeNull();
    expect(result.slaDueAt).toBeNull();
  });
});