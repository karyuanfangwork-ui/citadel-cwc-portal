import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Borrower360Summary, BorrowerProfile } from '../../../../services/credit.service';
import BorrowerWorkspaceHeader from '../BorrowerWorkspaceHeader';
import BorrowerReadinessStrip from '../BorrowerReadinessStrip';

const profile: BorrowerProfile = {
  id: 'borrower-1', borrowerType: 'INDIVIDUAL', name: 'Ahmad bin Rahman', accountId: null, contactId: null,
  creditRiskRating: 'A', amlRiskTier: null, exposureLimit: null, totalExposure: null, isSanctionedEntity: false,
  sourceOfWealth: null, purposeOfAccount: null, occupation: null, employer: null, annualIncome: null, netWorth: null,
  nricPassport: '******1234', registrationNumber: null, industry: null, address: null, phone: null, email: null,
  isActive: true, kycVerifiedAt: '2026-08-01T00:00:00.000Z', deletedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01',
};
const summary: Borrower360Summary = {
  borrowerId: 'borrower-1', borrowerType: 'INDIVIDUAL', borrowerName: 'Ahmad bin Rahman', riskGrade: 'A', riskRating: null,
  creditScore: null, scoreBand: null, dsrPercent: null, netDsrPercent: null, totalExposure: 0, activeApps: 0,
  docCompletionPct: 100, facilityCount: 0, compliancePass: true, bureau: { source: 'CTOS', uploadedAt: null, daysOld: 1, stale: false },
  income: null, bureauFacilities: [], alerts: [],
};

const renderHeader = (overrides: Partial<React.ComponentProps<typeof BorrowerWorkspaceHeader>> = {}) => render(
  <MemoryRouter><BorrowerWorkspaceHeader profile={profile} summary={summary} primaryAction={{ label: 'Continue application', applicationId: 'app-1' }} canWrite canCreate onPrimaryAction={vi.fn()} onEdit={vi.fn()} onUploadBureau={vi.fn()} onRunKyc={vi.fn()} onRecalculateRisk={vi.fn()} {...overrides} /></MemoryRouter>,
);

describe('BorrowerWorkspaceHeader', () => {
  it('shows borrower identity and the primary application action', () => {
    renderHeader();
    expect(screen.getByRole('heading', { name: 'Ahmad bin Rahman' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continue application' })).toBeVisible();
  });

  it('hides write actions for read-only users', () => {
    renderHeader({ canWrite: false, canCreate: false });
    expect(screen.queryByRole('button', { name: 'Edit borrower' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Verify KYC' })).not.toBeInTheDocument();
  });
});

describe('BorrowerReadinessStrip', () => {
  it('renders readiness status, count, and action label', () => {
    const onAction = vi.fn();
    render(<BorrowerReadinessStrip readiness={{ status: 'BLOCKED', completionPct: 40, outstandingCount: 3, actions: [{ id: 'bureau', severity: 'WARNING', title: 'Refresh bureau', description: 'Report is stale.', actionLabel: 'Upload bureau report', target: 'bureau' }] }} onAction={onAction} />);
    expect(screen.getByText('Not ready')).toBeVisible();
    expect(screen.getByText(/3 items need attention/i)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Upload bureau report' }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'bureau' }));
  });
});
