jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditApplication: { findFirst: jest.fn() },
    retailIncome: { findUnique: jest.fn() },
    financialStatement: { findFirst: jest.fn(), findMany: jest.fn() },
  },
}));

jest.mock('../policyParameter.service', () => ({
  getNumberPolicy: jest.fn(async (_key: string, fallback: number) => fallback),
}));

import prisma from '../../../utils/prisma';
import { getNumberPolicy } from '../policyParameter.service';
import { smeFinancialService } from '../smeFinancial.service';

const mockPrisma = prisma as unknown as {
  creditApplication: { findFirst: jest.Mock };
  retailIncome: { findUnique: jest.Mock };
  financialStatement: { findFirst: jest.Mock; findMany: jest.Mock };
};
const mockedGetNumberPolicy = getNumberPolicy as jest.Mock;

describe('smeFinancial policy parameters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetNumberPolicy.mockImplementation(async (_key: string, fallback: number) => fallback);
    mockPrisma.creditApplication.findFirst.mockResolvedValue({ id: 'app-1' });
    mockPrisma.retailIncome.findUnique.mockResolvedValue({
      monthlyGrossIncome: 10000,
      monthlyNetIncome: null,
      hirePurchaseCommitment: 2500,
      creditCardCommitment: 1500,
      existingLoanCommitment: 2500,
      otherCommitments: 300,
    });
    mockPrisma.financialStatement.findFirst.mockResolvedValue({
      lineItems: [
        { lineKey: 'net_income', amount: 1000 },
        { lineKey: 'depreciation', amount: 100 },
        { lineKey: 'interest', amount: 0 },
        { lineKey: 'principal', amount: 1000 },
      ],
    });
  });

  it('uses configured SME DSR warning max for owner DSR status', async () => {
    mockedGetNumberPolicy.mockImplementation(async (key: string, fallback: number) =>
      key === 'sme.dsr.warn_max' ? 65 : fallback,
    );

    const result = await smeFinancialService.computeDualAssessment('bp-1');

    expect(result.ownerDsr?.dsrPercent).toBe(68);
    expect(result.ownerDsr?.status).toBe('fail');
  });

  it('uses configured SME DSCR pass minimum for business DSCR status', async () => {
    mockedGetNumberPolicy.mockImplementation(async (key: string, fallback: number) =>
      key === 'sme.dscr.pass_min' ? 1.3 : fallback,
    );

    const result = await smeFinancialService.computeDualAssessment('bp-1');

    expect(result.businessDscr?.dscr).toBe(1.1);
    expect(result.businessDscr?.status).toBe('warn');
  });

  it('uses configured ratio benchmark in simplified ratios', async () => {
    mockedGetNumberPolicy.mockImplementation(async (key: string, fallback: number) =>
      key === 'sme.current_ratio.pass_min' ? 1.5 : fallback,
    );
    mockPrisma.financialStatement.findMany.mockResolvedValue([
      {
        ratios: [
          { ratioKey: 'current_ratio', value: 1.3 },
        ],
      },
    ]);

    const ratios = await smeFinancialService.computeSimplifiedRatios('bp-1');
    const currentRatio = ratios.find((ratio) => ratio.key === 'current_ratio');

    expect(currentRatio?.benchmark.passThreshold).toBe(1.5);
    expect(currentRatio?.status).toBe('warn');
  });
});
