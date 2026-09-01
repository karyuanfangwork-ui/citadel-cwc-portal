import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ApplicationReadinessPanel from '../ApplicationReadinessPanel';
import { ApplicationReadinessViewModel } from '../applicationReadinessViewModel';

const baseViewModel = (overrides: Partial<ApplicationReadinessViewModel> = {}): ApplicationReadinessViewModel => ({
  stage: 'submission',
  status: 'blocked',
  completedCount: 0,
  totalCount: 1,
  blockers: [{
    id: 'blocker-retailIncome-0',
    severity: 'blocker',
    title: 'Complete Retail Income / DSR',
    description: 'Retail income and DSR assessment is required before submission',
    targetArea: 'financials',
    targetLocalTab: 'financial-profile',
    sourceField: 'retailIncome',
  }],
  warnings: [],
  satisfied: [],
  nextAction: {
    title: 'Complete Retail Income / DSR',
    label: 'Go to Financials',
    targetArea: 'financials',
    targetTab: 'financial-profile',
  },
  ...overrides,
});

describe('ApplicationReadinessPanel', () => {
  it('renders a blocker and navigates using six-area vocabulary', () => {
    const onNavigate = vi.fn();
    render(<ApplicationReadinessPanel viewModel={baseViewModel()} onNavigate={onNavigate} />);

    expect(screen.getByRole('heading', { name: '1 item is preventing submission' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open next item' }));
    expect(onNavigate).toHaveBeenCalledWith('financials', 'financial-profile');
  });

  it('does not duplicate the next blocker as a second full action card', () => {
    const onNavigate = vi.fn();
    render(<ApplicationReadinessPanel viewModel={baseViewModel()} onNavigate={onNavigate} />);

    expect(screen.getByRole('button', { name: 'Open next item' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Next Action' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Complete Retail Income / DSR')).toHaveLength(1);
  });

  it('does not present a false-ready state when readiness is unavailable', () => {
    render(<ApplicationReadinessPanel viewModel={baseViewModel({ status: 'unavailable', blockers: [], nextAction: undefined, totalCount: 0 })} onNavigate={vi.fn()} onRetry={vi.fn()} />);

    expect(screen.getByText('Submission readiness could not be verified')).toBeInTheDocument();
    expect(screen.queryByText('Ready for submission')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('shows exactly one submission CTA when ready', () => {
    const onSubmit = vi.fn();
    render(<ApplicationReadinessPanel viewModel={baseViewModel({
      status: 'ready',
      blockers: [],
      warnings: [],
      nextAction: undefined,
      satisfied: [{ id: 'complete-1', severity: 'complete', title: 'Borrower profile complete' }],
      completedCount: 1,
      totalCount: 1,
    })} onNavigate={vi.fn()} onSubmit={onSubmit} />);

    expect(screen.getAllByRole('button', { name: 'Submit Application' })).toHaveLength(1);
    expect(screen.queryByText('Borrower profile complete')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Submit Application' }));
    expect(onSubmit).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Show completed checks (1)' }));
    expect(screen.getByText('Borrower profile complete')).toBeInTheDocument();
  });

  it('keeps warnings visible without presenting a blocker heading', () => {
    render(<ApplicationReadinessPanel viewModel={baseViewModel({
      status: 'warning',
      blockers: [],
      warnings: [{ id: 'warning-fatca-0', severity: 'warning', title: 'Complete FATCA/CRS Declaration', description: 'Declaration is pending', targetArea: 'risk-compliance', targetLocalTab: 'credit-checks-risk' }],
      nextAction: undefined,
      completedCount: 2,
      totalCount: 3,
    })} onNavigate={vi.fn()} />);

    expect(screen.getByText('Ready with warnings')).toBeInTheDocument();
    expect(screen.getByText('Warnings')).toBeInTheDocument();
    expect(screen.queryByText('blocking progress')).not.toBeInTheDocument();
  });
});
