// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DashboardSummary } from '../DashboardSummary';
import { DashboardFilters } from '../DashboardFilters';
import { DashboardTabs } from '../DashboardTabs';
import { AttentionQueue } from '../AttentionQueue';
import { AgentDashboardResponse, DashboardScope, DashboardTicket } from '../../../services/agent-dashboard.service';

const now = '2026-10-10T12:00:00.000Z';
const ticket: DashboardTicket = {
  id: 'ticket-1', reference: 'IT-001', summary: 'Replace laptop', priority: 'HIGH', status: 'IN_PROGRESS', isTerminal: false,
  createdAt: now, updatedAt: now, requester: { id: 'requester-1', name: 'Sam Requester' },
  assignee: { id: 'agent-1', name: 'Ari Agent' }, assignedTeam: 'IT',
  requestType: { id: 'type-1', name: 'Laptop Support' },
  sla: { state: 'BREACHED', dueAt: '2026-10-10T11:00:00.000Z', remainingMs: -60 * 60_000, completedAt: null, evidence: 'legacy-request' },
};
const response: AgentDashboardResponse = {
  asOf: now, scope: 'mine', scopeLabel: 'My work', availableScopes: ['mine', 'team'],
  metrics: { open: 3, dueSoon: 1, breached: 1, avgResolutionHours: null, resolutionSampleSize: 0, resolutionWindow: { from: '2026-09-10T12:00:00.000Z', to: now } },
  queueCounts: { open: 3, closed: 1, all: 4, unassigned: 1 },
  requestTypes: [{ id: 'type-1', name: 'Laptop Support' }],
  attention: { total: 1, tickets: [ticket] }, tickets: [ticket],
  pagination: { page: 1, limit: 25, total: 4, totalPages: 1 },
};

const requiredFilterProps = {
  scope: 'mine' as const, availableScopes: ['mine', 'team'] as DashboardScope[], search: '', requestTypeId: '', priority: '' as const,
  slaState: '' as const, sort: 'urgency' as const, requestTypes: [{ id: 'type-1', name: 'Laptop Support' }], hasFilters: false,
  onScope: vi.fn(), onSearch: vi.fn(), onRequestType: vi.fn(), onPriority: vi.fn(), onSla: vi.fn(), onSort: vi.fn(), onClear: vi.fn(),
};

describe('Agent Dashboard summary and scope widgets', () => {
  it('distinguishes unavailable averages and wires summary card actions', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onDueSoon = vi.fn();
    const onBreached = vi.fn();
    render(<DashboardSummary data={response} loading={false} onOpen={onOpen} onDueSoon={onDueSoon} onBreached={onBreached} />);

    expect(screen.getByText('No resolution data')).toBeInTheDocument();
    expect(screen.getByText(/n=0/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /SLA breached/ }));
    expect(onBreached).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: /Due soon/ }));
    expect(onDueSoon).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: /Open tickets/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('renders the server attention total and delegates item and View open work navigation', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const onViewOpen = vi.fn();
    render(<AttentionQueue total={4} tickets={[ticket]} onViewOpen={onViewOpen} onNavigate={onNavigate} />);

    expect(screen.getByRole('heading', { name: 'Needs attention (4)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /View open work/ }));
    expect(onViewOpen).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: /IT-001/ }));
    expect(onNavigate).toHaveBeenCalledWith(ticket);
  });

  it('exposes scope and filter options and routes every change to its callback', async () => {
    const user = userEvent.setup();
    const props = { ...requiredFilterProps, hasFilters: true };
    render(<DashboardFilters {...props} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Work scope' }), 'team');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Request type' }), 'type-1');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Resolution SLA' }), 'UNKNOWN');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort tickets' }), 'created-asc');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(props.onScope).toHaveBeenCalledWith('team');
    expect(props.onRequestType).toHaveBeenCalledWith('type-1');
    expect(props.onSla).toHaveBeenCalledWith('UNKNOWN');
    expect(props.onSort).toHaveBeenCalledWith('created-asc');
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });

  it('uses semantic tabs and passes the selected queue to the page', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DashboardTabs queue="open" counts={response.queueCounts} showUnassigned onChange={onChange} />);

    expect(screen.getByRole('tab', { name: /Open/ })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('tab', { name: /Closed/ }));
    expect(onChange).toHaveBeenCalledWith('closed');
    expect(screen.getByRole('tab', { name: /Unassigned/ })).toBeInTheDocument();
  });
});
