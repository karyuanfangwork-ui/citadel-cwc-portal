const mockFindUnique = jest.fn();
const mockFinancialCount = jest.fn().mockResolvedValue(1);
const mockRetailFindUnique = jest.fn().mockResolvedValue({ dsrPercent: 10, netDsrPercent: 10, dsrBasis: 'NET' });
const mockEclCount = jest.fn().mockResolvedValue(1);
const mockDeviationFindMany = jest.fn().mockResolvedValue([]);

jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditApplication: { findUnique: (...a: unknown[]) => mockFindUnique(...a) },
    financialStatement: { count: (...a: unknown[]) => mockFinancialCount(...a) },
    retailIncome: { findUnique: (...a: unknown[]) => mockRetailFindUnique(...a) },
    eclSnapshot: { count: (...a: unknown[]) => mockEclCount(...a) },
    deviationApproval: { findMany: (...a: unknown[]) => mockDeviationFindMany(...a) },
    creditRecommendation: { findFirst: jest.fn().mockResolvedValue(null) },
  },
}));

jest.mock('../../jobs/collateralInsuranceMonitor.job', () => ({
  hasStaleCollateralValuations: jest.fn().mockResolvedValue({ blocked: false, staleCollaterals: [] }),
}));
jest.mock('../scoreOverride.service', () => ({ hasPendingScoreOverride: jest.fn().mockResolvedValue(false) }));
jest.mock('../bureauCheck.service', () => ({
  getBureauFreshnessDays: jest.fn().mockResolvedValue(90),
  isBureauCheckFresh: jest.fn().mockResolvedValue({ fresh: true, staleProviders: [] }),
  isBureauChecklistComplete: jest.fn().mockResolvedValue(true),
  isBureauChecklistVerified: jest.fn().mockResolvedValue(true),
}));
jest.mock('../fatcaCrs.service', () => ({ fatcaCrsService: { checkExpiry: jest.fn().mockResolvedValue({ exists: true, expired: false }) } }));
jest.mock('../creditFieldCheck.service', () => ({ checkRequiredFields: jest.fn().mockResolvedValue({ missing: [] }) }));
jest.mock('../collateral.service', () => ({
  collateralService: { computeApplicationLtv: jest.fn().mockResolvedValue([]) },
}));
jest.mock('../smeFinancial.service', () => ({
  smeFinancialService: { computeDualAssessment: jest.fn().mockResolvedValue({ ownerDsr: null, businessDscr: null, overallStatus: 'pass', smeLane: 'SME' }) },
}));
jest.mock('../policyParameter.service', () => ({
  getNumberPolicy: jest.fn(async (_key: string, fallback: number) => fallback),
}));

// P1.3: Mock the rule engine so resolveRequiredDocuments returns the same defaults
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

import { validateSubmissionReadiness } from '../submissionReadiness.service';
import { collateralService } from '../collateral.service';
import { smeFinancialService } from '../smeFinancial.service';
import { getNumberPolicy } from '../policyParameter.service';

const mockedGetNumberPolicy = getNumberPolicy as jest.Mock;

function baseApp(overrides: Record<string, unknown> = {}) {
  return {
    id: 'app-1',
    productType: 'TERM_LOAN',
    lane: 'PERSONAL_FAST',
    purpose: 'Working capital',
    borrowerProfileId: 'bp-1',
    borrowerProfile: {
      accountId: null, contactId: null, borrowerType: 'INDIVIDUAL',
      amlRiskTier: 'LOW', exposureLimit: 0, totalExposure: 0, nricPassport: 'A123',
    },
    facilities: [{ id: 'f1', facilityType: 'TERM_LOAN', amount: 50000 }],
    documents: [
      { id: 'd1', classification: 'PAYSLIP', verificationStatus: 'VERIFIED', isAvClean: true },
      { id: 'd2', classification: 'BANK_STATEMENT', verificationStatus: 'VERIFIED', isAvClean: true },
    ],
    parties: [{ id: 'p1', role: 'BORROWER', borrowerProfileId: 'bp-1' }],
    ...overrides,
  };
}

describe('validateSubmissionReadiness — mandatory purpose (submission stage)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetNumberPolicy.mockImplementation(async (_key: string, fallback: number) => fallback);
  });

  it('blocks submission when purpose is blank', async () => {
    mockFindUnique.mockResolvedValue(baseApp({ purpose: '   ' }));
    const r = await validateSubmissionReadiness('app-1', { stage: 'submission' });
    expect(r.errors.some((e) => e.field === 'purpose')).toBe(true);
    expect(r.ready).toBe(false);
  });

  it('blocks submission when purpose is null', async () => {
    mockFindUnique.mockResolvedValue(baseApp({ purpose: null }));
    const r = await validateSubmissionReadiness('app-1', { stage: 'submission' });
    expect(r.errors.some((e) => e.field === 'purpose')).toBe(true);
  });

  it('allows submission when purpose is present', async () => {
    mockFindUnique.mockResolvedValue(baseApp({ purpose: 'Buy equipment' }));
    const r = await validateSubmissionReadiness('app-1', { stage: 'submission' });
    expect(r.errors.some((e) => e.field === 'purpose')).toBe(false);
  });
});

describe('validateSubmissionReadiness — configurable retail DSR thresholds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetNumberPolicy.mockImplementation(async (_key: string, fallback: number) => fallback);
  });

  it('uses configured net DSR warning maximum', async () => {
    mockedGetNumberPolicy.mockImplementation(async (key: string, fallback: number) =>
      key === 'readiness.retail.net_dsr.warn_max' ? 55 : fallback,
    );
    mockFindUnique.mockResolvedValue(baseApp());
    mockRetailFindUnique.mockResolvedValue({ dsrPercent: 10, netDsrPercent: 56, dsrBasis: 'NET' });

    const r = await validateSubmissionReadiness('app-1', { stage: 'submission' });

    expect(r.errors.some((e) => e.field === 'retailIncome')).toBe(true);
    expect(r.errors.find((e) => e.field === 'retailIncome')?.message).toContain('55% threshold');
  });
});

describe('validateSubmissionReadiness — LTV cap (committee stage)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetNumberPolicy.mockImplementation(async (_key: string, fallback: number) => fallback);
  });

  it('blocks committee when a collateralised facility exceeds LTV cap and no deviation approved', async () => {
    mockFindUnique.mockResolvedValue(baseApp({ borrowerProfile: { ...baseApp().borrowerProfile, borrowerType: 'CORPORATE' } }));
    (collateralService.computeApplicationLtv as jest.Mock).mockResolvedValue([
      { ltvPercent: 85, exceedsCap: true, haircutDetails: [{ collateralId: 'c1', category: 'PROPERTY', marketValue: 100000, haircut: 20, adjustedValue: 80000 }] },
    ]);
    mockDeviationFindMany.mockResolvedValue([]);
    const r = await validateSubmissionReadiness('app-1', { stage: 'committee' });
    expect(r.errors.some((e) => e.field === 'ltv')).toBe(true);
  });

  it('does not block when an APPROVED LTV deviation exists', async () => {
    mockFindUnique.mockResolvedValue(baseApp({ borrowerProfile: { ...baseApp().borrowerProfile, borrowerType: 'CORPORATE' } }));
    (collateralService.computeApplicationLtv as jest.Mock).mockResolvedValue([
      { ltvPercent: 85, exceedsCap: true, haircutDetails: [{ collateralId: 'c1', category: 'PROPERTY', marketValue: 100000, haircut: 20, adjustedValue: 80000 }] },
    ]);
    mockDeviationFindMany.mockResolvedValue([{ policyRule: 'LTV_CAP', status: 'APPROVED' }]);
    const r = await validateSubmissionReadiness('app-1', { stage: 'committee' });
    expect(r.errors.some((e) => e.field === 'ltv')).toBe(false);
  });

  it('does not block an unsecured facility (no collateral) even if exceedsCap is true', async () => {
    mockFindUnique.mockResolvedValue(baseApp({ borrowerProfile: { ...baseApp().borrowerProfile, borrowerType: 'CORPORATE' } }));
    (collateralService.computeApplicationLtv as jest.Mock).mockResolvedValue([
      { ltvPercent: Infinity, exceedsCap: true, haircutDetails: [] },
    ]);
    const r = await validateSubmissionReadiness('app-1', { stage: 'committee' });
    expect(r.errors.some((e) => e.field === 'ltv')).toBe(false);
  });
});

describe('validateSubmissionReadiness — DSCR minimum (committee stage)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetNumberPolicy.mockImplementation(async (_key: string, fallback: number) => fallback);
  });

  function corpApp() {
    return baseApp({ borrowerProfile: { ...baseApp().borrowerProfile, borrowerType: 'CORPORATE' } });
  }

  it('blocks committee when DSCR assessment fails and no deviation approved', async () => {
    mockFindUnique.mockResolvedValue(corpApp());
    (smeFinancialService.computeDualAssessment as jest.Mock).mockResolvedValue({
      ownerDsr: null,
      businessDscr: { netIncome: 100000, depreciation: 10000, interest: 5000, principal: 20000, ebitda: 110000, dscr: 0.8, status: 'fail' },
      overallStatus: 'fail',
      smeLane: 'SME',
    });
    mockDeviationFindMany.mockResolvedValue([]);
    const r = await validateSubmissionReadiness('app-1', { stage: 'committee' });
    expect(r.errors.some((e) => e.field === 'dscr')).toBe(true);
  });

  it('does not block when an APPROVED DSCR deviation exists', async () => {
    mockFindUnique.mockResolvedValue(corpApp());
    (smeFinancialService.computeDualAssessment as jest.Mock).mockResolvedValue({
      ownerDsr: null,
      businessDscr: { netIncome: 100000, depreciation: 10000, interest: 5000, principal: 20000, ebitda: 110000, dscr: 0.8, status: 'fail' },
      overallStatus: 'fail',
      smeLane: 'SME',
    });
    mockDeviationFindMany.mockResolvedValue([{ policyRule: 'DSCR_MIN', status: 'APPROVED' }]);
    const r = await validateSubmissionReadiness('app-1', { stage: 'committee' });
    expect(r.errors.some((e) => e.field === 'dscr')).toBe(false);
  });

  it('warns but does not block when DSCR is in the warn band', async () => {
    mockFindUnique.mockResolvedValue(corpApp());
    (smeFinancialService.computeDualAssessment as jest.Mock).mockResolvedValue({
      ownerDsr: null,
      businessDscr: { netIncome: 100000, depreciation: 10000, interest: 5000, principal: 20000, ebitda: 110000, dscr: 1.05, status: 'warn' },
      overallStatus: 'warn',
      smeLane: 'SME',
    });
    const r = await validateSubmissionReadiness('app-1', { stage: 'committee' });
    expect(r.errors.some((e) => e.field === 'dscr')).toBe(false);
    expect(r.warnings.some((e) => e.field === 'dscr')).toBe(true);
  });

  it('does not run DSCR gate for retail borrowers', async () => {
    mockFindUnique.mockResolvedValue(baseApp()); // INDIVIDUAL
    (smeFinancialService.computeDualAssessment as jest.Mock).mockResolvedValue({
      ownerDsr: null,
      businessDscr: { netIncome: 100000, depreciation: 10000, interest: 5000, principal: 20000, ebitda: 110000, dscr: 0.5, status: 'fail' },
      overallStatus: 'fail',
      smeLane: 'SME',
    });
    const r = await validateSubmissionReadiness('app-1', { stage: 'committee' });
    expect(r.errors.some((e) => e.field === 'dscr')).toBe(false);
  });
});