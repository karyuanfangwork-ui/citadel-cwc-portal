import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CrmOpportunityDetail from '../../pages/CrmOpportunityDetail';

const mockGetOpportunity = vi.fn();
const mockListActivities = vi.fn();
const mockListCrmUsers = vi.fn();
const mockUseNextBestAction = vi.fn();
const mockUseWinProbability = vi.fn();
const mockUseAnalyzeNote = vi.fn();
const mockUseWinLossDebrief = vi.fn();

vi.mock('../services/crm.service', () => ({
  default: {
    getOpportunity: (...args: unknown[]) => mockGetOpportunity(...args),
    listActivities: (...args: unknown[]) => mockListActivities(...args),
    listCrmUsers: (...args: unknown[]) => mockListCrmUsers(...args),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'admin@test.local', permissions: ['crm:read', 'crm:write', 'crm:admin'] },
  }),
}));

vi.mock('../hooks/useCrmAi', () => ({
  useNextBestAction: () => mockUseNextBestAction(),
  useWinProbability: () => mockUseWinProbability(),
  useAnalyzeNote: () => mockUseAnalyzeNote(),
  useWinLossDebrief: () => mockUseWinLossDebrief(),
}));

const renderPage = async () => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/crm/opportunities/opp-1']}>
        <Routes>
          <Route path="/crm/opportunities/:id" element={<CrmOpportunityDetail />} />
        </Routes>
      </MemoryRouter>
    );
  });
};

describe('CrmOpportunityDetail', () => {
  beforeEach(() => {
    mockListActivities.mockReset();
    mockListCrmUsers.mockResolvedValue([]);
    mockUseNextBestAction.mockReturnValue({ fetch: vi.fn(), loading: false, error: null, data: null });
    mockUseWinProbability.mockReturnValue({ fetch: vi.fn(), loading: false, error: null, data: null });
    mockUseAnalyzeNote.mockReturnValue({ analyze: vi.fn(), loading: false, loadingId: null, error: null, results: {}, analysis: null });
    mockUseWinLossDebrief.mockReturnValue({ fetch: vi.fn(), loading: false, error: null, data: null });
    mockGetOpportunity.mockResolvedValue({
      id: 'opp-1',
      name: 'ACME Expansion Deal',
      createdAt: '2026-06-14T00:00:00.000Z',
      value: 250000,
      probability: 40,
      account: { id: 'account-1', name: 'ACME Berhad' },
      contact: { id: 'contact-1', firstName: 'Aisha', lastName: 'Rahman' },
      activities: [],
      stageHistory: [],
      pipeline: { id: 'pipeline-1', name: 'Sales' },
      stage: { id: 'stage-1', name: 'Prospecting', displayOrder: 1, probability: 20 },
    });
  });

  it('renders converted Lead history with Opportunity activities and appends the next page', async () => {
    mockGetOpportunity.mockResolvedValueOnce({
      id: 'opp-1',
      name: 'ACME Expansion Deal',
      createdAt: '2026-06-14T00:00:00.000Z',
      value: 250000,
      probability: 40,
      account: { id: 'account-1', name: 'ACME Berhad' },
      activities: [
        {
          id: 'lead-activity', activityType: 'CALL', subject: 'Lead Activity', description: 'Lead context',
          userId: 'user-1', accountId: null, contactId: null, leadId: 'lead-1', opportunityId: null,
          scheduledAt: null, completedAt: null, durationMinutes: null, callCategory: null, callOutcome: null,
          emailOutcome: null, meetingOutcome: null, engagementOutcome: null, reminderSent: false,
          createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z', sourceEntity: 'LEAD',
        },
        {
          id: 'opp-activity', activityType: 'MEETING', subject: 'Opportunity Activity', description: 'Deal context',
          userId: 'user-1', accountId: null, contactId: null, leadId: null, opportunityId: 'opp-1',
          scheduledAt: null, completedAt: null, durationMinutes: null, callCategory: null, callOutcome: null,
          emailOutcome: null, meetingOutcome: null, engagementOutcome: null, reminderSent: false,
          createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-01T09:00:00.000Z', sourceEntity: 'OPPORTUNITY',
        },
      ],
      activityPagination: { page: 1, limit: 2, total: 3, totalPages: 2 },
      stageHistory: [],
      pipeline: { id: 'pipeline-1', name: 'Sales' },
      stage: { id: 'stage-1', name: 'Prospecting', displayOrder: 1, probability: 20 },
    });
    mockListActivities.mockResolvedValueOnce({
      activities: [{
        id: 'older-activity', activityType: 'EMAIL', subject: 'Older Opportunity Activity', description: null,
        userId: 'user-1', accountId: null, contactId: null, leadId: null, opportunityId: 'opp-1',
        scheduledAt: null, completedAt: null, durationMinutes: null, callCategory: null, callOutcome: null,
        emailOutcome: null, meetingOutcome: null, engagementOutcome: null, reminderSent: false,
        createdAt: '2026-09-01T08:00:00.000Z', updatedAt: '2026-09-01T08:00:00.000Z', sourceEntity: 'OPPORTUNITY',
      }],
      pagination: { page: 2, limit: 2, total: 3, totalPages: 2 },
    });

    await renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'ACME Expansion Deal' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Activities' }));

    expect(screen.getByText('Lead Activity')).toBeInTheDocument();
    expect(screen.getByText('Opportunity Activity')).toBeInTheDocument();
    expect(screen.getByText('From converted lead')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Load More/i }));

    await waitFor(() => expect(screen.getByText('Older Opportunity Activity')).toBeInTheDocument());
    expect(mockListActivities).toHaveBeenCalledWith({ opportunityId: 'opp-1', page: 2, limit: 2 });
    expect(document.body.textContent!.indexOf('Opportunity Activity')).toBeLessThan(document.body.textContent!.indexOf('Older Opportunity Activity'));
  });

  it('renders breadcrumb, header, and kinetic sidebar sections', async () => {
    mockGetOpportunity.mockResolvedValueOnce({
      id: 'opp-1',
      name: 'ACME Expansion Deal',
      createdAt: '2026-06-14T00:00:00.000Z',
      value: 250000,
      probability: 40,
      account: { id: 'account-1', name: 'ACME Berhad' },
      activities: [],
      stageHistory: [],
      pipeline: { id: 'pipeline-1', name: 'Sales' },
      stage: { id: 'stage-1', name: 'Prospecting', displayOrder: 1, probability: 20 },
    });
    await renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'ACME Expansion Deal' })).toBeInTheDocument();
    });

    expect(screen.getByText('CRM')).toBeInTheDocument();
    expect(screen.getByText('Opportunities')).toBeInTheDocument();
    expect(screen.getByText('DEAL ATTRIBUTES')).toBeInTheDocument();
    expect(screen.getByText('DEAL HEALTH')).toBeInTheDocument();
    expect(screen.getByText('DEAL VALUE')).toBeInTheDocument();
  });
});
