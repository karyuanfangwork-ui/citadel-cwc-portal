jest.mock('../../../utils/prisma', () => ({
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
  },
}));

jest.mock('../creditFieldCheck.service', () => ({
  checkRequiredFields: jest.fn(),
}));

jest.mock('../scoreOverride.service', () => ({
  hasPendingScoreOverride: jest.fn().mockResolvedValue(false),
}));

jest.mock('../../jobs/collateralInsuranceMonitor.job', () => ({
  hasStaleCollateralValuations: jest.fn().mockResolvedValue({ blocked: false, staleCollaterals: [] }),
}));

jest.mock('../bureauCheck.service', () => ({
  isBureauCheckFresh: jest.fn().mockResolvedValue({ fresh: true, staleProviders: [] }),
  isBureauChecklistComplete: jest.fn().mockResolvedValue(true),
  isBureauChecklistVerified: jest.fn().mockResolvedValue(true),
}));

jest.mock('../fatcaCrs.service', () => ({
  fatcaCrsService: {
    checkExpiry: jest.fn().mockResolvedValue({ exists: false, expired: false, expiryDate: null }),
  },
}));

import prisma from '../../../utils/prisma';
import { checkRequiredFields } from '../creditFieldCheck.service';
import { validateSubmissionReadiness } from '../submissionReadiness.service';

const mockedFindUnique = prisma.creditApplication.findUnique as jest.Mock;
const mockedRetailIncomeFindUnique = prisma.retailIncome.findUnique as jest.Mock;
const mockedCheckRequiredFields = checkRequiredFields as jest.Mock;

describe('validateSubmissionReadiness — field rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedFindUnique.mockResolvedValue({
      id: 'app-1',
      productType: 'TERM_LOAN',
      lane: 'PERSONAL_FAST',
      borrowerProfileId: 'bp-1',
      borrowerProfile: {
        borrowerType: 'INDIVIDUAL',
        accountId: 'acct-1',
        contactId: 'contact-1',
        exposureLimit: 0,
        totalExposure: 0,
        amlRiskTier: null,
        contact: { nricPassport: 'S1234567A' },
      },
      facilities: [{ id: 'fac-1', amount: 10000 }],
      documents: [
        { id: 'doc-1', classification: 'NRIC_PASSPORT', verificationStatus: 'VERIFIED', isAvClean: true },
        { id: 'doc-2', classification: 'PAYSLIP', verificationStatus: 'VERIFIED', isAvClean: true },
        { id: 'doc-3', classification: 'BANK_STATEMENT', verificationStatus: 'VERIFIED', isAvClean: true },
      ],
      parties: [],
      state: 'DRAFT',
    });

    mockedRetailIncomeFindUnique.mockResolvedValue(null);
  });

  it('adds missing-field errors from the resolver during submission readiness checks', async () => {
    mockedCheckRequiredFields.mockResolvedValue({
      ok: false,
      missing: [{ fieldPath: 'financials.annualTurnover', label: 'Annual Turnover' }],
    });

    const result = await validateSubmissionReadiness('app-1', { stage: 'submission' });

    expect(mockedCheckRequiredFields).toHaveBeenCalledWith(
      { productType: 'TERM_LOAN', lane: 'PERSONAL_FAST', borrowerType: 'INDIVIDUAL' },
      expect.any(Object),
    );
    expect(result.ready).toBe(false);
    expect(result.errors.some((issue) => issue.field === 'financials.annualTurnover')).toBe(true);
  });
});
