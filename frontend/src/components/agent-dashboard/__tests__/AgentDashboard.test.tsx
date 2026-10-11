// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AgentDashboard from '../../../../pages/AgentDashboard';
import { agentDashboardService, AgentDashboardResponse } from '../../../services/agent-dashboard.service';
import { requestService } from '../../../services/request.service';

const auth = vi.hoisted(() => ({ user: { id: 'agent-1', firstName: 'Ari', roles: ['AGENT'], agentTeam: 'IT' as string | null, permissions: [] as string[] } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../services/agent-dashboard.service', () => ({ agentDashboardService: { get: vi.fn() } }));
vi.mock('../../../services/request.service', () => ({ requestService: { exportXlsx: vi.fn() } }));

const dashboardResponse: AgentDashboardResponse = {
  asOf: '2026-10-10T12:00:00.000Z', scope: 'mine', scopeLabel: 'My work', availableScopes: ['mine', 'team'],
  metrics: { open: 1, dueSoon: 1, breached: 0, avgResolutionHours: null, resolutionSampleSize: 0, resolutionWindow: { from: '2026-09-10T12:00:00.000Z', to: '2026-10-10T12:00:00.000Z' } },
  queueCounts: { open: 1, closed: 0, all: 1, unassigned: 0 }, requestTypes: [{ id: 'rt-1', name: 'Laptop Support' }],
  attention: { total: 1, tickets: [{
    id: 'ticket-1', reference: 'IT-001', summary: 'Replace laptop', priority: 'HIGH', status: 'IN_PROGRESS', isTerminal: false,
    createdAt: '2026-10-09T12:00:00.000Z', updatedAt: '2026-10-10T11:00:00.000Z', requester: { id: 'user-1', name: 'Sam Requester' },
    assignee: { id: 'agent-1', name: 'Ari Agent' }, assignedTeam: 'IT', requestType: { id: 'rt-1', name: 'Laptop Support' },
    sla: { state: 'DUE_SOON', dueAt: '2026-10-10T20:00:00.000Z', remainingMs: 8 * 60 * 60 * 1000, completedAt: null, evidence: 'legacy-request' },
  }] },
  tickets: [{
    id: 'ticket-1', reference: 'IT-001', summary: 'Replace laptop', priority: 'HIGH', status: 'IN_PROGRESS', isTerminal: false,
    createdAt: '2026-10-09T12:00:00.000Z', updatedAt: '2026-10-10T11:00:00.000Z', requester: { id: 'user-1', name: 'Sam Requester' },
    assignee: { id: 'agent-1', name: 'Ari Agent' }, assignedTeam: 'IT', requestType: { id: 'rt-1', name: 'Laptop Support' },
    sla: { state: 'DUE_SOON', dueAt: '2026-10-10T20:00:00.000Z', remainingMs: 8 * 60 * 60 * 1000, completedAt: null, evidence: 'legacy-request' },
  }],
  pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
};
const get = vi.mocked(agentDashboardService.get);
const exportXlsx = vi.mocked(requestService.exportXlsx);
function renderPage() { return render(<MemoryRouter><AgentDashboard /></MemoryRouter>); }

beforeEach(() => {
  vi.clearAllMocks();
  auth.user.permissions = [];
  auth.user.agentTeam = 'IT';
  get.mockResolvedValue(dashboardResponse);
  exportXlsx.mockResolvedValue(new Blob(['xlsx']));
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:export'), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

describe('AgentDashboard', () => {
  it('renders server counts, scoped queues, and a real reference link without report data', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Agent Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Open tickets')).toBeInTheDocument();
    expect(screen.getByText('1–1 of 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'IT-001' })).toHaveAttribute('href', '/request/IT-001');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(expect.objectContaining({ scope: 'mine', queue: 'open', limit: 25 }), expect.any(AbortSignal));
  });

  it('shows a clear no-team state and hides team-only scopes and queues', async () => {
    auth.user.agentTeam = null;
    get.mockResolvedValue({ ...dashboardResponse, availableScopes: ['mine'] });
    renderPage();

    expect(await screen.findByRole('status')).toHaveTextContent('Your team queue is unavailable because no team is configured.');
    expect(screen.queryByRole('option', { name: 'My team' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Unassigned/ })).not.toBeInTheDocument();
  });

  it('sends scope and filter changes to the service and resets page state', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('link', { name: 'IT-001' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Work scope' }), 'team');
    await waitFor(() => expect(get).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'team', page: 1 }), expect.any(AbortSignal)));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'HIGH');
    await waitFor(() => expect(get).toHaveBeenLastCalledWith(expect.objectContaining({ priority: 'HIGH', page: 1 }), expect.any(AbortSignal)));
  });

  it('clears selected records when the visible page changes', async () => {
    const user = userEvent.setup();
    auth.user.permissions = ['request:export'];
    const firstPage = {
      ...dashboardResponse,
      pagination: { page: 1, limit: 25 as const, total: 26, totalPages: 2 },
    };
    const secondTicket = { ...dashboardResponse.tickets[0], id: 'ticket-2', reference: 'IT-002' };
    get.mockImplementation(async (query) => query.page === 1
      ? firstPage
      : { ...firstPage, tickets: [secondTicket], pagination: { ...firstPage.pagination, page: 2 } });

    renderPage();
    await user.click(await screen.findByRole('checkbox', { name: 'Select IT-001' }));
    expect(screen.getByRole('button', { name: 'Export 1 selected tickets on this page' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('checkbox', { name: 'Select IT-002' });
    await waitFor(() => expect(screen.queryByRole('button', { name: /Export .* selected tickets/ })).not.toBeInTheDocument());
    expect(exportXlsx).not.toHaveBeenCalled();
  });

  it('moves to the last available page when a refresh shrinks the result set', async () => {
    const user = userEvent.setup();
    let pageTwoCalls = 0;
    let shrunk = false;
    const pageOne = { ...dashboardResponse, pagination: { page: 1, limit: 25 as const, total: 26, totalPages: 2 } };
    const pageTwoTicket = { ...dashboardResponse.tickets[0], id: 'ticket-2', reference: 'IT-002' };
    get.mockImplementation(async (query) => {
      if (query.page === 1) return shrunk
        ? { ...pageOne, pagination: { page: 1, limit: 25 as const, total: 1, totalPages: 1 } }
        : pageOne;
      pageTwoCalls += 1;
      if (pageTwoCalls === 1) {
        return { ...pageOne, tickets: [pageTwoTicket], pagination: { ...pageOne.pagination, page: 2 } };
      }
      shrunk = true;
      return { ...pageOne, tickets: [], pagination: { page: 2, limit: 25, total: 1, totalPages: 1 } };
    });

    renderPage();
    await screen.findByRole('link', { name: 'IT-001' });
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('link', { name: 'IT-002' });
    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    await screen.findByRole('link', { name: 'IT-001' });
    await waitFor(() => expect(get).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }), expect.any(AbortSignal)));
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
  });

  it('shows an accessible error when export fails', async () => {
    const user = userEvent.setup();
    auth.user.permissions = ['request:export'];
    exportXlsx.mockRejectedValue(new Error('export unavailable'));
    renderPage();
    await user.click(await screen.findByRole('checkbox', { name: 'Select IT-001' }));
    await user.click(screen.getByRole('button', { name: 'Export 1 selected tickets on this page' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(exportXlsx).toHaveBeenCalledWith(['ticket-1']);
  });

  it('exports only selected current-page rows for users with request:export', async () => {
    const user = userEvent.setup();
    auth.user.permissions = ['request:export'];
    renderPage();
    await user.click(await screen.findByRole('checkbox', { name: 'Select IT-001' }));
    await user.click(screen.getByRole('button', { name: 'Export 1 selected tickets on this page' }));
    await waitFor(() => expect(exportXlsx).toHaveBeenCalledWith(['ticket-1']));
    expect(await screen.findByRole('status')).toHaveTextContent('Export downloaded.');
  });
});
