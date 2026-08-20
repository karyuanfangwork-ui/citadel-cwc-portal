import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReviewStep, { GovernedIdentityStatus } from '../ReviewStep';
import { FormData, initialFormData } from '../BasicInfoStep';

function validIndividual(overrides: Partial<FormData> = {}): FormData {
  return {
    ...initialFormData(),
    borrowerType: 'INDIVIDUAL',
    name: 'Aisha Rahman',
    nric: '900101-14-1234',
    dateOfBirth: '1990-01-01',
    nationality: 'Malaysian',
    phone: '0123456789',
    ...overrides,
  };
}

function renderReview(formData: FormData, options: {
  canSubmit?: boolean;
  governedIdentityStatus?: GovernedIdentityStatus;
  onEditStep?: (step: number) => void;
} = {}) {
  return render(
    <ReviewStep
      formData={formData}
      governedIdentityStatus={options.governedIdentityStatus ?? 'clear'}
      onSubmit={() => undefined}
      onSaveDraft={() => undefined}
      saving={false}
      canSubmit={options.canSubmit ?? true}
      onEditStep={options.onEditStep}
    />,
  );
}

describe('ReviewStep creation readiness', () => {
  it('allows creation and puts incomplete KYC, AML, and documents under complete later work', () => {
    renderReview(validIndividual());

    expect(screen.getByRole('button', { name: /Create Borrower Record/ })).toBeEnabled();
    expect(screen.queryByText('Complete these items before creating the borrower')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Complete later' })).toBeInTheDocument();
    expect(screen.getByText('Compliance: KYC and AML not completed')).toBeInTheDocument();
    expect(screen.getByText('Documents: No documents uploaded yet')).toBeInTheDocument();
  });

  it('blocks creation for missing legal identity and primary contact fields', () => {
    renderReview(validIndividual({
      name: '',
      nric: '',
      dateOfBirth: '',
      nationality: '',
      phone: '',
      email: '',
    }), { canSubmit: false });

    expect(screen.getByRole('button', { name: /Create Borrower Record/ })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Legal identity: Missing: Full Name, NRIC/Passport, Date of Birth, Nationality');
    expect(screen.getByRole('alert')).toHaveTextContent('Primary contact: Missing: Phone or email');
    expect(screen.queryByRole('alert')).not.toHaveTextContent('Compliance');
    expect(screen.queryByRole('alert')).not.toHaveTextContent('Documents');
  });

  it('blocks a legacy duplicate-clear state until a governed identity check completes', () => {
    renderReview(validIndividual(), {
      canSubmit: false,
      governedIdentityStatus: 'not_started',
    });

    expect(screen.getByRole('button', { name: /Create Borrower Record/ })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Governed identity check: Complete the governed identity check before creating.');
    expect(screen.queryByText('No duplicates found')).not.toBeInTheDocument();
  });

  it('keeps a failed governed identity check as a creation blocker', () => {
    renderReview(validIndividual(), {
      canSubmit: false,
      governedIdentityStatus: 'failed',
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Governed identity check: Identity check failed. Run it again before creating.');
  });

  it('describes prohibited AML as escalation follow-up without blocking creation', () => {
    renderReview(validIndividual({ amlResult: 'prohibited' }));

    expect(screen.getByRole('button', { name: /Create Borrower Record/ })).toBeEnabled();
    expect(screen.getByText('Compliance: AML screening prohibited — escalate for compliance review before any credit activity.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('edits the matching wizard step from each review area', () => {
    const onEditStep = vi.fn();
    renderReview(validIndividual(), { onEditStep });

    fireEvent.click(screen.getByRole('button', { name: 'Edit identity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit contact' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit compliance' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit documents' }));

    expect(onEditStep).toHaveBeenNthCalledWith(1, 1);
    expect(onEditStep).toHaveBeenNthCalledWith(2, 2);
    expect(onEditStep).toHaveBeenNthCalledWith(3, 4);
    expect(onEditStep).toHaveBeenNthCalledWith(4, 4);
  });
});
