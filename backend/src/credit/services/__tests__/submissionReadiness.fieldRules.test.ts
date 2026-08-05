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
  getBureauFreshnessDays: jest.fn().mockResolvedValue(90),
  isBureauCheckFresh: jest.fn().mockResolvedValue({ fresh: true, staleProviders: [] }),
  isBureauChecklistComplete: jest.fn().mockResolvedValue(true),
  isBureauChecklistVerified: jest.fn().mockResolvedValue(true),
}));

jest.mock('../fatcaCrs.service', () => ({
  fatcaCrsService: {
    checkExpiry: jest.fn().mockResolvedValue({ exists: false, expired: false, expiryDate: null }),
  },
}));

jest.mock('../policyParameter.service', () => ({
  getNumberPolicy: jest.fn(async (_key: string, fallback: number) => fallback),
}));

// P1.3: Mock the rule engine so resolveRequiredDocuments returns the same defaults
// that the old hardcoded getRequiredDocuments() function used to return
jest.mock('../creditRuleEngine.service', () => ({
  resolveRequiredDocuments: jest.fn(async (scope: any) => {
    const defaults: Record<string, { documentClass: string; label: string; isMandatory: boolean; sortOrder: number }[]> = {
      INDIVIDUAL: [
        { documentClass: 'NRIC_PASSPORT', label: 'NRIC / Passport', isMandatory: true, sortOrder: 0 },
        { documentClass: 'PAYSLIP', label: 'Payslip', isMandatory: true, sortOrder: 1 },
        { documentClass: 'BANK_STATEMENT', label: 'Bank Statement', isMandatory: true, sortOrder: 2 },
      ],
      SOLE_PROPRIETOR: [
        { documentClass: 'NRIC_PASSPORT', label: 'NRIC / Passport', isMandatory: true, sortOrder: 0 },
        { documentClass: 'SSM_CERT', label: 'SSM Certificate', isMandatory: true, sortOrder: 1 },
        { documentClass: 'BANK_STATEMENT', label: 'Bank Statement', isMandatory: true, sortOrder: 2 },
      ],
      JOINT: [
        { documentClass: 'JV_AGREEMENT', label: 'JV Agreement', isMandatory: true, sortOrder: 0 },
        { documentClass: 'AUDITED_FINANCIALS', label: 'Audited Financials', isMandatory: true, sortOrder: 1 },
      ],
      CORPORATE: [
        { documentClass: 'SSM_CERT', label: 'SSM Certificate', isMandatory: true, sortOrder: 0 },
        { documentClass: 'AUDITED_FINANCIALS', label: 'Audited Financials', isMandatory: true, sortOrder: 1 },
        { documentClass: 'MOA_AOA', label: 'Memorandum & Articles (MOA/AOA)', isMandatory: true, sortOrder: 2 },
      ],
    };
    return defaults[scope.borrowerType] ?? defaults.INDIVIDUAL;
  }),
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
