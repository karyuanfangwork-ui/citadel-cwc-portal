import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CrmOpportunityDetail from '../../pages/CrmOpportunityDetail';

const mockGetOpportunity = vi.fn();
const mockListActivities = vi.fn();
const mockListCrmUsers = vi.fn();
const mockCreateActivity = vi.fn();
const mockUpdateActivity = vi.fn();
const mockCreateNote = vi.fn();
const mockUpdateNote = vi.fn();
const mockDeleteNote = vi.fn();
const mockUseNextBestAction = vi.fn();
const mockUseWinProbability = vi.fn();
const mockUseAnalyzeNote = vi.fn();
const mockUseWinLossDebrief = vi.fn();

vi.mock('../services/crm.service', () => ({
  default: {
    getOpportunity: (...args: unknown[]) => mockGetOpportunity(...args),
    listActivities: (...args: unknown[]) => mockListActivities(...args),
    listCrmUsers: (...args: unknown[]) => mockListCrmUsers(...args),
    createActivity: (...args: unknown[]) => mockCreateActivity(...args),
    updateActivity: (...args: unknown[]) => mockUpdateActivity(...args),
    createNote: (...args: unknown[]) => mockCreateNote(...args),
    updateNote: (...args: unknown[]) => mockUpdateNote(...args),
    deleteNote: (...args: unknown[]) => mockDeleteNote(...args),
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
    mockCreateActivity.mockReset();
    mockUpdateActivity.mockReset();
    mockCreateNote.mockReset();
    mockUpdateNote.mockReset();
    mockDeleteNote.mockReset();
    mockCreateActivity.mockResolvedValue({});
    mockUpdateActivity.mockResolvedValue({});
    mockCreateNote.mockResolvedValue({});
    mockUpdateNote.mockResolvedValue({});
    mockDeleteNote.mockResolvedValue(undefined);
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
      notes: [{
        id: 'note-1', content: 'Original opportunity note', authorId: 'user-1', isPinned: false,
        createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
        author: { id: 'user-1', firstName: 'Test', lastName: 'Author' },
      }],
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

  it('captures call category and outcome when logging an opportunity call', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Activities' }));
    fireEvent.click(screen.getByRole('button', { name: /log activity/i }));

    expect(screen.getByText('Call category')).toBeInTheDocument();
    expect(screen.getByText('Call outcome')).toBeInTheDocument();
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'FOLLOW_UP_CALL' } });
    fireEvent.change(selects[2], { target: { value: 'ANSWERED' } });
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Discussed proposal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log Activity' }));

    await waitFor(() => expect(mockCreateActivity).toHaveBeenCalledWith({
      activityType: 'CALL', callCategory: 'FOLLOW_UP_CALL', callOutcome: 'ANSWERED',
      subject: 'Discussed proposal', opportunityId: 'opp-1',
    }));
  });

  it('captures email outcome when logging an opportunity email', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Activities' }));
    fireEvent.click(screen.getByRole('button', { name: /log activity/i }));
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'EMAIL' } });

    expect(screen.getByText('Email outcome')).toBeInTheDocument();
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'REPLIED' } });
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Email follow-up' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log Activity' }));

    await waitFor(() => expect(mockCreateActivity).toHaveBeenCalledWith({
      activityType: 'EMAIL', emailOutcome: 'REPLIED', subject: 'Email follow-up', opportunityId: 'opp-1',
    }));
  });

  it('captures meeting outcome when logging an opportunity meeting', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Activities' }));
    fireEvent.click(screen.getByRole('button', { name: /log activity/i }));
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'MEETING' } });

    expect(screen.getByText('Meeting outcome')).toBeInTheDocument();
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'COMPLETED' } });
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Completed review meeting' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log Activity' }));

    await waitFor(() => expect(mockCreateActivity).toHaveBeenCalledWith({
      activityType: 'MEETING', meetingOutcome: 'COMPLETED', subject: 'Completed review meeting', opportunityId: 'opp-1',
    }));
  });

  it('supports editing and deleting an authored opportunity note', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Notes' }));

    fireEvent.click(screen.getByRole('button', { name: 'Edit note' }));
    const editDialog = screen.getByRole('heading', { name: 'Edit Note' }).closest('div.relative') as HTMLElement;
    fireEvent.change(within(editDialog).getByRole('textbox'), { target: { value: 'Updated opportunity note' } });
    fireEvent.click(within(editDialog).getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(mockUpdateNote).toHaveBeenCalledWith('note-1', { content: 'Updated opportunity note' }));

    fireEvent.click(screen.getByRole('button', { name: 'Delete note' }));
    expect(screen.getByRole('heading', { name: 'Delete Note' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mockDeleteNote).toHaveBeenCalledWith('note-1'));
  });
});
