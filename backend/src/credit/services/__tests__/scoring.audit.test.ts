jest.mock('../../../utils/prisma', () => {
  const mockFindFirst = jest.fn();
  const mockFindMany = jest.fn();
  const mockFindUnique = jest.fn();
  const mockCreate = jest.fn();
  return {
    __esModule: true,
    default: {
      creditScorecardVersion: { findFirst: mockFindFirst, findMany: mockFindMany },
      creditApplication: { findUnique: mockFindUnique },
      financialStatement: { findFirst: jest.fn().mockResolvedValue(null) },
      creditScoreRun: { create: mockCreate },
      $queryRaw: jest.fn(),
    },
  };
});

jest.mock('../qualitativeAssessment.service', () => ({
  getQualitativeAssessment: jest.fn().mockResolvedValue(null),
  toFactorScores: jest.fn().mockReturnValue({
    management: 50, relationship: 50, industry: 50, collateral: 50,
  }),
}));

jest.mock('../bureauCheck.service', () => ({
  getBureauCapsForApplication: jest.fn().mockResolvedValue([]),
  applyBureauCaps: jest.fn().mockImplementation((rating: string) => ({ effectiveRating: rating, capsApplied: [] })),
  isBureauCheckFresh: jest.fn().mockResolvedValue({ fresh: true, staleProviders: [] }),
}));

jest.mock('../retailIncome.service', () => ({
  getRetailIncome: jest.fn().mockResolvedValue(null),
}));

jest.mock('../auditChain.service', () => ({
  AuditChainService: { appendEvent: jest.fn().mockResolvedValue('evt-1') },
}));

import { scoringService } from '../scoring.service';
import prisma from '../../../utils/prisma';
import { AuditChainService } from '../auditChain.service';

const scorecardVersionMock: any = {
  id: 'sv-1',
  scorecardId: 'sc-1',
  factorWeights: {
    financial_performance: 15, leverage: 15, liquidity: 10, cashflow: 15,
    management: 10, industry: 10, collateral: 10, relationship: 10, market_conditions: 5,
  },
};

const applicationMock: any = {
  borrowerProfileId: 'bp-1',
  borrowerProfile: { borrowerType: 'CORPORATE' },
};

describe('executeScore audit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.creditScorecardVersion.findMany as jest.Mock).mockResolvedValue([scorecardVersionMock]);
  });

  it('appends SCORE_RUN_CREATED with score run metadata', async () => {
    (prisma.creditScorecardVersion.findFirst as jest.Mock).mockResolvedValue(scorecardVersionMock);
    (prisma.creditApplication.findUnique as jest.Mock).mockResolvedValue(applicationMock);
    (prisma.creditScoreRun.create as jest.Mock).mockResolvedValue({
      id: 'run-1', applicationId: 'app-1', riskRating: 'BBB', totalScore: 65,
    });

    await scoringService.executeScore('app-1', undefined, { actorId: 'u-1', source: 'MANUAL' });

    expect(AuditChainService.appendEvent).toHaveBeenCalledWith(
      'app-1',
      'SCORE_RUN_CREATED',
      'u-1',
      'score',
      null,
      expect.any(String),
      expect.objectContaining({
        scoreRunId: 'run-1',
        scorecardVersionId: 'sv-1',
        totalScore: expect.any(Number),
        riskRating: expect.any(String),
      }),
    );
  });

  it('persists calculatedById, calculationSource and inputSnapshot on the score run', async () => {
    (prisma.creditScorecardVersion.findFirst as jest.Mock).mockResolvedValue(scorecardVersionMock);
    (prisma.creditApplication.findUnique as jest.Mock).mockResolvedValue(applicationMock);
    (prisma.creditScoreRun.create as jest.Mock).mockResolvedValue({
      id: 'run-2', applicationId: 'app-1', riskRating: 'A', totalScore: 72,
    });

    await scoringService.executeScore('app-1', undefined, { actorId: 'u-9', source: 'RESCORE' });

    const createCall = (prisma.creditScoreRun.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.calculatedById).toBe('u-9');
    expect(createCall.data.calculationSource).toBe('RESCORE');
    expect(createCall.data.inputSnapshot).toBeDefined();
    expect(createCall.data.inputSnapshot).toHaveProperty('factorScores');
    expect(createCall.data.inputSnapshot).toHaveProperty('totalScore');
    expect(createCall.data.inputSnapshot).toHaveProperty('capturedAt');
  });

  it('defaults source to MANUAL and actorId to null when not provided', async () => {
    (prisma.creditScorecardVersion.findFirst as jest.Mock).mockResolvedValue(scorecardVersionMock);
    (prisma.creditApplication.findUnique as jest.Mock).mockResolvedValue(applicationMock);
    (prisma.creditScoreRun.create as jest.Mock).mockResolvedValue({
      id: 'run-3', applicationId: 'app-1', riskRating: 'A', totalScore: 72,
    });

    await scoringService.executeScore('app-1');

    const createCall = (prisma.creditScoreRun.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.calculatedById).toBeNull();
    expect(createCall.data.calculationSource).toBe('MANUAL');
    expect(AuditChainService.appendEvent).toHaveBeenCalledWith(
      'app-1', 'SCORE_RUN_CREATED', null, 'score',
      null, expect.any(String), expect.objectContaining({ scoreRunId: 'run-3' }),
    );
  });
});