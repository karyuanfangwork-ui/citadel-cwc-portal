import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CrmAccounts from '../../pages/CrmAccounts';

const mockListAccounts = vi.fn();
const mockListCrmUsers = vi.fn();

vi.mock('../services/crm.service', () => ({
  default: {
    listAccounts: (...args: unknown[]) => mockListAccounts(...args),
    listCrmUsers: (...args: unknown[]) => mockListCrmUsers(...args),
    updateAccount: vi.fn(),
    deleteAccount: vi.fn(),
    createAccount: vi.fn(),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'admin@test.local',
      permissions: ['crm:read', 'crm:write', 'crm:delete', 'crm:admin'],
    },
  }),
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/crm/accounts']}>
      <CrmAccounts />
    </MemoryRouter>
  );

describe('CrmAccounts', () => {
  beforeEach(() => {
    mockListCrmUsers.mockResolvedValue([]);
    mockListAccounts.mockResolvedValue({
      accounts: [
        {
          id: 'account-1',
          name: 'ACME Berhad',
          createdAt: '2026-06-14T00:00:00.000Z',
          _count: { contacts: 1, opportunities: 2 },
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('renders the kinetic list-page header grammar', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /accounts/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /new account/i })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search accounts/i)).toBeInTheDocument();
  });
});
