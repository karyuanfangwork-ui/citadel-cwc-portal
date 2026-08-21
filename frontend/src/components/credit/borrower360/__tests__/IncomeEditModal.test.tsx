import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import IncomeEditModal from '../IncomeEditModal';

const { updateBorrowerIncome } = vi.hoisted(() => ({
  updateBorrowerIncome: vi.fn().mockResolvedValue({ dsrPercent: 42, netDsrPercent: 48 }),
}));

vi.mock('../../../../services/credit.service', () => ({
  default: { updateBorrowerIncome },
}));

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const income = {
  employmentType: 'SALARIED',
  employerName: 'Citadel Group',
  monthlyGrossIncome: 10000,
  epfMonthlyAmount: 1100,
  monthlyTaxDeduction: 500,
  monthlySocsoDeduction: 20,
  hirePurchaseCommitment: 1200,
  creditCardCommitment: 300,
  existingLoanCommitment: 800,
  otherCommitments: 100,
};

describe('IncomeEditModal', () => {
  it('hydrates existing income and keeps the advanced section collapsed', () => {
    render(<IncomeEditModal borrowerId="borrower-1" income={income} open onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Edit income profile' })).toBeVisible();
    expect(screen.getByDisplayValue('Citadel Group')).toBeVisible();
    expect(screen.getByDisplayValue('10000')).toBeVisible();
    expect(screen.queryByText('Credit Profile')).not.toBeInTheDocument();
    expect(screen.getByText('Deductions & commitments').closest('details')).not.toHaveAttribute('open');
  });

  it('saves only income data and preserves the existing values in the payload', async () => {
    render(<IncomeEditModal borrowerId="borrower-1" income={income} open onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(updateBorrowerIncome).toHaveBeenCalledWith('borrower-1', income));
  });
});