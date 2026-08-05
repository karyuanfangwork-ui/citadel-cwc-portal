import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  description: 'Referral from RHB Private Banking — converting existing corporate trust',
  aiScore: 95,
  aiScoreReason: 'Strong referral source, verified financial profile, and high conversion likelihood.',
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

const renderPage = async (leadOverride = lead) => {
  mockGetLead.mockResolvedValue(leadOverride);

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

const expectInDocumentOrder = (elements: HTMLElement[]) => {
  for (let i = 0; i < elements.length - 1; i += 1) {
    expect(elements[i].compareDocumentPosition(elements[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
};

describe('CrmLeadDetail header redesign', () => {
  beforeEach(() => {
    mockGetLead.mockResolvedValue(lead);
    mockListCrmUsers.mockResolvedValue([]);
    mockUseNextBestAction.mockReturnValue({ fetch: vi.fn(), loading: false, error: null, data: null });
  });

  it('shows visible header actions and keeps delete in the more actions menu', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'ACME Expansion Deal' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /^actions$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit lead/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /convert to opportunity/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log activity/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add note/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /draft message/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark as lost/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete lead/i })).not.toBeInTheDocument();

    const moreButton = screen.getByRole('button', { name: /more lead actions/i });
    expectInDocumentOrder([
      screen.getByRole('button', { name: /convert to opportunity/i }),
      screen.getByRole('button', { name: /log activity/i }),
      screen.getByRole('button', { name: /add note/i }),
      screen.getByRole('button', { name: /draft message/i }),
      screen.getByRole('button', { name: /edit lead/i }),
      screen.getByRole('button', { name: /mark as lost/i }),
      moreButton,
    ]);
    expect(moreButton).toHaveAttribute('aria-haspopup', 'menu');
    expect(moreButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(moreButton);

    expect(moreButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: /delete lead destructive action/i })).toBeInTheDocument();

    fireEvent.keyDown(moreButton, { key: 'Escape' });
    expect(screen.queryByRole('menuitem', { name: /delete lead destructive action/i })).not.toBeInTheDocument();
  });

  it('renders the left contact rail and renamed kinetic tabs', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Contact Details')).toBeInTheDocument();
    });

    expect(screen.getByText('Lead Owner')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Email Aisha Rahman at aisha@acme.test/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activities' })).toBeInTheDocument();
    // Tabs: Overview, Activities, Notes & Documents, Audit Trail
    expect(screen.getByRole('button', { name: 'Notes & Documents' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Audit Trail' })).toBeInTheDocument();
  });

  it('uses company and contact context in the left rail instead of duplicating the lead title', async () => {
    await renderPage({
      ...lead,
      title: '[DEMO] Family Office Onboarding — Lim Holdings',
      companyName: 'Lim Holdings Sdn Bhd',
      contactName: 'Lim Chee Wai',
      source: 'COLD_CALL',
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '[DEMO] Family Office Onboarding — Lim Holdings' })).toBeInTheDocument();
    });

    const leftRail = screen.getByRole('complementary');
    expect(within(leftRail).getByText('Lim Holdings Sdn Bhd')).toBeInTheDocument();
    expect(within(leftRail).getByText('Lim Chee Wai · COLD CALL')).toBeInTheDocument();
    expect(within(leftRail).queryByText(/\[DEMO\] Family Office/)).not.toBeInTheDocument();
  });

  it('shows the assigned owner name and email in the owner card', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Lead Owner')).toBeInTheDocument();
    });

    const ownerName = screen.getByText('Amirul Hafiz Bin Abdullah');
    const ownerEmail = screen.getByText('amirul.hafiz.bin.abdullah@capitalcore.example.my');

    expect(ownerName).toBeInTheDocument();
    expect(ownerEmail).toBeInTheDocument();
    expect(ownerName.className).not.toContain('truncate');
    expect(ownerEmail.className).not.toContain('truncate');
    expect(ownerEmail).toHaveAttribute('title', 'amirul.hafiz.bin.abdullah@capitalcore.example.my');
  });

  it('renders overview with lead information and related opportunities', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Lead Information')).toBeInTheDocument();
    });

    // Lead Information card with Industry, Lead Source, etc.
    expect(screen.getByText('Industry')).toBeInTheDocument();
    expect(screen.getByText('Logistics & Transportation')).toBeInTheDocument();
    expect(screen.getByText('Related Opportunities')).toBeInTheDocument();
    expect(screen.getByText('Working Capital Expansion')).toBeInTheDocument();
    // Description is rendered via ReactMarkdown
    expect(screen.getByText('Referral from RHB Private Banking — converting existing corporate trust')).toBeInTheDocument();
    // Old label "Lead Info" should not exist (current label is "Lead Information")
    expect(screen.queryByText('Lead Info')).not.toBeInTheDocument();
  });





  it('shows the AI score badge in the header and description in overview', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'ACME Expansion Deal' })).toBeInTheDocument();
    });

    // AI score appears as "95/100" badge in the header
    expect(screen.getByText('95/100')).toBeInTheDocument();
    // Description appears in the overview via ReactMarkdown
    expect(screen.getByText('Referral from RHB Private Banking — converting existing corporate trust')).toBeInTheDocument();
    // The label "AI Score" should not appear as a standalone label
    expect(screen.queryByText('AI Score')).not.toBeInTheDocument();
  });

  it('shows owner in the header metadata and uses friendly placeholders for missing fields', async () => {
    await renderPage({
      ...lead,
      companyName: null,
      followUpDate: null,
      account: { id: 'account-1', name: 'ACME Berhad', industry: null },
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'ACME Expansion Deal' })).toBeInTheDocument();
    });

    expect(screen.getByText(/Owner: Amirul Hafiz Bin Abdullah/)).toBeInTheDocument();
    expect(screen.getAllByText('Not specified').length).toBeGreaterThan(0);
    expect(screen.getByText('No follow-up scheduled')).toBeInTheDocument();
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
    expect(screen.getByText('High priority:')).toBeInTheDocument();
    expect(screen.getByLabelText(/High priority: Call within 24h/i)).toBeInTheDocument();
    });

    expect(screen.getAllByText(/AI Suggested/i)).toHaveLength(1);
  });

  it('shows converted-state guidance with a link to the converted opportunity', async () => {
    await renderPage({
      ...lead,
      status: 'CONVERTED',
      convertedToOppId: 'opp-1',
    });

    await waitFor(() => {
      expect(screen.getByText('Lead converted')).toBeInTheDocument();
    });

    expect(screen.getAllByRole('link', { name: /view opportunity/i })[0]).toHaveAttribute('href', '/crm/opportunities/opp-1');
    expect(screen.queryByRole('button', { name: /convert to opportunity/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /draft message/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark as lost/i })).not.toBeInTheDocument();
    expectInDocumentOrder([
      screen.getAllByRole('link', { name: /view opportunity/i })[0],
      screen.getByRole('button', { name: /log activity/i }),
      screen.getByRole('button', { name: /add note/i }),
      screen.getByRole('button', { name: /edit lead/i }),
      screen.getByRole('button', { name: /more lead actions/i }),
    ]);
  });

  it('replaces lead-nurturing ai suggestions with post-conversion suggestions for converted leads', async () => {
    mockUseNextBestAction.mockReturnValue({
      fetch: vi.fn(),
      loading: false,
      error: null,
      data: {
        actions: [
          { action: 'Send follow-up email', priority: 'medium', reason: 'No response in 2 days' },
        ],
      },
    });

    await renderPage({
      ...lead,
      status: 'CONVERTED',
      convertedToOppId: 'opp-1',
    });

    await waitFor(() => {
      expect(screen.getByText('Lead converted')).toBeInTheDocument();
    });

    expect(screen.queryByText('Send follow-up email')).not.toBeInTheDocument();
    expect(screen.getByText('View converted opportunity')).toBeInTheDocument();
    expect(screen.getByText('Log relationship activity')).toBeInTheDocument();
    expect(screen.getByText('Review onboarding documents')).toBeInTheDocument();
    expect(screen.getByText('High priority:')).toBeInTheDocument();
    expect(screen.getByText('Recommended:')).toBeInTheDocument();
    expect(screen.getByText('Optional:')).toBeInTheDocument();
  });
});
