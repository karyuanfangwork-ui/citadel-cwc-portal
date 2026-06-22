jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditApplication: {
      findUnique: jest.fn(),
    },
    retailIncome: {
      findUnique: jest.fn(),
    },
    financialStatement: {
      count: jest.fn(),
    },
    eclSnapshot: {
      count: jest.fn(),
    },
  },
}));

jest.mock('../services/scoreOverride.service', () => ({
  hasPendingScoreOverride: jest.fn().mockResolvedValue(false),
}));

jest.mock('../jobs/collateralInsuranceMonitor.job', () => ({
  hasStaleCollateralValuations: jest.fn().mockResolvedValue({
    blocked: false,
    staleCollaterals: [],
  }),
}));

jest.mock('../services/bureauCheck.service', () => ({
  isBureauCheckFresh: jest.fn().mockResolvedValue({ fresh: true, staleProviders: [] }),
  isBureauChecklistComplete: jest.fn().mockResolvedValue(true),
  isBureauChecklistVerified: jest.fn().mockResolvedValue(true),
}));

jest.mock('../services/fatcaCrs.service', () => ({
  fatcaCrsService: {
    checkExpiry: jest.fn().mockResolvedValue({ exists: false, expired: false, expiryDate: null }),
  },
}));

jest.mock('../services/creditFieldCheck.service', () => ({
  checkRequiredFields: jest.fn(),
}));

import prisma from '../../utils/prisma';
import { validateSubmissionReadiness } from '../services/submissionReadiness.service';
import { checkRequiredFields } from '../services/creditFieldCheck.service';

const mockPrisma = prisma as unknown as {
  creditApplication: { findUnique: jest.Mock };
  retailIncome: { findUnique: jest.Mock };
  financialStatement: { count: jest.Mock };
  eclSnapshot: { count: jest.Mock };
};

const mockCheckRequiredFields = checkRequiredFields as jest.Mock;

const BASE_APPLICATION = {
  id: 'app-1',
  state: 'DRAFT',
  borrowerProfileId: 'bp-1',
  productType: 'TERM_LOAN',
  lane: 'PERSONAL_FAST',
  purpose: 'Working capital',
  borrowerProfile: {
    borrowerType: 'INDIVIDUAL',
    exposureLimit: null,
    totalExposure: null,
    amlRiskTier: null,
  },
  documents: [
    { classification: 'NRIC_PASSPORT' },
    { classification: 'PAYSLIP' },
    { classification: 'BANK_STATEMENT' },
  ],
  facilities: [{ id: 'fac-1', amount: 10000 }],
  parties: [],
};

describe('validateSubmissionReadiness — DRAFT submission gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.creditApplication.findUnique.mockResolvedValue(BASE_APPLICATION);
    mockPrisma.retailIncome.findUnique.mockResolvedValue(null);
    mockPrisma.financialStatement.count.mockResolvedValue(0);
    mockPrisma.eclSnapshot.count.mockResolvedValue(0);
  });

  it('returns ready:false when required submission fields are missing', async () => {
    mockCheckRequiredFields.mockResolvedValue({
      ok: false,
      missing: [{ fieldPath: 'requestedAmount', label: 'Requested Amount' }],
    });
    mockPrisma.creditApplication.findUnique.mockResolvedValue({
      ...BASE_APPLICATION,
      lane: 'SME',
      borrowerProfile: {
        borrowerType: 'SOLE_PROPRIETOR',
        exposureLimit: null,
        totalExposure: null,
        amlRiskTier: null,
      },
      documents: [
        { classification: 'NRIC_PASSPORT' },
        { classification: 'SSM_CERT' },
        { classification: 'BANK_STATEMENT' },
      ],
      facilities: [],
    });

    const result = await validateSubmissionReadiness('app-1', { stage: 'submission' });

    expect(result.ready).toBe(false);
    expect(result.errors.map((error: { field: string }) => error.field)).toEqual(
      expect.arrayContaining(['facilities', 'requestedAmount']),
    );
  });

  it('returns ready:true when submission requirements are satisfied', async () => {
    mockCheckRequiredFields.mockResolvedValue({ ok: true, missing: [] });

    const result = await validateSubmissionReadiness('app-1', { stage: 'submission' });

    expect(result.ready).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(mockCheckRequiredFields).toHaveBeenCalledWith(
      expect.objectContaining({
        productType: 'TERM_LOAN',
        lane: 'PERSONAL_FAST',
        borrowerType: 'INDIVIDUAL',
      }),
      expect.objectContaining({ id: 'app-1' }),
    );
  });

  it('does not require facilities for PERSONAL_FAST submissions', async () => {
    mockCheckRequiredFields.mockResolvedValue({ ok: true, missing: [] });
    mockPrisma.creditApplication.findUnique.mockResolvedValue({
      ...BASE_APPLICATION,
      facilities: [],
    });

    const result = await validateSubmissionReadiness('app-1', { stage: 'submission' });

    expect(result.ready).toBe(true);
    expect(result.errors.find((error: { field: string }) => error.field === 'facilities')).toBeUndefined();
  });
});
