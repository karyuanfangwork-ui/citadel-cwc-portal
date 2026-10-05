jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    borrowerProfile: { findUnique: jest.fn(), update: jest.fn() },
    creditScorecardVersion: { findMany: jest.fn() },
    financialStatement: { findFirst: jest.fn() },
    borrowerIncome: { findUnique: jest.fn() },
    borrowerCreditProfile: { findUnique: jest.fn() },
    borrowerBureauReport: { findFirst: jest.fn() },
    borrowerRiskRun: { create: jest.fn() },
  },
}));

jest.mock('../scoring.service', () => ({
  computeFinancialPerformanceScore: jest.fn().mockReturnValue(50),
  computeLeverageScore: jest.fn().mockReturnValue(50),
  computeLiquidityScore: jest.fn().mockReturnValue(50),
  computeCashflowScore: jest.fn().mockReturnValue(50),
  computeDsrCashflowScore: jest.fn().mockReturnValue(50),
}));

jest.mock('../ratingResolution.service', () => ({
  resolveRatingOrFail: jest.fn().mockResolvedValue({ rating: 'BBB', ratingBandVersion: 7, usedFallback: false }),
}));
jest.mock('../policySet.service', () => ({ getPolicySetVersion: jest.fn().mockResolvedValue('policy-v7') }));
jest.mock('../borrowerActivity.service', () => ({ logBorrowerActivity: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../bureauCheck.service', () => ({
  applyBureauCaps: jest.fn().mockReturnValue({ effectiveRating: 'BBB', capsApplied: [] }),
}));

import prisma from '../../../utils/prisma';
import { executeBorrowerScore } from '../borrowerScoring.service';

const weights = {
  financial_performance: 100,
  leverage: 0,
  liquidity: 0,
  cashflow: 0,
  management: 0,
  industry: 0,
  collateral: 0,
  relationship: 0,
  market_conditions: 0,
};

describe('borrower risk run provenance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.borrowerProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'borrower-1', borrowerType: 'CORPORATE' });
    (prisma.creditScorecardVersion.findMany as jest.Mock).mockResolvedValue([{
      id: 'scorecard-version-4',
      version: 4,
      isActive: true,
      effectiveFrom: new Date(Date.now() - 60_000),
      effectiveTo: null,
      factorWeights: weights,
      retailFactorWeights: weights,
      scorecard: { isActive: true, productType: null },
    }]);
    (prisma.financialStatement.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.borrowerIncome.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.borrowerCreditProfile.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.borrowerBureauReport.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.borrowerRiskRun.create as jest.Mock).mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'risk-run-1', ...data, runAt: new Date(),
    }));
  });

  it('persists the scorecard, rating-band and policy versions used', async () => {
    await executeBorrowerScore('borrower-1', 'analyst-1');

    expect(prisma.borrowerRiskRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        scorecardVersionId: 'scorecard-version-4',
        scorecardVersion: 4,
        ratingBandVersion: 7,
        policyVersion: 'policy-v7',
      }),
    }));
  });
});
