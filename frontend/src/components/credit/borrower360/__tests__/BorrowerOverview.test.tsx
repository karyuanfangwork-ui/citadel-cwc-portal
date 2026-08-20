import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Borrower360Summary, BorrowerProfile } from '../../../../services/credit.service';
import BorrowerOverview from '../BorrowerOverview';

vi.mock('../RetailOverview', () => ({ default: () => <div>Income vs Commitment</div> }));
vi.mock('../CorporateOverview', () => ({ default: () => <div>Business information</div> }));

const profile = (borrowerType: string): BorrowerProfile => ({
  id: 'borrower-1', borrowerType, name: borrowerType === 'CORPORATE' ? 'Acme Sdn Bhd' : 'Ahmad bin Rahman', accountId: null, contactId: null,
  creditRiskRating: null, amlRiskTier: null, exposureLimit: null, totalExposure: null, isSanctionedEntity: false,
  sourceOfWealth: null, purposeOfAccount: null, occupation: null, employer: null, annualIncome: null, netWorth: null,
  annualTurnover: borrowerType === 'CORPORATE' ? 500000 : null, registrationNumber: borrowerType === 'CORPORATE' ? '202001234567' : null,
  nricPassport: borrowerType === 'INDIVIDUAL' ? '******1234' : null, industry: null, address: null, phone: null, email: null,
  isActive: true, kycVerifiedAt: null, deletedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01',
});
const summary: Borrower360Summary = {
  borrowerId: 'borrower-1', borrowerType: 'INDIVIDUAL', borrowerName: 'Ahmad bin Rahman', riskGrade: null, riskRating: null,
  creditScore: null, scoreBand: null, dsrPercent: null, netDsrPercent: null, totalExposure: 0, activeApps: 0, docCompletionPct: 0,
  facilityCount: 0, compliancePass: false, bureau: { source: null, uploadedAt: null, daysOld: null, stale: true }, income: null,
  bureauFacilities: [], alerts: [],
};
const readiness = { status: 'BLOCKED' as const, completionPct: 0, outstandingCount: 1, actions: [{ id: 'kyc', severity: 'BLOCKER' as const, title: 'Verify KYC', description: 'Required', actionLabel: 'Verify KYC', target: 'profile' as const }] };
const props = (borrowerType = 'INDIVIDUAL') => ({ profile: profile(borrowerType), summary, applications: [], readiness, activity: [], canWrite: true, onAction: vi.fn(), onEditIncome: vi.fn(), onViewExposure: vi.fn() });

describe('BorrowerOverview', () => {
  it('does not present unavailable applications as an empty result', () => {
    render(<BorrowerOverview {...props()} applicationsAvailable={false} />);

    expect(screen.queryByText('No applications yet.')).not.toBeInTheDocument();
  });

  it('places readiness and next actions before detailed retail content', () => {
    render(<BorrowerOverview {...props()} />);
    const overview = screen.getByRole('region', { name: 'Borrower overview' });
    expect(overview.textContent?.indexOf('Next actions')).toBeLessThan(overview.textContent?.indexOf('Income vs Commitment') ?? Infinity);
  });

  it('renders corporate business context without retail income editing', () => {
    render(<BorrowerOverview {...props('CORPORATE')} />);
    expect(screen.getByText('Business information')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Edit income/i })).not.toBeInTheDocument();
  });
});
