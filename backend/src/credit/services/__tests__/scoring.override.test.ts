jest.mock('../../../utils/prisma', () => {
  const mockFindUnique = jest.fn();
  const mockUpdate = jest.fn();
  const mockTx = {
    creditScoreRun: { findUnique: mockFindUnique, update: mockUpdate },
    creditApplication: { update: jest.fn().mockResolvedValue({}) },
  };
  return {
    __esModule: true,
    default: {
      creditScoreRun: {
        findUnique: mockFindUnique,
        update: mockUpdate,
      },
      $transaction: jest.fn(async (fn: any) => fn(mockTx)),
    },
  };
});

jest.mock('../auditChain.service', () => ({
  AuditChainService: {
    appendEvent: jest.fn(),
  },
}));

jest.mock('../applicationRating.service', () => ({
  persistApplicationRiskRating: jest.fn(),
}));

import prisma from '../../../utils/prisma';
import { scoringService } from '../scoring.service';
import { persistApplicationRiskRating } from '../applicationRating.service';

const mockPrisma = prisma as unknown as {
  creditScoreRun: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};

describe('scoringService.overrideScore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects self-approved score overrides with a 403 SOD error', async () => {
    mockPrisma.creditScoreRun.findUnique.mockResolvedValue({
      id: 'score-run-1',
      applicationId: 'app-1',
      riskRating: 'BBB',
    });

    await expect(
      scoringService.overrideScore('score-run-1', {
        newRiskRating: 'BB',
        overrideReason: 'Test override',
        overrideApprovedById: 'user-1',
        requestedById: 'user-1',
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { code: 'SCORE_OVERRIDE_SOD_VIOLATION' },
    });

    expect(mockPrisma.creditScoreRun.update).not.toHaveBeenCalled();
    expect(persistApplicationRiskRating).not.toHaveBeenCalled();
  });

  it('rejects material direct overrides with a machine-readable dual-approval code', async () => {
    mockPrisma.creditScoreRun.findUnique.mockResolvedValue({
      id: 'score-run-1',
      applicationId: 'app-1',
      riskRating: 'BBB',
    });

    await expect(
      scoringService.overrideScore('score-run-1', {
        newRiskRating: 'B',
        overrideReason: 'Material override test',
        overrideApprovedById: 'approver-1',
        requestedById: 'requester-1',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      details: { code: 'SCORE_OVERRIDE_MATERIAL_APPROVAL_REQUIRED' },
    });

    expect(mockPrisma.creditScoreRun.update).not.toHaveBeenCalled();
    expect(persistApplicationRiskRating).not.toHaveBeenCalled();
  });

  it('syncs canonical application rating after an allowed direct override', async () => {
    const approvedAt = new Date('2026-01-02T00:00:00Z');
    mockPrisma.creditScoreRun.findUnique.mockResolvedValue({
      id: 'score-run-1',
      applicationId: 'app-1',
      riskRating: 'BBB',
    });
    mockPrisma.creditScoreRun.update.mockResolvedValue({
      id: 'score-run-1',
      applicationId: 'app-1',
      riskRating: 'BB',
      overrideApprovedAt: approvedAt,
    });

    await scoringService.overrideScore('score-run-1', {
      newRiskRating: 'BB',
      overrideReason: 'Test override',
      overrideApprovedById: 'approver-1',
      requestedById: 'requester-1',
    });

    expect(persistApplicationRiskRating).toHaveBeenCalledWith('app-1', 'BB', approvedAt, expect.any(Object));
  });
});
