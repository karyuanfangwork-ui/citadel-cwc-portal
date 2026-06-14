import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CrmContactDetail from '../../pages/CrmContactDetail';

const mockGetContact = vi.fn();
const mockUseNextBestAction = vi.fn();
const mockUseDraftMessage = vi.fn();
const mockUseKycGaps = vi.fn();
const mockUseRiskProfile = vi.fn();

vi.mock('../services/crm.service', () => ({
  default: {
    getContact: (...args: unknown[]) => mockGetContact(...args),
    getContactAccountRoles: vi.fn().mockResolvedValue([]),
    listNotes: vi.fn().mockResolvedValue({ notes: [] }),
    listActivities: vi.fn().mockResolvedValue({ activities: [] }),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'admin@test.local', permissions: ['crm:read', 'crm:write', 'crm:admin'] },
  }),
}));

vi.mock('../hooks/useCrmAi', () => ({
  useNextBestAction: () => mockUseNextBestAction(),
  useDraftMessage: () => mockUseDraftMessage(),
  useKycGaps: () => mockUseKycGaps(),
  useRiskProfile: () => mockUseRiskProfile(),
}));

const renderPage = async () => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/crm/contacts/contact-1']}>
        <Routes>
          <Route path="/crm/contacts/:id" element={<CrmContactDetail />} />
        </Routes>
      </MemoryRouter>
    );
  });
};

describe('CrmContactDetail', () => {
  beforeEach(() => {
    mockUseNextBestAction.mockReturnValue({ fetch: vi.fn(), loading: false, error: null, data: null });
    mockUseDraftMessage.mockReturnValue({ draftForContact: vi.fn(), loading: false, error: null, content: null });
    mockUseKycGaps.mockReturnValue({ fetch: vi.fn(), loading: false, error: null, data: null });
    mockUseRiskProfile.mockReturnValue({ fetch: vi.fn(), loading: false, error: null, data: null });
    mockGetContact.mockResolvedValue({
      id: 'contact-1',
      firstName: 'Aisha',
      lastName: 'Rahman',
      createdAt: '2026-06-14T00:00:00.000Z',
      account: { id: 'account-1', name: 'ACME Berhad' },
      activities: [],
    });
  });

  it('renders breadcrumb header and kinetic overview section naming', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Aisha Rahman' })).toBeInTheDocument();
    });

    expect(screen.getByText('CRM')).toBeInTheDocument();
    expect(screen.getByText('Contacts')).toBeInTheDocument();
    expect(screen.getByText('Contact Information')).toBeInTheDocument();
  });
});
