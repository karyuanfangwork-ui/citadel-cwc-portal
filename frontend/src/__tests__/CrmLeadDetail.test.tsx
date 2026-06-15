import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CrmLeadDetail from '../../pages/CrmLeadDetail';

const mockGetLead = vi.fn();
const mockListCrmUsers = vi.fn();
const mockUseNextBestAction = vi.fn();

vi.mock('../services/crm.service', () => ({
  default: {
    getLead: (...args: unknown[]) => mockGetLead(...args),
    listCrmUsers: (...args: unknown[]) => mockListCrmUsers(...args),
    updateLead: vi.fn(),
    deleteLead: vi.fn(),
    createNote: vi.fn(),
    createActivity: vi.fn(),
    listActivities: vi.fn(),
    sendActivityReminder: vi.fn(),
    listPipelines: vi.fn(),
    convertLead: vi.fn(),
    updateActivity: vi.fn(),
    deleteActivity: vi.fn(),
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

vi.mock('../hooks/useCrmAi', () => ({
  useAnalyzeNote: () => ({ analyze: vi.fn(), loading: false, error: null, analysis: null }),
  useDraftMessage: () => ({ draftForLead: vi.fn(), loading: false, error: null, content: null }),
  useLeadSummary: () => ({ fetch: vi.fn(), loading: false, error: null, summary: null }),
  useLeadScore: () => ({ fetch: vi.fn(), loading: false, error: null, scoreData: null }),
  useNextBestAction: () => mockUseNextBestAction(),
}));

const lead = {
  id: 'lead-1',
  title: 'ACME Expansion Deal',
  status: 'QUALIFIED',
  companyName: 'ACME Berhad',
  contactName: 'Aisha Rahman',
  contactEmail: 'aisha@acme.test',
  contactPhone: '+60 12-345 6789',
  ownerId: 'user-1',
  owner: {
    id: 'user-1',
    firstName: 'Amirul',
    lastName: 'Hafiz Bin Abdullah',
    email: 'amirul.hafiz.bin.abdullah@capitalcore.example.my',
  },
  source: 'REFERRAL',
  estimatedValue: 75000,
  followUpDate: '2026-06-20T00:00:00.000Z',
  updatedAt: '2026-06-10T00:00:00.000Z',
  account: { id: 'account-1', name: 'ACME Berhad', industry: 'Logistics & Transportation' },
  opportunities: [
    {
      id: 'opp-1',
      name: 'Working Capital Expansion',
      value: 250000,
      probability: 65,
      expectedCloseDate: '2026-10-24T00:00:00.000Z',
      stage: { name: 'Underwriting' },
    },
  ],
  activities: [],
  notes: [],
} as any;

const renderPage = async () => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/crm/leads/lead-1']}>
        <Routes>
          <Route path="/crm/leads/:id" element={<CrmLeadDetail />} />
        </Routes>
      </MemoryRouter>
    );
  });
};

describe('CrmLeadDetail header redesign', () => {
  beforeEach(() => {
    mockGetLead.mockResolvedValue(lead);
    mockListCrmUsers.mockResolvedValue([]);
    mockUseNextBestAction.mockReturnValue({ fetch: vi.fn(), loading: false, error: null, data: null });
  });

  it('shows visible header actions instead of an actions dropdown', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'ACME Expansion Deal' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /actions/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit lead/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /convert to opportunity/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log activity/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add note/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /draft message/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark as lost/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete lead/i })).toBeInTheDocument();
  });

  it('renders the left contact rail and renamed kinetic tabs', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Contact Details')).toBeInTheDocument();
    });

    expect(screen.getByText('Assigned Lead Owner')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'aisha@acme.test' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activities' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Timeline' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notes & Documents' })).toBeInTheDocument();
  });

  it('shows the full assigned owner name and email in the owner card', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Assigned Lead Owner')).toBeInTheDocument();
    });

    const ownerName = screen.getByText('Amirul Hafiz Bin Abdullah');
    const ownerEmail = screen.getByText('amirul.hafiz.bin.abdullah@capitalcore.example.my');

    expect(ownerName).toBeInTheDocument();
    expect(ownerEmail).toBeInTheDocument();
    expect(ownerName.className).not.toContain('truncate');
    expect(ownerEmail.className).not.toContain('truncate');
  });

  it('renders overview as cards with financial health and related opportunities', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Lead Information')).toBeInTheDocument();
    });

    expect(screen.getByText('Financial Health')).toBeInTheDocument();
    expect(screen.getByText('Related Opportunities')).toBeInTheDocument();
    expect(screen.getByText('Industry')).toBeInTheDocument();
    expect(screen.getByText('Logistics & Transportation')).toBeInTheDocument();
    expect(screen.getByText('CTOS Availability')).toBeInTheDocument();
    expect(screen.getByText('Working Capital Expansion')).toBeInTheDocument();
    expect(screen.queryByText('Lead Info')).not.toBeInTheDocument();
  });

  it('renders ai suggested actions only once when next best actions are available', async () => {
    mockUseNextBestAction.mockReturnValue({
      fetch: vi.fn(),
      loading: false,
      error: null,
      data: {
        actions: [
          { action: 'Call within 24h', priority: 'high', reason: 'Hot inbound lead' },
          { action: 'Send follow-up email', priority: 'medium', reason: 'No response in 2 days' },
        ],
      },
    });

    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Call within 24h')).toBeInTheDocument();
    });

    expect(screen.getAllByText(/AI Suggested/i)).toHaveLength(1);
  });
});
