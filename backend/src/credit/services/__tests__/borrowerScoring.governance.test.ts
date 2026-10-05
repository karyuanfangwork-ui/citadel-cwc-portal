jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    borrowerProfile: { findUnique: jest.fn(), update: jest.fn() },
    creditScorecardVersion: { findMany: jest.fn() },
    borrowerRiskRun: { create: jest.fn() },
  },
}));

jest.mock('../scoring.service', () => ({
  computeFinancialPerformanceScore: jest.fn(),
  computeLeverageScore: jest.fn(),
  computeLiquidityScore: jest.fn(),
  computeCashflowScore: jest.fn(),
  computeDsrCashflowScore: jest.fn(),
}));

import prisma from '../../../utils/prisma';
import { executeBorrowerScore } from '../borrowerScoring.service';

const profile = { id: 'borrower-1', borrowerType: 'CORPORATE' };

describe('borrower scorecard-version selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.borrowerProfile.findUnique as jest.Mock).mockResolvedValue(profile);
  });

  it('fails without an effective active generic version and creates no risk run', async () => {
    (prisma.creditScorecardVersion.findMany as jest.Mock).mockResolvedValue([]);

    await expect(executeBorrowerScore('borrower-1')).rejects.toThrow(/No active scorecard version/i);
    expect(prisma.borrowerRiskRun.create).not.toHaveBeenCalled();
    expect(prisma.borrowerProfile.update).not.toHaveBeenCalled();
  });

  it('fails closed when more than one effective generic version matches', async () => {
    (prisma.creditScorecardVersion.findMany as jest.Mock).mockResolvedValue([
      { id: 'version-1', version: 1 },
      { id: 'version-2', version: 2 },
    ]);

    await expect(executeBorrowerScore('borrower-1')).rejects.toThrow(/Multiple effective generic scorecard versions/i);
    expect(prisma.borrowerRiskRun.create).not.toHaveBeenCalled();
    expect(prisma.borrowerProfile.update).not.toHaveBeenCalled();
  });
});
