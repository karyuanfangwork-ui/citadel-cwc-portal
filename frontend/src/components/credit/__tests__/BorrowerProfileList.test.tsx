import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  listBorrowers: vi.fn(),
  getOperationalBorrowerStats: vi.fn(),
  user: { permissions: ['credit:read', 'credit:create'] as string[] },
}));
vi.mock('../../../services/credit.service', () => ({
  default: mocks,
}));
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

import BorrowerProfileList from '../../../../pages/BorrowerProfileList';

const borrower = {
  id: 'borrower-1', borrowerNumber: 'BRW-000001', name: 'Ahmad Enterprise', segment: 'SME', legalType: 'CORPORATE', maskedIdentifier: '******-10-1234', primaryContact: 'a***@example.test', relationshipOwner: { id: 'rm-1', name: 'Relationship Manager' }, activeApplicationCount: 2, totalExposure: 45000, status: 'ACTIVE', dataQuality: 'COMPLETE' as const, missingFields: [] as string[], updatedAt: '2026-08-11T00:00:00.000Z',
};

const LocationProbe = () => <output data-testid="location">{useLocation().search}</output>;

beforeEach(() => {
  mocks.user.permissions = ['credit:read', 'credit:create'];
  mocks.listBorrowers.mockResolvedValue({ items: [borrower], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }, appliedSort: { field: 'updatedAt', direction: 'desc' } });
  mocks.getOperationalBorrowerStats.mockResolvedValue({ total: 1, active: 1, individual: 0, sme: 1, corporate: 0 });
});

describe('BorrowerProfileList', () => {
  it('renders the operational borrower summary and masked row data', async () => {
    render(<MemoryRouter initialEntries={['/credit/borrowers?q=Ahmad&segment=SME']}><BorrowerProfileList /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Borrower Management' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Borrower/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Ahmad Enterprise')).toBeInTheDocument());
    expect(screen.getByText('******-10-1234')).toBeInTheDocument();
    expect(screen.getByText('a***@example.test')).toBeInTheDocument();
    expect(screen.queryByText('ahmad@example.test')).not.toBeInTheDocument();
    expect(screen.getByText(/45,000/)).toBeInTheDocument();
    expect(screen.getByText('Relationship Manager')).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('Ahmad');
    expect(mocks.listBorrowers).toHaveBeenCalledWith(expect.objectContaining({ search: 'Ahmad', segment: 'SME' }), expect.any(AbortSignal));
  });

  it('keeps active application count as an accessible navigation action', async () => {
    render(<MemoryRouter><BorrowerProfileList /><LocationProbe /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Ahmad Enterprise')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /2 active applications/i }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('borrowerId=borrower-1'));
    expect(screen.getByTestId('location')).toHaveTextContent('status=active');
  });

  it('preserves URL sort state in the operational request and updates it from the table', async () => {
    render(<MemoryRouter initialEntries={['/credit/borrowers?sort=totalExposure&direction=asc']}><BorrowerProfileList /><LocationProbe /></MemoryRouter>);
    await waitFor(() => expect(mocks.listBorrowers).toHaveBeenCalledWith(expect.objectContaining({ sortBy: 'totalExposure', sortDirection: 'asc' }), expect.any(AbortSignal)));
    fireEvent.click(screen.getByRole('button', { name: /sort by total exposure/i }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('sort=totalExposure'));
    expect(screen.getByTestId('location')).toHaveTextContent('direction=desc');
  });

  it('hides Create Borrower for read-only users', async () => {
    mocks.user.permissions = ['credit:read'];
    render(<MemoryRouter><BorrowerProfileList /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /Create Borrower/ })).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.listBorrowers).toHaveBeenCalled());
  });
});
