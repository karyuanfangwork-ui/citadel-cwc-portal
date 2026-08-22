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

    expect(screen.getByRole('heading', { name: '1 issue blocking progress' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go to Financials' }));
    expect(onNavigate).toHaveBeenCalledWith('financials', 'financial-profile');
  });

  it('owns the single Next Action presentation alongside server readiness', () => {
    const onNavigate = vi.fn();
    render(<ApplicationReadinessPanel viewModel={baseViewModel()} onNavigate={onNavigate} />);

    expect(screen.getByRole('heading', { name: 'Next Action' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open next action' })).toBeInTheDocument();
  });

  it('does not present a false-ready state when readiness is unavailable', () => {
    render(<ApplicationReadinessPanel viewModel={baseViewModel({ status: 'unavailable', blockers: [], nextAction: undefined, totalCount: 0 })} onNavigate={vi.fn()} onRetry={vi.fn()} />);

    expect(screen.getByText('Submission readiness could not be verified')).toBeInTheDocument();
    expect(screen.queryByText('Ready for submission')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('distinguishes warning-only readiness from blockers', () => {
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
