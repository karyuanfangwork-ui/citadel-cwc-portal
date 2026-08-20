import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BorrowerKpiCards, { type BorrowerKpiData } from '../BorrowerKpiCards';

const globalData: BorrowerKpiData = {
  total: 120,
  active: 95,
  individual: 60,
  sme: 30,
  corporate: 30,
};

describe('BorrowerKpiCards', () => {
  it('renders all KPI cards with values', () => {
    render(<BorrowerKpiCards {...globalData} />);
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('95')).toBeInTheDocument();
  });

  it('labels whether KPI values are global or filtered', () => {
    render(<BorrowerKpiCards {...globalData} scope="global" />);
    // Global scope should show "All borrowers"
    expect(screen.getByText(/all borrowers/i)).toBeInTheDocument();
  });

  it('shows filtered scope when provided', () => {
    render(<BorrowerKpiCards {...globalData} scope="filtered" filteredTotal={42} />);
    // Filtered scope should show "Showing X of Y total borrowers"
    expect(screen.getByText(/showing.*42.*of.*120/i)).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders cards in a responsive grid with region role', () => {
    render(<BorrowerKpiCards {...globalData} scope="global" />);

    expect(screen.getByRole('region', { name: 'Borrower summary' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Borrower summary metrics' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });
});
