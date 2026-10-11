// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { TicketTable } from '../TicketTable';
import { DashboardPagination } from '../DashboardPagination';
import { DashboardTicket } from '../../../services/agent-dashboard.service';

const ticket = (id: string, reference: string): DashboardTicket => ({
  id, reference, summary: `Summary ${reference}`, priority: 'MEDIUM', status: 'IN_PROGRESS', isTerminal: false,
  createdAt: '2026-10-09T12:00:00.000Z', updatedAt: '2026-10-10T12:00:00.000Z',
  requester: { id: 'requester', name: 'Requester' }, assignee: { id: 'agent', name: 'Agent' }, assignedTeam: 'IT',
  requestType: { id: 'type', name: 'Laptop support' },
  sla: { state: 'ON_TRACK', dueAt: '2026-10-12T12:00:00.000Z', remainingMs: 48 * 60 * 60 * 1000, completedAt: null, evidence: 'legacy-request' },
});

function CurrentPath() {
  const location = useLocation();
  return <output data-testid="current-path">{location.pathname}</output>;
}

describe('TicketTable interactions', () => {
  it('uses Space to toggle a checkbox without navigating, and Enter on the reference link navigates', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const onExport = vi.fn();
    render(<MemoryRouter initialEntries={['/agent']}>
      <CurrentPath />
      <TicketTable tickets={[ticket('ticket-1', 'IT-001')]} canExport selectedIds={new Set()} onToggle={onToggle} onTogglePage={vi.fn()} onExport={onExport} exporting={false} />
    </MemoryRouter>);

    const checkbox = screen.getByRole('checkbox', { name: 'Select IT-001' });
    checkbox.focus();
    await user.keyboard(' ');
    expect(onToggle).toHaveBeenCalledWith('ticket-1');
    expect(screen.getByTestId('current-path')).toHaveTextContent('/agent');

    const link = screen.getByRole('link', { name: 'IT-001' });
    link.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('current-path')).toHaveTextContent('/request/IT-001');
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onExport).not.toHaveBeenCalled();
  });

  it('decodes escaped summary entities and renders the result as plain text', () => {
    const encodedSummary = { ...ticket('ticket-3', 'IT-003'), summary: 'Printer &amp; network issue &lt;img src=x onerror=alert(1)&gt;' };
    render(<MemoryRouter><TicketTable
      tickets={[encodedSummary]} canExport={false} selectedIds={new Set()}
      onToggle={vi.fn()} onTogglePage={vi.fn()} onExport={vi.fn()} exporting={false}
    /></MemoryRouter>);

    expect(screen.getAllByText('Printer & network issue').length).toBe(2);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('counts only visible selected rows and makes select-all indeterminate by visible IDs', () => {
    render(<MemoryRouter><TicketTable
      tickets={[ticket('ticket-1', 'IT-001'), ticket('ticket-2', 'IT-002')]}
      canExport selectedIds={new Set(['ticket-1', 'off-page-ticket'])}
      onToggle={vi.fn()} onTogglePage={vi.fn()} onExport={vi.fn()} exporting={false}
    /></MemoryRouter>);

    expect(screen.getByRole('checkbox', { name: 'Select all tickets on this page' })).toBePartiallyChecked();
    expect(screen.getByRole('button', { name: 'Export 1 selected tickets on this page' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select IT-001' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select IT-002' })).not.toBeChecked();
  });
});

describe('DashboardPagination', () => {
  it('reports full totals above 200 and exposes real page controls', async () => {
    const user = userEvent.setup();
    const onPage = vi.fn();
    render(<DashboardPagination page={1} limit={25} total={243} totalPages={10} onPage={onPage} onLimit={vi.fn()} />);

    expect(screen.getByText('1–25 of 243')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPage).toHaveBeenCalledWith(2);
  });
});
