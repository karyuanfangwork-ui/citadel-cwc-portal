import { describe, expect, it } from 'vitest';
import type { Borrower360Summary, BorrowerProfile, CreditApplication } from '../../../../services/credit.service';
import { calculateBorrowerReadiness, getPrimaryApplicationAction } from '../borrowerReadiness';

const individualProfile = (overrides: Partial<BorrowerProfile> = {}): BorrowerProfile => ({
  id: 'borrower-1', borrowerType: 'INDIVIDUAL', name: 'Ahmad bin Rahman', accountId: null, contactId: null,
  creditRiskRating: null, amlRiskTier: null, exposureLimit: null, totalExposure: null, isSanctionedEntity: false,
  sourceOfWealth: null, purposeOfAccount: null, occupation: 'Engineer', employer: 'Acme', annualIncome: 120000,
  netWorth: null, registrationNumber: null, industry: null, nricPassport: '900101-01-1234', nationality: 'Malaysian', address: null,
  phone: '+60123456789', email: null, dateOfBirth: '1990-01-01', isActive: true, kycVerifiedAt: null, deletedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...overrides,
});

const summary = (overrides: Partial<Borrower360Summary> = {}): Borrower360Summary => ({
  borrowerId: 'borrower-1', borrowerType: 'INDIVIDUAL', borrowerName: 'Ahmad bin Rahman', riskGrade: null,
  riskRating: null, creditScore: null, scoreBand: null, dsrPercent: null, netDsrPercent: null, totalExposure: 0,
  activeApps: 0, docCompletionPct: 100, facilityCount: 0, compliancePass: true,
  bureau: { source: 'CTOS', uploadedAt: '2026-08-01T00:00:00.000Z', daysOld: 18, stale: false },
  income: { gross: 10000, commitments: 1000, netIncome: 9000, details: {
    employmentType: 'SALARIED', employerName: 'Acme', monthlyGrossIncome: 10000, epfMonthlyAmount: 1100,
    monthlyTaxDeduction: 500, monthlySocsoDeduction: 20, hirePurchaseCommitment: 500, creditCardCommitment: 300,
    existingLoanCommitment: 200, otherCommitments: 0,
  } }, bureauFacilities: [], alerts: [], ...overrides,
});

const application = (overrides: Partial<CreditApplication> = {}): CreditApplication => ({
  id: 'app-1', applicationNo: 'APP-001', borrowerProfileId: 'borrower-1', productType: 'TERM_LOAN',
  requestedAmount: 100000, requestedTenor: 60, currency: 'MYR', purpose: null, state: 'SUBMITTED', riskRating: null,
  rmId: null, analystId: null, submittedAt: null, decisionedAt: null, rejectionReason: null, withdrawalReason: null,
  closedAt: null, withdrawnAt: null, deletedAt: null, createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z', version: 1, ...overrides,
});

it('blocks a borrower with missing KYC, income, and stale bureau data', () => {
  const result = calculateBorrowerReadiness({ profile: individualProfile({ kycVerifiedAt: null }), summary: summary({ income: null, bureau: { source: 'CTOS', uploadedAt: '2026-07-01T00:00:00.000Z', daysOld: 120, stale: true } }), applications: [] });
  expect(result.status).toBe('BLOCKED');
  expect(result.actions.map(action => action.id)).toEqual(expect.arrayContaining(['kyc', 'income', 'bureau']));
});

it('returns warning when only a stale bureau report remains', () => {
  const result = calculateBorrowerReadiness({ profile: individualProfile({ kycVerifiedAt: '2026-07-10T00:00:00.000Z' }), summary: summary({ bureau: { source: 'CTOS', uploadedAt: '2026-07-01T00:00:00.000Z', daysOld: 120, stale: true } }), applications: [] });
  expect(result.status).toBe('WARNING');
  expect(result.outstandingCount).toBe(1);
});

it('returns ready when required borrower information is present', () => {
  const result = calculateBorrowerReadiness({ profile: individualProfile({ kycVerifiedAt: '2026-07-10T00:00:00.000Z', creditRiskRating: 'A' }), summary: summary({ riskRating: { effective: 'A', base: 'A', calculatedAt: '2026-08-01T00:00:00.000Z', version: 1, reasonCodes: [], missingInputs: [], bureauCapsApplied: [] } }), applications: [] });
  expect(result.status).toBe('READY');
  expect(result.completionPct).toBe(100);
  expect(result.actions).toEqual([]);
});

it('requires financial information for corporate borrowers', () => {
  const profile = individualProfile({ borrowerType: 'CORPORATE', name: 'Acme Sdn Bhd', nricPassport: null, dateOfBirth: null, nationality: null, registrationNumber: '202001234567', dateOfIncorporation: '2020-01-01', businessNature: 'Technology', kycVerifiedAt: '2026-07-10T00:00:00.000Z' });
  const result = calculateBorrowerReadiness({ profile, summary: summary({ borrowerType: 'CORPORATE', income: null }), applications: [] });
  expect(result.actions.some(action => action.id === 'financials')).toBe(true);
});

it('blocks an Individual with missing DOB, nationality, and contact', () => {
  const profile = individualProfile({ dateOfBirth: null, nationality: null, phone: null, email: null });
  const result = calculateBorrowerReadiness({ profile, summary: summary(), applications: [] });
  const ids = result.actions.map((item) => item.id);
  expect(result.status).toBe('BLOCKED');
  expect(ids).toEqual(expect.arrayContaining(['identity_dob', 'identity_nationality', 'contact']));
});

it('blocks a business borrower with missing legal identity fields', () => {
  const profile = individualProfile({ borrowerType: 'CORPORATE', nricPassport: null, dateOfBirth: null, nationality: null, registrationNumber: null, dateOfIncorporation: null, businessNature: null, annualTurnover: 0 });
  const result = calculateBorrowerReadiness({ profile, summary: null, applications: [] });
  const ids = result.actions.map((item) => item.id);
  expect(result.status).toBe('BLOCKED');
  expect(ids).toEqual(expect.arrayContaining(['business_registration', 'business_incorporation', 'business_nature']));
});

it('selects the draft application before an active application', () => {
  expect(getPrimaryApplicationAction([application({ id: 'active-1', state: 'ACTIVE' }), application({ id: 'draft-1', state: 'DRAFT' })])).toEqual({
    label: 'Continue application', applicationId: 'draft-1',
  });
});
