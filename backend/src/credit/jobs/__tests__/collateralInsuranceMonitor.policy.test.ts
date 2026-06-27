jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    collateral: { findMany: jest.fn() },
    insuranceCover: { findMany: jest.fn() },
    earlyWarningSignal: { upsert: jest.fn() },
    applicationFacility: { findMany: jest.fn() },
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../services/policyParameter.service', () => ({
  getNumberPolicy: jest.fn(async (_key: string, fallback: number) => fallback),
}));

import prisma from '../../../utils/prisma';
import { getNumberPolicy } from '../../services/policyParameter.service';
import {
  checkCollateralValuationFreshness,
  checkInsuranceExpiry,
  hasStaleCollateralValuations,
} from '../collateralInsuranceMonitor.job';

const mockPrisma = prisma as unknown as {
  collateral: { findMany: jest.Mock };
  insuranceCover: { findMany: jest.Mock };
  earlyWarningSignal: { upsert: jest.Mock };
  applicationFacility: { findMany: jest.Mock };
};
const mockedGetNumberPolicy = getNumberPolicy as jest.Mock;

describe('collateralInsuranceMonitor policy parameters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetNumberPolicy.mockImplementation(async (_key: string, fallback: number) => fallback);
  });

  it('uses configured valuation warning/block months for stale valuation severity', async () => {
    mockedGetNumberPolicy.mockImplementation(async (key: string, fallback: number) => {
      if (key === 'collateral.valuation.warning_months') return 6;
      if (key === 'collateral.valuation.block_months') return 10;
      return fallback;
    });
    const eightMonthsAgo = new Date(Date.now() - 8 * 30.44 * 24 * 60 * 60 * 1000);
    mockPrisma.collateral.findMany
      .mockResolvedValueOnce([
        {
          id: 'collateral-1',
          collateralType: 'PROPERTY',
          description: 'Factory',
          valuationDate: eightMonthsAgo,
          facility: { applicationId: 'app-1', application: { applicationNo: 'CA-1' } },
          valuations: [],
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await checkCollateralValuationFreshness();

    expect(mockedGetNumberPolicy).toHaveBeenCalledWith('collateral.valuation.warning_months', 9);
    expect(mockedGetNumberPolicy).toHaveBeenCalledWith('collateral.valuation.block_months', 12);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('MEDIUM');
    expect(mockPrisma.earlyWarningSignal.upsert.mock.calls[0][0].create.description).toContain('threshold: 6 months');
  });

  it('uses configured insurance warning/high severity days', async () => {
    mockedGetNumberPolicy.mockImplementation(async (key: string, fallback: number) => {
      if (key === 'insurance.expiry.warning_days') return 20;
      if (key === 'insurance.expiry.high_severity_days') return 14;
      return fallback;
    });
    const tenDaysFromNow = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    mockPrisma.insuranceCover.findMany.mockResolvedValue([
      {
        id: 'insurance-1',
        collateralId: 'collateral-1',
        expiryDate: tenDaysFromNow,
        policyNumber: 'P-1',
        insurer: 'Insurer',
        collateral: { facility: { applicationId: 'app-1', application: { applicationNo: 'CA-1' } } },
      },
    ]);

    const result = await checkInsuranceExpiry();

    expect(mockedGetNumberPolicy).toHaveBeenCalledWith('insurance.expiry.warning_days', 30);
    expect(mockedGetNumberPolicy).toHaveBeenCalledWith('insurance.expiry.high_severity_days', 7);
    expect(result[0].severity).toBe('HIGH');
  });

  it('uses configured valuation block months for transition hard-block', async () => {
    mockedGetNumberPolicy.mockImplementation(async (key: string, fallback: number) =>
      key === 'collateral.valuation.block_months' ? 6 : fallback,
    );
    const eightMonthsAgo = new Date(Date.now() - 8 * 30.44 * 24 * 60 * 60 * 1000);
    mockPrisma.applicationFacility.findMany.mockResolvedValue([{ id: 'facility-1' }]);
    mockPrisma.collateral.findMany.mockResolvedValue([
      { id: 'collateral-1', collateralType: 'PROPERTY', valuationDate: eightMonthsAgo },
    ]);

    const result = await hasStaleCollateralValuations('app-1');

    expect(mockedGetNumberPolicy).toHaveBeenCalledWith('collateral.valuation.block_months', 12);
    expect(result.blocked).toBe(true);
  });
});
