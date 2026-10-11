import { expect, test, type Page } from '@playwright/test';
import type { AgentDashboardResponse, DashboardTicket } from '../../src/services/agent-dashboard.service';
import { CREDIT_ANALYST, login } from '../credit/support/auth';

const asOf = '2026-10-10T12:00:00.000Z';
const dueAt = '2026-10-10T20:00:00.000Z';

function makeTicket(
  id: string,
  reference: string,
  state: DashboardTicket['sla']['state'],
  options: { terminal?: boolean; remainingMs?: number; priority?: string; dueAt?: string | null } = {},
): DashboardTicket {
  const terminal = options.terminal ?? false;
  return {
    id, reference, summary: `Dashboard acceptance ${reference}`, priority: options.priority ?? 'MEDIUM',
    status: terminal ? 'RESOLVED' : 'IN_PROGRESS', isTerminal: terminal,
    createdAt: '2026-10-09T12:00:00.000Z', updatedAt: asOf,
    requester: { id: 'requester-1', name: 'Demo Requester' },
    assignee: { id: 'agent-1', name: 'Demo Agent' }, assignedTeam: 'IT',
    requestType: { id: 'type-1', name: 'Laptop Support' },
    sla: {
      state, dueAt: options.dueAt === undefined ? dueAt : options.dueAt,
      remainingMs: options.remainingMs ?? null,
      completedAt: terminal ? '2026-10-10T11:00:00.000Z' : null,
      evidence: terminal ? 'resolution-clock' : 'legacy-request',
    },
  };
}

const breached = makeTicket('ticket-breach', 'IT-BREACHED-001', 'BREACHED', { remainingMs: -60 * 60_000, priority: 'CRITICAL', dueAt: '2026-10-10T11:00:00.000Z' });
const dueSoon = makeTicket('ticket-due', 'IT-DUE-001', 'DUE_SOON', { remainingMs: 8 * 60 * 60_000 });
const oldMatch = makeTicket('ticket-old-match', 'IT-OLD-241', 'BREACHED', { remainingMs: -24 * 60 * 60_000, dueAt: '2026-10-09T12:00:00.000Z' });
const closedMissed = makeTicket('ticket-closed', 'IT-CLOSED-001', 'MISSED', { terminal: true, remainingMs: null, dueAt: '2026-10-09T12:00:00.000Z' });
const pageTickets = [breached, dueSoon, ...Array.from({ length: 23 }, (_, index) => makeTicket(`ticket-${index + 3}`, `IT-${String(index + 3).padStart(3, '0')}`, 'NO_SLA', { dueAt: null }))];

function dashboardFor(params: URLSearchParams): AgentDashboardResponse {
  const search = (params.get('search') ?? '').toLowerCase();
  const slaState = params.get('slaState');
  const queue = params.get('queue');
  let tickets: DashboardTicket[] = pageTickets;
  let total = 243;
  if (search.includes('old-match')) {
    tickets = [oldMatch];
    total = 1;
  } else if (slaState === 'DUE_SOON') {
    tickets = [dueSoon];
    total = 1;
  } else if (queue === 'closed') {
    tickets = [closedMissed];
    total = 4;
  }
  const page = Number(params.get('page') ?? 1);
  const limit = Number(params.get('limit') ?? 25) as 25 | 50 | 100;
  return {
    asOf, scope: (params.get('scope') ?? 'mine') as AgentDashboardResponse['scope'],
    scopeLabel: 'My work', availableScopes: ['mine', 'team', 'accessible'],
    metrics: { open: 239, dueSoon: 1, breached: 1, avgResolutionHours: null, resolutionSampleSize: 0, resolutionWindow: { from: '2026-09-10T12:00:00.000Z', to: asOf } },
    queueCounts: { open: 239, closed: 4, all: 243, unassigned: 18 },
    requestTypes: [{ id: 'type-1', name: 'Laptop Support' }],
    attention: { total: 4, tickets: [breached, dueSoon] },
    tickets,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function installDashboardMocks(page: Page) {
  const requests: URL[] = [];
  let failuresToInject = 0;
  await page.route('**/requests/agent-dashboard**', async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    if (failuresToInject > 0) {
      failuresToInject -= 1;
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ status: 'error', message: 'temporarily unavailable' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', data: dashboardFor(url.searchParams) }) });
  });
  const exportBodies: unknown[] = [];
  await page.route('**/requests/export/xlsx', async (route) => {
    exportBodies.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: 'fixture-xlsx' });
  });
  return { requests, exportBodies, failNextRefresh: () => { failuresToInject += 1; } };
}

test.describe('Agent Dashboard authenticated browser acceptance', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, CREDIT_ANALYST);
  });

  test('searches old results, follows SLA/queue controls, exports visible selection, and labels closed outcomes', async ({ page }) => {
    const mocks = await installDashboardMocks(page);
    await page.goto('/agent');
    await expect(page.getByRole('heading', { name: 'Agent Dashboard' })).toBeVisible();
    await expect(page.getByText('Showing 25 of 243 tickets')).toBeVisible();
    await expect(page.getByRole('link', { name: 'IT-BREACHED-001' })).toBeVisible();

    const search = page.getByRole('searchbox', { name: 'Search tickets' });
    await search.fill('old-match');
    await expect(page.getByRole('link', { name: 'IT-OLD-241' })).toBeVisible();
    await expect.poll(() => mocks.requests.some((url) => url.searchParams.get('search') === 'old-match')).toBe(true);

    await page.getByRole('button', { name: /Due soon/ }).click();
    await expect(page.getByRole('link', { name: 'IT-DUE-001' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Resolution SLA' })).toHaveValue('DUE_SOON');
    await expect.poll(() => mocks.requests.some((url) => url.searchParams.get('slaState') === 'DUE_SOON')).toBe(true);

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await page.getByRole('tab', { name: /Closed/ }).click();
    const closedRow = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'IT-CLOSED-001' }) });
    await expect(closedRow).toBeVisible();
    await expect(closedRow).toContainText('Missed SLA at resolution');
    await expect(closedRow).not.toContainText('Breached');
    await expect(closedRow).not.toHaveClass(/border-l-red-500/);

    await page.getByRole('tab', { name: /Open/ }).click();
    await page.getByRole('checkbox', { name: 'Select IT-BREACHED-001' }).check();
    await page.getByRole('button', { name: 'Export 1 selected tickets on this page' }).click();
    await expect(page.getByRole('status')).toContainText('Export downloaded.');
    expect(mocks.exportBodies).toContainEqual({ ids: ['ticket-breach'] });
  });

  test('keeps the last good dashboard after refresh failure and recovers on retry', async ({ page }) => {
    const mocks = await installDashboardMocks(page);
    await page.goto('/agent');
    await expect(page.getByRole('link', { name: 'IT-BREACHED-001' })).toBeVisible();

    mocks.failNextRefresh();
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(page.getByText(/Refresh failed\. Showing the last successful dashboard snapshot/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'IT-BREACHED-001' })).toBeVisible();

    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(page.getByText(/Refresh failed\. Showing the last successful dashboard snapshot/)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'IT-BREACHED-001' })).toBeVisible();
  });
});
