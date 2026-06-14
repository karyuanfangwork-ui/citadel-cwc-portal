import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CrmContacts from '../../pages/CrmContacts';

const mockListContacts = vi.fn();
const mockListAccounts = vi.fn();
const mockListCrmUsers = vi.fn();

vi.mock('../services/crm.service', () => ({
  default: {
    listContacts: (...args: unknown[]) => mockListContacts(...args),
    listAccounts: (...args: unknown[]) => mockListAccounts(...args),
    listCrmUsers: (...args: unknown[]) => mockListCrmUsers(...args),
    updateContact: vi.fn(),
    deleteContact: vi.fn(),
    createContact: vi.fn(),
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
    <MemoryRouter initialEntries={['/crm/contacts']}>
      <CrmContacts />
    </MemoryRouter>
  );

describe('CrmContacts', () => {
  beforeEach(() => {
    mockListCrmUsers.mockResolvedValue([]);
    mockListAccounts.mockResolvedValue({ accounts: [] });
    mockListContacts.mockResolvedValue({
      contacts: [
        {
          id: 'contact-1',
          firstName: 'Aisha',
          lastName: 'Rahman',
          email: 'aisha@acme.test',
          createdAt: '2026-06-14T00:00:00.000Z',
          isPrimary: true,
          account: { id: 'account-1', name: 'ACME Berhad' },
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('renders the kinetic list-page header grammar', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /contacts/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /create contact/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /new contact/i })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search contacts/i)).toBeInTheDocument();
  });
});
