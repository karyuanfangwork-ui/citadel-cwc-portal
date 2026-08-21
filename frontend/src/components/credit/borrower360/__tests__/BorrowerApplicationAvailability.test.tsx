import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Borrower360Summary, BorrowerProfile } from '../../../../services/credit.service';
import BorrowerWorkspaceHeader from '../BorrowerWorkspaceHeader';

const profile: BorrowerProfile = {
  id: 'borrower-1', borrowerType: 'INDIVIDUAL', name: 'Ahmad bin Rahman', accountId: null, contactId: null,
  creditRiskRating: null, amlRiskTier: null, exposureLimit: null, totalExposure: null, isSanctionedEntity: false,
  sourceOfWealth: null, purposeOfAccount: null, occupation: null, employer: null, annualIncome: null, netWorth: null,
  annualTurnover: null, registrationNumber: null, nricPassport: '******1234', industry: null, address: null, phone: null, email: null,
  isActive: true, kycVerifiedAt: null, deletedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01',
};

const summary: Borrower360Summary = {
  borrowerId: 'borrower-1', borrowerType: 'INDIVIDUAL', borrowerName: 'Ahmad bin Rahman', riskGrade: null, riskRating: null,
  creditScore: null, scoreBand: null, dsrPercent: null, netDsrPercent: null, totalExposure: 0, activeApps: 0,
  docCompletionPct: 0, facilityCount: 0, compliancePass: false, bureau: { source: null, uploadedAt: null, daysOld: null, stale: true },
  income: null, bureauFacilities: [], alerts: [],
};

describe('BorrowerWorkspaceHeader application availability', () => {
  it('suppresses the primary application action when application data is unavailable', () => {
    const unavailableProps: React.ComponentProps<typeof BorrowerWorkspaceHeader> = {
      profile,
      summary,
      primaryAction: { label: 'Start application', applicationId: null },
      canWrite: false,
      canCreate: true,
      onPrimaryAction: () => undefined,
      onEdit: () => undefined,
      onRecalculateRisk: () => undefined,
      applicationsAvailable: false,
    };

    render(<MemoryRouter><BorrowerWorkspaceHeader {...unavailableProps} /></MemoryRouter>);

    expect(screen.queryByRole('button', { name: 'Start application' })).not.toBeInTheDocument();
  });
});
