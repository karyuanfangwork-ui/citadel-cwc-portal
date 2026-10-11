import {
  classifyDashboardSla,
  DashboardSlaInput,
  isNonPositiveTerminalStatus,
  isPositiveResolutionStatus,
} from '../agent-dashboard-sla.service';

const now = new Date('2026-10-10T12:00:00.000Z');
const hour = 60 * 60 * 1000;
const day = 24 * hour;

function active(dueAt: Date | null, legacyPausedAt: Date | null = null): DashboardSlaInput {
  return {
    isTerminal: false,
    isPositiveResolution: false,
    legacyDueAt: dueAt,
    legacyPausedAt,
  };
}

function completed(dueAt: Date, completedAt: Date): DashboardSlaInput {
  return {
    isTerminal: true,
    isPositiveResolution: true,
    legacyDueAt: null,
    legacyPausedAt: null,
    resolutionClock: { dueAt, completedAt, pausedAt: null, status: 'COMPLETED' },
  };
}

describe('classifyDashboardSla', () => {
  it.each([
    ['deadline passed', new Date(now.getTime() - 1), 'BREACHED'],
    ['deadline now', now, 'BREACHED'],
    ['deadline one millisecond away', new Date(now.getTime() + 1), 'DUE_SOON'],
    ['deadline exactly 24 hours away', new Date(now.getTime() + day), 'DUE_SOON'],
    ['deadline beyond 24 hours', new Date(now.getTime() + day + 1), 'ON_TRACK'],
  ] as const)('classifies active request at %s', (_label, dueAt, expected) => {
    expect(classifyDashboardSla(active(dueAt), now).state).toBe(expected);
  });

  it('freezes remaining time while paused and gives pause state precedence over breach', () => {
    const dueAt = new Date(now.getTime() - hour);
    const pausedAt = new Date(now.getTime() - 30 * 60 * 1000);
    const result = classifyDashboardSla(active(dueAt, pausedAt), now);

    expect(result.state).toBe('PAUSED');
    expect(result.remainingMs).toBe(-(30 * 60 * 1000));
  });

  it('uses a unique active resolution clock and rejects inconsistent clock evidence', () => {
    const dueAt = new Date(now.getTime() + hour);
    const clockInput: DashboardSlaInput = {
      ...active(new Date(now.getTime() - day)),
      resolutionClock: { dueAt, completedAt: null, pausedAt: null, status: 'ACTIVE' },
    };
    expect(classifyDashboardSla(clockInput, now).state).toBe('DUE_SOON');

    const staleBreachFlag: DashboardSlaInput = {
      ...clockInput,
      resolutionClock: { ...clockInput.resolutionClock!, status: 'BREACHED' },
    };
    expect(classifyDashboardSla(staleBreachFlag, now).state).toBe('UNKNOWN');

    const pausedWithoutTimestamp: DashboardSlaInput = {
      ...clockInput,
      resolutionClock: { ...clockInput.resolutionClock!, status: 'PAUSED' },
    };
    expect(classifyDashboardSla(pausedWithoutTimestamp, now).state).toBe('UNKNOWN');
  });

  it('returns NO_SLA when an active request has no deadline', () => {
    expect(classifyDashboardSla(active(null), now).state).toBe('NO_SLA');
  });

  it('returns UNKNOWN for invalid timestamps and ambiguous clock selection', () => {
    const invalid = active(new Date(Number.NaN));
    expect(classifyDashboardSla(invalid, now).state).toBe('UNKNOWN');
    expect(classifyDashboardSla({ ...active(new Date(now.getTime() + hour)), ambiguousResolutionClock: true }, now).state).toBe('UNKNOWN');
  });

  it('classifies terminal success only from completed resolution-clock evidence', () => {
    expect(classifyDashboardSla(completed(new Date(now.getTime() + hour), now), now).state).toBe('MET');
    expect(classifyDashboardSla(completed(new Date(now.getTime() - hour), now), now).state).toBe('MISSED');

    const withoutEvidence: DashboardSlaInput = {
      isTerminal: true,
      isPositiveResolution: true,
      legacyDueAt: new Date(now.getTime() + hour),
      legacyPausedAt: null,
    };
    expect(classifyDashboardSla(withoutEvidence, now).state).toBe('UNKNOWN');
  });

  it('does not treat cancelled/rejected terminal work as resolved or SLA-breached', () => {
    const terminal: DashboardSlaInput = {
      isTerminal: true,
      isPositiveResolution: false,
      legacyDueAt: new Date(now.getTime() - day),
      legacyPausedAt: null,
    };
    expect(classifyDashboardSla(terminal, now).state).toBe('NOT_APPLICABLE');
  });
});

describe('resolution outcome compatibility', () => {
  it.each(['RESOLVED', 'COMPLETED', 'PAYMENT_COMPLETED'])('%s is positive', (status) => {
    expect(isPositiveResolutionStatus(status)).toBe(true);
  });

  it.each(['CANCELLED', 'REJECTED', 'REIMBURSEMENT_CLOSED'])('%s is non-positive terminal work', (status) => {
    expect(isNonPositiveTerminalStatus(status)).toBe(true);
  });
});
