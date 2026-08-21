import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FacilityStep from '../FacilityStep';

const value = { facilityType: 'TERM_LOAN' as const, amount: '', tenorMonths: '', purpose: '' };

describe('FacilityStep', () => {
  it('shows facility fields for SME/CORPORATE-required mode', () => {
    render(<FacilityStep required requestedAmount="100000" requestedTenor="60" value={value} onChange={vi.fn()} />);
    expect(screen.getByTestId('facility-step')).toBeInTheDocument();
    expect(screen.getByLabelText('Facility amount')).toHaveValue(100000);
    expect(screen.getByLabelText('Facility tenor')).toHaveValue(60);
  });

  it('does not require a separate facility for Personal Fast', () => {
    render(<FacilityStep required={false} requestedAmount="50000" requestedTenor="36" value={value} onChange={vi.fn()} />);
    expect(screen.getByText(/no separate facility required/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Facility amount')).not.toBeInTheDocument();
  });
});
