import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  getApplicationDraft: vi.fn().mockResolvedValue(null),
  saveApplicationDraft: vi.fn().mockResolvedValue({ id: 'draft-1' }),
  createBorrowerProfile: vi.fn().mockResolvedValue({ id: 'borrower-1', borrowerNumber: 'BRW-000001' }),
  updateBorrowerOnboarding: vi.fn(),
}));

vi.mock('../../services/credit.service', () => ({
  default: mocks,
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { permissions: ['credit:create'] } }),
}));

vi.mock('../../components/credit/create-borrower/ProgressTracker', () => ({
  STEPS: [{}, {}, {}, {}, {}, {}],
  default: ({ onStepClick }: { onStepClick: (step: number) => void }) => (
    <button type="button" onClick={() => onStepClick(5)}>Review borrower</button>
  ),
}));

vi.mock('../../components/credit/create-borrower/TopBar', () => ({ default: () => null }));
vi.mock('../../components/credit/create-borrower/DuplicateCheckStep', () => ({ default: () => null }));
vi.mock('../../components/credit/create-borrower/BorrowerTypeStep', () => ({ default: () => null }));
vi.mock('../../components/credit/create-borrower/BasicInfoStep', () => ({
  initialFormData: () => ({
    borrowerType: 'CORPORATE', name: '', ssm: '', nric: '', dateOfBirth: '', dateOfIncorporation: '', businessNature: '',
    industrySector: '', estimatedAnnualRevenue: '', accountId: null, contactId: null, originatorNotes: '', businessType: '',
    authorizedRepresentative: '', preferredName: '', maritalStatus: '', educationLevel: '', taxNumber: '', gender: '',
    nationality: 'Malaysian', phone: '', officePhone: '', email: '', preferredContactMethod: '', addressLine1: '',
    addressLine2: '', postcode: '', city: '', state: '', mailingAddress: '', employmentType: '', employerName: '',
    monthlyGrossIncome: '', fixedAllowances: '', existingCommitments: '', requestedInstallment: '', kycVerified: false,
    amlResult: 'not_started', amlNotes: '', documents: [],
  }),
  default: () => null,
}));
vi.mock('../../components/credit/create-borrower/ContactInfoStep', () => ({ default: () => null }));
vi.mock('../../components/credit/create-borrower/EmploymentFinancialsStep', () => ({ default: () => null }));
vi.mock('../../components/credit/create-borrower/ComplianceChecksStep', () => ({ default: () => null }));
vi.mock('../../components/credit/create-borrower/DocumentUploadStep', () => ({ default: () => null }));
vi.mock('../../components/credit/create-borrower/ReviewStep', () => ({
  default: ({ onSubmit }: { onSubmit: () => void }) => <button type="button" onClick={onSubmit}>Create borrower</button>,
}));
vi.mock('../../components/credit/create-borrower/CreateBorrowerActionPanel', () => ({ default: () => null }));
vi.mock('../../components/credit/create-borrower/DuplicateConflictModal', () => ({ default: () => null }));

import CreateBorrowerPage from '../../../pages/CreateBorrowerPage';

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
};

describe('CreateBorrowerPage onboarding persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('createBorrowerOnboardingKey', 'run-1');
    vi.clearAllMocks();
    mocks.getApplicationDraft.mockResolvedValue(null);
    mocks.saveApplicationDraft.mockResolvedValue({ id: 'draft-1' });
    mocks.createBorrowerProfile.mockResolvedValue({ id: 'borrower-1', borrowerNumber: 'BRW-000001' });
  });

  afterEach(() => localStorage.clear());

  it('retains stages and provides a retry when onboarding persistence fails after creation', async () => {
    mocks.updateBorrowerOnboarding.mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValueOnce({
      borrowerId: 'borrower-1',
      borrowerNumber: 'BRW-000001',
      status: 'COMPLETED',
      stages: [{ name: 'PROFILE', status: 'COMPLETED' }],
    });

    render(
      <MemoryRouter initialEntries={['/credit/borrowers/new']}>
        <CreateBorrowerPage />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Review borrower' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create borrower' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Borrower was created, but onboarding status could not be saved');
    expect(screen.getByText('PROFILE: COMPLETED')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry saving onboarding' }));

    await waitFor(() => {
      expect(mocks.updateBorrowerOnboarding).toHaveBeenLastCalledWith(
        'borrower-1',
        'run-1',
        expect.arrayContaining([{ name: 'PROFILE', status: 'COMPLETED' }]),
      );
      expect(screen.getByTestId('location')).toHaveTextContent('/credit/borrowers/borrower-1');
    });
  });
});
