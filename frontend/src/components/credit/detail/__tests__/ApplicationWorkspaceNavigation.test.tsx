import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ApplicationWorkspaceNavigation from '../ApplicationWorkspaceNavigation';

describe('ApplicationWorkspaceNavigation', () => {
  it('renders one six-area primary navigation and separate utilities', () => {
    render(
      <ApplicationWorkspaceNavigation
        activeArea="overview"
        activeTab="overview"
        onAreaChange={vi.fn()}
        onTabChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Application workspace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Application & Parties' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Financials' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Risk & Compliance' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assessment & Recommendation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decision & Completion' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Documents' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activity & Audit' })).toBeInTheDocument();
    expect(screen.queryByText('S1')).not.toBeInTheDocument();
    expect(screen.queryByText('S7')).not.toBeInTheDocument();
  });

  it('renders local tabs for the selected area and reports their existing URL tab', () => {
    const onTabChange = vi.fn();
    render(
      <ApplicationWorkspaceNavigation
        activeArea="application-parties"
        activeTab="application-details"
        onAreaChange={vi.fn()}
        onTabChange={onTabChange}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Application' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Facilities' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Borrower' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Related Parties' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Facilities' }));
    expect(onTabChange).toHaveBeenCalledWith('facilities');
  });

  it('renders the canonical Financials and Risk & Compliance local vocabulary', () => {
    const { rerender } = render(
      <ApplicationWorkspaceNavigation
        activeArea="financials"
        activeTab="financial-profile"
        onAreaChange={vi.fn()}
        onTabChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole('tab', { name: 'Income' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Statements' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Spreading' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Ratios & Trends' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Repayment Capacity' })).toBeInTheDocument();

    rerender(
      <ApplicationWorkspaceNavigation
        activeArea="risk-compliance"
        activeTab="credit-bureau"
        onAreaChange={vi.fn()}
        onTabChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Bureau & KYC' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Risk Rating' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Collateral & Guarantees' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Compliance / Exceptions' })).toBeInTheDocument();
  });

  it('marks a canonical local ID as selected', () => {
    render(
      <ApplicationWorkspaceNavigation
        activeArea="financials"
        activeTab="income"
        onAreaChange={vi.fn()}
        onTabChange={vi.fn()}
        borrowerType="INDIVIDUAL"
        lane="PERSONAL_FAST"
      />,
    );
    expect(screen.getByRole('tab', { name: 'Income' })).toHaveAttribute('aria-selected', 'true');
  });
});
