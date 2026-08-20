import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { CreditApplication } from '../../../../services/credit.service';
import BorrowerNextActions from '../BorrowerNextActions';
import BorrowerApplicationSummary from '../BorrowerApplicationSummary';

const application = (overrides: Partial<CreditApplication> = {}): CreditApplication => ({
  id: 'draft-1', applicationNo: 'APP-001', borrowerProfileId: 'borrower-1', productType: 'TERM_LOAN', requestedAmount: 100000,
  requestedTenor: 60, currency: 'MYR', purpose: null, state: 'DRAFT', riskRating: null, rmId: null, analystId: null,
  submittedAt: null, decisionedAt: null, rejectionReason: null, withdrawalReason: null, closedAt: null, withdrawnAt: null,
  deletedAt: null, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', version: 1, ...overrides,
});

describe('BorrowerNextActions', () => {
  it('renders blockers before warnings and invokes the selected action', () => {
    const onAction = vi.fn();
    const warning = { id: 'bureau', severity: 'WARNING' as const, title: 'Refresh bureau', description: 'Stale', actionLabel: 'Upload bureau report', target: 'bureau' as const };
    const blocker = { id: 'kyc', severity: 'BLOCKER' as const, title: 'Verify KYC', description: 'Required', actionLabel: 'Verify KYC', target: 'profile' as const };
    render(<BorrowerNextActions actions={[warning, blocker]} onAction={onAction} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveAccessibleName('Verify KYC');
    fireEvent.click(buttons[0]);
    expect(onAction).toHaveBeenCalledWith(blocker);
  });
});

describe('BorrowerApplicationSummary', () => {
  it('links an application to its existing detail route', () => {
    render(<MemoryRouter><BorrowerApplicationSummary applications={[application()]} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'APP-001' })).toHaveAttribute('href', '/credit/applications/draft-1');
  });

  it('renders a useful empty state', () => {
    render(<MemoryRouter><BorrowerApplicationSummary applications={[]} /></MemoryRouter>);
    expect(screen.getByText(/No applications yet/i)).toBeVisible();
  });
});
