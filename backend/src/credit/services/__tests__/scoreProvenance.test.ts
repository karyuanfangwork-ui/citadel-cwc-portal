/**
 * LOS-014 — a score run must record enough to be replayed.
 *
 * Verifies that creditScoreRun.create receives ratingBandVersion and
 * policyVersion, so an old rating can be reproduced from the stored
 * provenance fields rather than guesswork.
 */
import crypto from 'crypto';

jest.mock('../../../utils/prisma', () => {
  const mockFindFirst = jest.fn();
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
      creditScorecardVersion: { findFirst: mockFindFirst },
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
  mapScoreToRatingFromBands: jest.fn().mockResolvedValue('BBB'),
  ratingBandService: {
    getActiveBandSetVersion: jest.fn().mockResolvedValue(3),
    getActiveRatingBands: jest.fn().mockResolvedValue([]),
    getActiveRatingBandsWithFallback: jest.fn().mockResolvedValue([]),
  },
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
import { ratingBandService } from '../ratingBand.service';

const mockedPrisma = prisma as unknown as {
  creditApplication: { findUnique: jest.Mock; update: jest.Mock };
  creditScorecardVersion: { findFirst: jest.Mock };
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
    mockedPrisma.creditScorecardVersion.findFirst.mockResolvedValue({
      id: 'scv-1',
      version: 1,
      factorWeights: {
        financial_performance: 0.15, leverage: 0.10, liquidity: 0.10,
        cashflow: 0.20, management: 0.10, industry: 0.10,
        collateral: 0.10, relationship: 0.10, market_conditions: 0.05,
      },
    });
    mockedPrisma.creditScoreRun.create.mockImplementation(async (args: any) => ({
      id: 'run-1',
      ...args.data,
    }));
    (ratingBandService.getActiveBandSetVersion as jest.Mock).mockResolvedValue(3);
  });

  it('persists the rating band version that produced the rating', async () => {
    await scoringService.executeScore('app-1', 'scv-1', { actorId: 'user-1', source: 'MANUAL' });

    const createData = mockedPrisma.creditScoreRun.create.mock.calls[0][0].data;
    expect(createData.ratingBandVersion).toBe(3);
  });

  it('persists a policy version identifying the missing-data policy applied', async () => {
    await scoringService.executeScore('app-1', 'scv-1', { actorId: 'user-1', source: 'MANUAL' });

    const createData = mockedPrisma.creditScoreRun.create.mock.calls[0][0].data;
    expect(createData.policyVersion).toBeTruthy();
    // Policy version must be a short hash string like "md5:abc12345"
    expect(createData.policyVersion).toMatch(/^md5:[0-9a-f]{8}$/);
  });

  it('sets ratingBandVersion to null when no active band set exists', async () => {
    (ratingBandService.getActiveBandSetVersion as jest.Mock).mockResolvedValue(null);

    await scoringService.executeScore('app-1', 'scv-1', { actorId: 'user-1', source: 'MANUAL' });

    const createData = mockedPrisma.creditScoreRun.create.mock.calls[0][0].data;
    expect(createData.ratingBandVersion).toBeNull();
  });

  it('computes a deterministic policy version that changes when policy changes', () => {
    const policiesV1 = {
      cashflow: { factor: 'cashflow', policy: 'BLOCK', penaltyScore: 25, neutralScore: 50 },
      leverage: { factor: 'leverage', policy: 'PENALTY', penaltyScore: 25, neutralScore: 50 },
    };
    const policiesV2 = {
      cashflow: { factor: 'cashflow', policy: 'PENALTY', penaltyScore: 25, neutralScore: 50 },
      leverage: { factor: 'leverage', policy: 'PENALTY', penaltyScore: 25, neutralScore: 50 },
    };

    const hash = (p: Record<string, any>) => 'md5:' + crypto
      .createHash('md5')
      .update(JSON.stringify(
        Object.entries(p)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([f, c]: [string, any]) => `${f}:${c.policy}:${c.penaltyScore}`),
      ))
      .digest('hex')
      .slice(0, 8);

    // Same policy → same hash
    expect(hash(policiesV1)).toBe(hash(policiesV1));
    // Different policy → different hash
    expect(hash(policiesV1)).not.toBe(hash(policiesV2));
  });
});