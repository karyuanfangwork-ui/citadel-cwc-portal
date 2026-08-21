import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { BorrowerProfile } from '../../../../services/credit.service';
import BorrowerProfileTab from '../BorrowerProfileTab';

const profile: BorrowerProfile = {
  id: 'borrower-1', borrowerType: 'INDIVIDUAL', name: 'Tan Ah Kau', accountId: null, contactId: null,
  creditRiskRating: 'D', amlRiskTier: 'LOW', exposureLimit: null, totalExposure: null, isSanctionedEntity: false,
  sourceOfWealth: 'Employment income', purposeOfAccount: 'Personal lending', occupation: 'Engineer', employer: 'Example Sdn Bhd',
  annualIncome: 120000, netWorth: 500000, nricPassport: '******1234', registrationNumber: null, industry: null, address: 'Address',
  phone: '+60123456789', email: 'tan@example.com', isActive: true, kycVerifiedAt: '2026-08-01T00:00:00.000Z', deletedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', preferredName: 'Ah Kau', dateOfBirth: '1972-12-01',
  maritalStatus: 'Married', educationLevel: 'Bachelor', taxNumber: 'SG123', preferredContactMethod: 'EMAIL', mailingAddress: 'Mailing address',
};

describe('BorrowerProfileTab', () => {
  it('uses Borrower 360 cards and keeps CRM linking informational when no account exists', () => {
    render(<MemoryRouter><BorrowerProfileTab profile={profile} canWrite onEdit={vi.fn()} onEditIncome={vi.fn()} onOpenRisk={vi.fn()} /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Profile information' })).toBeVisible();
    expect(screen.getByText('Identity & contact')).toBeVisible();
    expect(screen.getByText('KYC & compliance')).toBeVisible();
    expect(screen.getByText('Profile financial information')).toBeVisible();
    expect(screen.getByText(/CRM linking is not available from this profile view/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Link CRM Account' })).not.toBeInTheDocument();
  });
});
