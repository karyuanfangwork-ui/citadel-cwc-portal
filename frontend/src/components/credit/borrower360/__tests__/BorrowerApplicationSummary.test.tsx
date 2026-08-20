import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BorrowerApplicationSummary from '../BorrowerApplicationSummary';

const renderSummary = (applications: any[], onStartApplication?: () => void) =>
  render(
    <MemoryRouter>
      <BorrowerApplicationSummary applications={applications} onStartApplication={onStartApplication} />
    </MemoryRouter>,
  );

describe('BorrowerApplicationSummary', () => {
  it('renders a clear empty state and start action when supplied', () => {
    const onStartApplication = vi.fn();
    renderSummary([], onStartApplication);

    expect(screen.getByRole('heading', { name: 'Applications' })).toBeVisible();
    expect(screen.getByText('No applications yet.')).toBeVisible();
    screen.getByRole('button', { name: /start application/i }).click();
    expect(onStartApplication).toHaveBeenCalledOnce();
  });

  it('renders application details and links to the application workspace', () => {
    renderSummary([{
      id: 'app-1', applicationNo: 'CA-2026-00001', productType: 'TERM_LOAN',
      state: 'UNDERWRITING', requestedAmount: 500000,
      updatedAt: '2026-08-20T00:00:00.000Z',
    }]);

    expect(screen.getByRole('link', { name: 'CA-2026-00001' })).toHaveAttribute('href', '/credit/applications/app-1');
    expect(screen.getByText(/term loan/i)).toBeVisible();
    expect(screen.getByText(/underwriting/i)).toBeVisible();
  });
});
