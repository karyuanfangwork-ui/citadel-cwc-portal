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
      creditScorecardVersion: { findFirst: mockFindFirst, findMany: mockFindMany },
      creditApplication: { findUnique: mockFindUnique, update: jest.fn().mockResolvedValue({}) },
      financialStatement: { findFirst: jest.fn().mockResolvedValue(null) },
      creditScoreRun: { create: mockCreate },
      ratingBandConfig: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue({ version: 1 }) },
      scoreFactorDefinition: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn(),
      $transaction: jest.fn(async (fn: any) => fn(mockTx)),
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

jest.mock('../applicationRating.service', () => ({
  persistApplicationRiskRating: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../missingDataPolicy.service', () => ({
  resolveMissingFactorScore: jest.fn().mockImplementation((factor: string) => ({
    score: 50, record: { factor, subField: 'test', policy: 'NEUTRAL', appliedScore: 50 },
  })),
  getMissingDataPolicies: jest.fn().mockResolvedValue({}),
}));

jest.mock('../policySet.service', () => ({
  getPolicySetVersion: jest.fn().mockResolvedValue('sha256:abcdef123456'),
}));

jest.mock('../scoreFactorDefinition.service', () => ({
  scoreFactorDefinitionService: {
    getActiveDefinitions: jest.fn().mockResolvedValue([
      { factorKey: 'financial_performance', inputSourceType: 'RATIO', applicableBorrowerTypes: ['INDIVIDUAL', 'SOLE_PROPRIETOR', 'CORPORATE'] },
      { factorKey: 'leverage', inputSourceType: 'RATIO', applicableBorrowerTypes: ['INDIVIDUAL', 'SOLE_PROPRIETOR', 'CORPORATE'] },
      { factorKey: 'liquidity', inputSourceType: 'RATIO', applicableBorrowerTypes: ['INDIVIDUAL', 'SOLE_PROPRIETOR', 'CORPORATE'] },
      { factorKey: 'cashflow', inputSourceType: 'RATIO', applicableBorrowerTypes: ['INDIVIDUAL', 'SOLE_PROPRIETOR', 'CORPORATE'] },
      { factorKey: 'management', inputSourceType: 'QUALITATIVE', applicableBorrowerTypes: ['INDIVIDUAL', 'SOLE_PROPRIETOR', 'CORPORATE'] },
      { factorKey: 'industry', inputSourceType: 'QUALITATIVE', applicableBorrowerTypes: ['INDIVIDUAL', 'SOLE_PROPRIETOR', 'CORPORATE'] },
      { factorKey: 'collateral', inputSourceType: 'QUALITATIVE', applicableBorrowerTypes: ['INDIVIDUAL', 'SOLE_PROPRIETOR', 'CORPORATE'] },
      { factorKey: 'relationship', inputSourceType: 'QUALITATIVE', applicableBorrowerTypes: ['INDIVIDUAL', 'SOLE_PROPRIETOR', 'CORPORATE'] },
      { factorKey: 'market_conditions', inputSourceType: 'EXTERNAL', applicableBorrowerTypes: ['INDIVIDUAL', 'SOLE_PROPRIETOR', 'CORPORATE'] },
    ]),
    validateFactorWeights: jest.fn().mockResolvedValue({ valid: true, warnings: [] }),
  },
}));

import { scoringService } from '../scoring.service';
import prisma from '../../../utils/prisma';

const productScorecardVersion: any = {
  id: 'sv-prod',
  scorecardId: 'sc-prod',
  factorWeights: {
    financial_performance: 15, leverage: 15, liquidity: 10, cashflow: 15,
    management: 10, industry: 10, collateral: 10, relationship: 10, market_conditions: 5,
  },
  scorecard: { id: 'sc-prod', name: 'Term Loan Scorecard', productType: 'TERM_LOAN' },
};

const genericScorecardVersion: any = {
  id: 'sv-generic',
  scorecardId: 'sc-generic',
  factorWeights: {
    financial_performance: 15, leverage: 15, liquidity: 10, cashflow: 15,
    management: 10, industry: 10, collateral: 10, relationship: 10, market_conditions: 5,
  },
  scorecard: { id: 'sc-generic', name: 'Generic Scorecard', productType: null },
};

describe('executeScore product-specific scorecard selection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('prefers a product-specific scorecard when the application has a productType', async () => {
    (prisma.creditApplication.findUnique as jest.Mock).mockResolvedValue({
      borrowerProfileId: 'bp-1',
      productType: 'TERM_LOAN',
      borrowerProfile: { borrowerType: 'CORPORATE' },
    });
    (prisma.creditScorecardVersion.findMany as jest.Mock)
      .mockResolvedValueOnce([productScorecardVersion])  // product-specific query
      .mockResolvedValueOnce([genericScorecardVersion]); // generic fallback (not reached)
    (prisma.creditScoreRun.create as jest.Mock).mockResolvedValue({
      id: 'run-1', applicationId: 'app-1', riskRating: 'A', totalScore: 72,
    });

    await scoringService.executeScore('app-1');

    // The first findMany call should filter by productType
    const firstCall = (prisma.creditScorecardVersion.findMany as jest.Mock).mock.calls[0][0];
    expect(firstCall.where.scorecard).toEqual({ productType: 'TERM_LOAN' });
    // Should only have been called once (product-specific found, no fallback)
    expect(prisma.creditScorecardVersion.findMany).toHaveBeenCalledTimes(1);
  });

  it('falls back to generic scorecard when no product-specific one exists', async () => {
    (prisma.creditApplication.findUnique as jest.Mock).mockResolvedValue({
      borrowerProfileId: 'bp-1',
      productType: 'OVERDRAFT',
      borrowerProfile: { borrowerType: 'CORPORATE' },
    });
    const findManyMock = prisma.creditScorecardVersion.findMany as jest.Mock;
    findManyMock.mockReset();
    findManyMock.mockResolvedValueOnce([])                    // no product-specific scorecard
              .mockResolvedValueOnce([genericScorecardVersion]); // generic fallback

    (prisma.creditScoreRun.create as jest.Mock).mockResolvedValue({
      id: 'run-2', applicationId: 'app-1', riskRating: 'BBB', totalScore: 65,
    });

    await scoringService.executeScore('app-1');

    expect(findManyMock).toHaveBeenCalledTimes(2);
    const secondCall = findManyMock.mock.calls[1][0];
    expect(secondCall.where.scorecard).toBeUndefined();
  });
});