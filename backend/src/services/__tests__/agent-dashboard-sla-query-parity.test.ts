import { Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import { CLOSED_STATUSES, RESOLVED_STATUSES } from '../../constants/requestStatuses';
import { classifyDashboardSla, DashboardSlaInput, DashboardSlaState } from '../agent-dashboard-sla.service';
import { dashboardSlaStateExpression } from '../agent-dashboard-query.service';

const now = new Date('2026-10-10T12:00:00.000Z');
const hour = 60 * 60 * 1000;

interface Fixture {
  label: string;
  status: string;
  legacyDueAt: Date | null;
  legacyPausedAt: Date | null;
  currentCount: number;
  currentStatus: 'ACTIVE' | 'PAUSED' | 'BREACHED' | null;
  currentDueAt: Date | null;
  currentPausedAt: Date | null;
  completedCount: number;
  completedDueAt: Date | null;
  completedAt: Date | null;
}

function activeFixture(label: string, overrides: Partial<Fixture> = {}): Fixture {
  return {
    label, status: 'IN_PROGRESS', legacyDueAt: null, legacyPausedAt: null,
    currentCount: 0, currentStatus: null, currentDueAt: null, currentPausedAt: null,
    completedCount: 0, completedDueAt: null, completedAt: null,
    ...overrides,
  };
}

function pureState(fixture: Fixture): DashboardSlaState {
  const terminal = CLOSED_STATUSES.map(String).includes(fixture.status);
  const positive = RESOLVED_STATUSES.map(String).includes(fixture.status);
  const ambiguous = terminal
    ? fixture.currentCount > 0 || fixture.completedCount > 1
    : fixture.currentCount > 1;
  const clock = terminal
    ? fixture.completedCount === 1 && fixture.currentCount === 0
      ? { dueAt: fixture.completedDueAt, completedAt: fixture.completedAt, pausedAt: null, status: 'COMPLETED' as const }
      : null
    : fixture.currentCount === 1 && fixture.currentStatus
      ? { dueAt: fixture.currentDueAt, completedAt: null, pausedAt: fixture.currentPausedAt, status: fixture.currentStatus }
      : null;
  const input: DashboardSlaInput = {
    isTerminal: terminal, isPositiveResolution: positive,
    legacyDueAt: fixture.legacyDueAt, legacyPausedAt: fixture.legacyPausedAt,
    resolutionClock: clock, ambiguousResolutionClock: ambiguous,
  };
  return classifyDashboardSla(input, now).state;
}

async function sqlState(fixture: Fixture): Promise<string> {
  const stateExpression = dashboardSlaStateExpression(now);
  const rows = await prisma.$queryRaw<{ state: string }[]>(Prisma.sql`WITH r AS (
    SELECT ${fixture.status}::text AS status, ${fixture.legacyDueAt}::timestamp AS sla_due_at,
      ${fixture.legacyPausedAt}::timestamp AS sla_paused_at
  ), clocks AS (
    SELECT ${fixture.currentCount}::int AS current_count, ${fixture.currentStatus}::text AS current_status,
      ${fixture.currentDueAt}::timestamp AS current_due_at, ${fixture.currentPausedAt}::timestamp AS current_paused_at,
      ${fixture.completedCount}::int AS completed_count, ${fixture.completedDueAt}::timestamp AS completed_due_at,
      ${fixture.completedAt}::timestamp AS completed_at
  ) SELECT (${stateExpression}) AS state FROM r CROSS JOIN clocks`);
  return rows[0].state;
}

const fixtures: Fixture[] = [
  activeFixture('no SLA'),
  activeFixture('legacy deadline breached', { legacyDueAt: new Date(now.getTime() - 1) }),
  activeFixture('current clock overrides stale legacy deadline', {
    legacyDueAt: new Date(now.getTime() - 2 * hour), currentCount: 1, currentStatus: 'ACTIVE', currentDueAt: new Date(now.getTime() + hour),
  }),
  activeFixture('current pause takes precedence', {
    currentCount: 1, currentStatus: 'PAUSED', currentDueAt: new Date(now.getTime() - hour), currentPausedAt: new Date(now.getTime() - 15 * 60_000),
  }),
  activeFixture('duplicate current clocks are unknown', { currentCount: 2 }),
  activeFixture('future timestamp on BREACHED clock is inconsistent', {
    currentCount: 1, currentStatus: 'BREACHED', currentDueAt: new Date(now.getTime() + hour),
  }),
  activeFixture('legacy pause freezes state', { legacyDueAt: new Date(now.getTime() - hour), legacyPausedAt: new Date(now.getTime() - 15 * 60_000) }),
  activeFixture('exact 24-hour edge is due soon', { legacyDueAt: new Date(now.getTime() + 24 * hour) }),
  activeFixture('reopened request uses the new active clock instead of older completed clock', {
    status: 'IN_PROGRESS', currentCount: 1, currentStatus: 'ACTIVE', currentDueAt: new Date(now.getTime() + hour),
    completedCount: 1, completedDueAt: new Date(now.getTime() - 3 * hour), completedAt: new Date(now.getTime() - 2 * hour),
  }),
  activeFixture('completed resolution met', {
    status: 'RESOLVED', completedCount: 1, completedDueAt: new Date(now.getTime() + hour), completedAt: now,
  }),
  activeFixture('completed resolution missed', {
    status: 'COMPLETED', completedCount: 1, completedDueAt: new Date(now.getTime() - hour), completedAt: now,
  }),
  activeFixture('completed outcome without clock evidence is unknown', { status: 'RESOLVED' }),
  activeFixture('multiple completed clocks are ambiguous', { status: 'RESOLVED', completedCount: 2 }),
  activeFixture('cancelled request is not applicable', { status: 'CANCELLED', legacyDueAt: new Date(now.getTime() - hour) }),
];

describe('SQL and pure dashboard SLA classifier parity (read-only synthetic fixtures)', () => {
  it.each(fixtures)('$label', async (fixture) => {
    await expect(sqlState(fixture)).resolves.toBe(pureState(fixture));
  });
});
