import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CrmAccountDetail from '../../pages/CrmAccountDetail';

const mockGetAccount = vi.fn();
const mockListCrmUsers = vi.fn();
const mockListAccounts = vi.fn();
const mockListNotes = vi.fn();
const mockUseNextBestAction = vi.fn();
const mockListBorrowerProfiles = vi.fn();

vi.mock('../services/crm.service', () => ({
  default: {
    getAccount: (...args: unknown[]) => mockGetAccount(...args),
    listCrmUsers: (...args: unknown[]) => mockListCrmUsers(...args),
    listAccounts: (...args: unknown[]) => mockListAccounts(...args),
    listNotes: (...args: unknown[]) => mockListNotes(...args),
  },
}));

vi.mock('../services/credit.service', () => ({
  default: {
    listBorrowerProfiles: (...args: unknown[]) => mockListBorrowerProfiles(...args),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'admin@test.local', permissions: ['crm:read', 'crm:write', 'crm:admin'] },
  }),
}));

vi.mock('../hooks/useCrmAi', () => ({
  useNextBestAction: () => mockUseNextBestAction(),
}));

const renderPage = async () => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/crm/accounts/account-1']}>
        <Routes>
          <Route path="/crm/accounts/:id" element={<CrmAccountDetail />} />
        </Routes>
      </MemoryRouter>
    );
  });
};

describe('CrmAccountDetail', () => {
  beforeEach(() => {
    mockUseNextBestAction.mockReturnValue({ fetch: vi.fn(), loading: false, error: null, data: null });
    mockListCrmUsers.mockResolvedValue([]);
    mockListAccounts.mockResolvedValue({ accounts: [] });
    mockListNotes.mockResolvedValue({ notes: [] });
    mockListBorrowerProfiles.mockResolvedValue({ profiles: [], pagination: { total: 0 } });
    mockGetAccount.mockResolvedValue({
      id: 'account-1',
      name: 'ACME Berhad',
      createdAt: '2026-06-14T00:00:00.000Z',
      updatedAt: '2026-06-14T00:00:00.000Z',
      contacts: [],
      opportunities: [],
      activities: [],
      children: [],
      _count: { contacts: 0, opportunities: 0 },
    });
  });

  it('renders breadcrumb header and kinetic overview section naming', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'ACME Berhad' })).toBeInTheDocument();
    });

    expect(screen.getByText('CRM')).toBeInTheDocument();
    expect(screen.getByText('Accounts')).toBeInTheDocument();
    expect(screen.getByText('Account Information')).toBeInTheDocument();
  });
});
