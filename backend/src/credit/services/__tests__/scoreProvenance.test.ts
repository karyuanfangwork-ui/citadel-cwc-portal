/**
 * LOS-014 — a score run must record enough to be replayed.
 *
 * Verifies that creditScoreRun.create receives ratingBandVersion and
 * policyVersion, so an old rating can be reproduced from the stored
 * provenance fields rather than guesswork.
 */

jest.mock('../../../utils/prisma', () => {
  const mockFindFirst = jest.fn();
  const mockFindMany = jest.fn();
  const mockFindUnique = jest.fn();
  const mockCreate = jest.fn();
  const mockTx = {
    creditScoreRun: { create: mockCreate },
    creditApplication: { update: jest.fn().mockResolvedValue({}), findUnique: mockFindUnique },
  };
  return {
    __esModule: true,
    default: {
      creditApplication: { findUnique: mockFindUnique, update: jest.fn().mockResolvedValue({}) },
      creditScorecardVersion: { findFirst: mockFindFirst, findMany: mockFindMany },
      creditScoreRun: { create: mockCreate },
      financialStatement: { findFirst: jest.fn().mockResolvedValue(null) },
      ratingBandConfig: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      scoreFactorDefinition: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn(),
      $transaction: jest.fn(async (fn: any) => fn(mockTx)),
    },
  };
});

jest.mock('../auditChain.service', () => ({
  AuditChainService: { appendEvent: jest.fn().mockResolvedValue('evt') },
}));

jest.mock('../qualitativeAssessment.service', () => ({
  getQualitativeAssessment: jest.fn().mockResolvedValue(null),
  toFactorScores: jest.fn().mockReturnValue({}),
}));

jest.mock('../bureauCheck.service', () => ({
  getBureauCapsForApplication: jest.fn().mockResolvedValue([]),
  applyBureauCaps: jest.fn().mockReturnValue({ effectiveRating: 'BBB', capsApplied: [] }),
  isBureauCheckFresh: jest.fn().mockResolvedValue({ fresh: true, staleProviders: [] }),
}));

jest.mock('../retailIncome.service', () => ({
  getRetailIncome: jest.fn().mockResolvedValue(null),
}));

jest.mock('../ratingBand.service', () => ({
  resolveScoreToRatingWithVersion: jest.fn().mockResolvedValue({ rating: 'BBB', version: 3 }),
}));

jest.mock('../missingDataPolicy.service', () => {
  const policies = {
    cashflow: { factor: 'cashflow', policy: 'BLOCK', penaltyScore: 25, neutralScore: 50 },
    leverage: { factor: 'leverage', policy: 'PENALTY', penaltyScore: 25, neutralScore: 50 },
  };
  return {
    getMissingDataPolicies: jest.fn().mockResolvedValue(policies),
    resolveMissingFactorScore: jest.fn().mockReturnValue({
      score: 25, record: { factor: 'x', subField: 'y', policy: 'PENALTY', appliedScore: 25 },
    }),
  };
});

jest.mock('../policyParameter.service', () => ({
  getNumberPolicy: jest.fn().mockResolvedValue(50),
  getStringPolicy: jest.fn().mockResolvedValue('NEUTRAL'),
}));

jest.mock('../policySet.service', () => ({
  getPolicySetVersion: jest.fn().mockResolvedValue('sha256:abcdef123456'),
}));

jest.mock('../scorecard.service', () => ({
  getActiveScorecardVersion: jest.fn().mockResolvedValue({
    id: 'scv-1',
    version: 1,
    factorWeights: {
      financial_performance: 0.15, leverage: 0.10, liquidity: 0.10,
      cashflow: 0.20, management: 0.10, industry: 0.10,
      collateral: 0.10, relationship: 0.10, market_conditions: 0.05,
    },
  }),
  FACTOR_GROUPS: [
    'financial_performance', 'leverage', 'liquidity', 'cashflow',
    'management', 'industry', 'collateral', 'relationship', 'market_conditions',
  ],
}));

jest.mock('../scoreFactorDefinition.service', () => ({
  scoreFactorDefinitionService: {
    validateFactorWeights: jest.fn().mockReturnValue({ valid: true, warnings: [] }),
  },
}));

jest.mock('../applicationRating.service', () => ({
  persistApplicationRiskRating: jest.fn().mockResolvedValue(undefined),
}));

import prisma from '../../../utils/prisma';
import { scoringService } from '../scoring.service';
import { resolveScoreToRatingWithVersion } from '../ratingBand.service';

const mockedPrisma = prisma as unknown as {
  creditApplication: { findUnique: jest.Mock; update: jest.Mock };
  creditScorecardVersion: { findMany: jest.Mock };
  creditScoreRun: { create: jest.Mock };
};

describe('score run provenance (LOS-014)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.creditApplication.findUnique.mockResolvedValue({
      id: 'app-1',
      borrowerProfileId: 'bp-1',
      productType: 'TERM_LOAN',
      lane: 'CORPORATE',
      borrowerProfile: { borrowerType: 'CORPORATE' },
    });
    mockedPrisma.creditScorecardVersion.findMany.mockResolvedValue([{
      id: 'scv-1',
      scorecardId: 'sc-1',
      version: 1,
      isActive: true,
      effectiveFrom: new Date(Date.now() - 60_000),
      effectiveTo: null,
      factorWeights: {
        financial_performance: 0.15, leverage: 0.10, liquidity: 0.10,
        cashflow: 0.20, management: 0.10, industry: 0.10,
        collateral: 0.10, relationship: 0.10, market_conditions: 0.05,
      },
      scorecard: { isActive: true, productType: 'TERM_LOAN' },
    }]);
    mockedPrisma.creditScoreRun.create.mockImplementation(async (args: any) => ({
      id: 'run-1',
      ...args.data,
    }));
    (resolveScoreToRatingWithVersion as jest.Mock).mockResolvedValue({ rating: 'BBB', version: 3 });
  });

  it('persists the rating band version that produced the rating', async () => {
    await scoringService.executeScore('app-1', 'scv-1', { actorId: 'user-1', source: 'MANUAL' });

    const createData = mockedPrisma.creditScoreRun.create.mock.calls[0][0].data;
    expect(createData.ratingBandVersion).toBe(3);
  });

  it('persists a policy version identifying the policy set in force', async () => {
    await scoringService.executeScore('app-1', 'scv-1', { actorId: 'user-1', source: 'MANUAL' });

    const createData = mockedPrisma.creditScoreRun.create.mock.calls[0][0].data;
    expect(createData.policyVersion).toBeTruthy();
    expect(createData.policyVersion).toMatch(/^sha256:[0-9a-f]{12}$/);
  });

  it('sets ratingBandVersion to null when no active band set exists', async () => {
    (resolveScoreToRatingWithVersion as jest.Mock).mockResolvedValue({ rating: 'BBB', version: null });

    await scoringService.executeScore('app-1', 'scv-1', { actorId: 'user-1', source: 'MANUAL' });

    const createData = mockedPrisma.creditScoreRun.create.mock.calls[0][0].data;
    expect(createData.ratingBandVersion).toBeNull();
  });
});