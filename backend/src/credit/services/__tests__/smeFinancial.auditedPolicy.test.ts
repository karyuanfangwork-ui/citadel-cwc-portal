jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    borrowerProfile: { findUnique: jest.fn() },
    financialStatement: { findMany: jest.fn(), findFirst: jest.fn() },
    creditApplication: { findFirst: jest.fn() },
    retailIncome: { findUnique: jest.fn() },
  },
}));

jest.mock('../policyParameter.service', () => ({
  getNumberPolicy: jest.fn(async (_key: string, fallback: number) => fallback),
}));

import prisma from '../../../utils/prisma';
import { getNumberPolicy } from '../policyParameter.service';
import { smeFinancialService } from '../smeFinancial.service';

const mockPrisma = prisma as unknown as {
  borrowerProfile: { findUnique: jest.Mock };
  financialStatement: { findMany: jest.Mock; findFirst: jest.Mock };
};
const mockedGetNumberPolicy = getNumberPolicy as jest.Mock;

describe('smeFinancial audited-account policy parameters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetNumberPolicy.mockImplementation(async (_key: string, fallback: number) => fallback);
    mockPrisma.financialStatement.findMany.mockResolvedValue([]);
  });

  it('uses configured audited-account amount threshold in SME assessment', async () => {
    mockedGetNumberPolicy.mockImplementation(async (key: string, fallback: number) =>
      key === 'sme.audited_accounts.amount_min' ? 750000 : fallback,
    );
    mockPrisma.borrowerProfile.findUnique.mockResolvedValue({
      id: 'bp-1',
      borrowerType: 'CORPORATE',
      annualTurnover: 600000,
      yearsTrading: 3,
      smeFinancialStatementType: 'MANAGEMENT',
      sicCode: null,
    });

    const result = await smeFinancialService.getSmeAssessment('bp-1');

    expect(mockedGetNumberPolicy).toHaveBeenCalledWith('sme.audited_accounts.years_trading_min', 3);
    expect(mockedGetNumberPolicy).toHaveBeenCalledWith('sme.audited_accounts.amount_min', 500000);
    expect(result.requiresAudited).toBe(false);
  });

  it('exposes configured async financial statement type validation', async () => {
    mockedGetNumberPolicy.mockImplementation(async (key: string, fallback: number) =>
      key === 'sme.audited_accounts.years_trading_min' ? 5 : fallback,
    );

    const result = await smeFinancialService.validateFinancialStatementTypeConfigured('MANAGEMENT', 4, 900000);

    expect(result.acceptable).toBe(true);
    expect(result.reason).toContain('Management accounts accepted');
  });
});
