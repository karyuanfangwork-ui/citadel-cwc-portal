import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CrmAccountDetail from '../../pages/CrmAccountDetail';

const mockGetAccount = vi.fn();
const mockListCrmUsers = vi.fn();
const mockListAccounts = vi.fn();
const mockListNotes = vi.fn();
const mockCreateActivity = vi.fn();
const mockUpdateActivity = vi.fn();
const mockUseNextBestAction = vi.fn();
const mockListBorrowerProfiles = vi.fn();

vi.mock('../services/crm.service', () => ({
  default: {
    getAccount: (...args: unknown[]) => mockGetAccount(...args),
    listCrmUsers: (...args: unknown[]) => mockListCrmUsers(...args),
    listAccounts: (...args: unknown[]) => mockListAccounts(...args),
    listNotes: (...args: unknown[]) => mockListNotes(...args),
    createActivity: (...args: unknown[]) => mockCreateActivity(...args),
    updateActivity: (...args: unknown[]) => mockUpdateActivity(...args),
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

  it('renders account heading and detail layout', async () => {
    await renderPage();

    // The page renders two headings with the account name (h2 in sidebar, h1 in header)
    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: 'ACME Berhad' }).length).toBeGreaterThanOrEqual(1);
    });

    // The account name appears in both the sidebar and header
    expect(screen.getAllByText('ACME Berhad').length).toBeGreaterThanOrEqual(1);
  });

  it('shows call category and outcome when logging a call activity', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Activities' }));
    fireEvent.click(screen.getByRole('button', { name: /log call/i }));

    expect(screen.getByText('Call category')).toBeInTheDocument();
    expect(screen.getByText('Call outcome')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'New call' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Select outcome' })).toBeInTheDocument();
  });
});
