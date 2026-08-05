jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    applicationFacility: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    collateral: {
      findMany: jest.fn(),
    },
    collateralHaircutConfig: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../auditChain.service', () => ({
  AuditChainService: { appendEvent: jest.fn() },
}));

jest.mock('../recalc.service', () => ({
  recalcScore: jest.fn(),
}));

jest.mock('../policyParameter.service', () => ({
  getNumberPolicy: jest.fn(async (_key: string, fallback: number) => fallback),
}));

import prisma from '../../../utils/prisma';
import { getNumberPolicy } from '../policyParameter.service';
import { collateralService } from '../collateral.service';

const mockPrisma = prisma as unknown as {
  applicationFacility: { findUnique: jest.Mock; findMany: jest.Mock };
  collateral: { findMany: jest.Mock };
  collateralHaircutConfig: { findMany: jest.Mock };
};
const mockedGetNumberPolicy = getNumberPolicy as jest.Mock;

describe('collateral policy parameters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetNumberPolicy.mockImplementation(async (_key: string, fallback: number) => fallback);
    mockPrisma.applicationFacility.findUnique.mockResolvedValue({ id: 'facility-1', amount: 80000 });
    mockPrisma.collateral.findMany.mockResolvedValue([
      {
        id: 'collateral-1',
        collateralType: 'PROPERTY',
        securityCategory: 'PROPERTY',
        marketValue: 100000,
        forcedSaleValue: 100000,
        valuationDate: new Date(),
      },
    ]);
    mockPrisma.collateralHaircutConfig.findMany.mockResolvedValue([
      { securityCategory: 'PROPERTY', haircutPercent: 0, minValuationAgeMonths: 12 },
    ]);
  });

  it('uses configured default LTV cap when no explicit cap is passed', async () => {
    mockedGetNumberPolicy.mockImplementation(async (key: string, fallback: number) =>
      key === 'collateral.ltv_cap.default_pct' ? 75 : fallback,
    );

    const result = await collateralService.computeLtv('facility-1');

    expect(mockedGetNumberPolicy).toHaveBeenCalledWith('collateral.ltv_cap.default_pct', 70);
    expect(result.ltvPercent).toBe(80);
    expect(result.exceedsCap).toBe(true);
  });

  it('does not override an explicit LTV cap argument', async () => {
    mockedGetNumberPolicy.mockImplementation(async (key: string, fallback: number) =>
      key === 'collateral.ltv_cap.default_pct' ? 75 : fallback,
    );

    const result = await collateralService.computeLtv('facility-1', 85);

    expect(result.ltvPercent).toBe(80);
    expect(result.exceedsCap).toBe(false);
  });
});
