export type DashboardSlaState =
  | 'BREACHED'
  | 'DUE_SOON'
  | 'ON_TRACK'
  | 'PAUSED'
  | 'NO_SLA'
  | 'MET'
  | 'MISSED'
  | 'NOT_APPLICABLE'
  | 'UNKNOWN';

export type SlaEvidence = 'resolution-clock' | 'legacy-request' | 'none';

export interface DashboardSla {
  state: DashboardSlaState;
  dueAt: Date | null;
  remainingMs: number | null;
  completedAt: Date | null;
  evidence: SlaEvidence;
}

export interface DashboardSlaInput {
  isTerminal: boolean;
  isPositiveResolution: boolean;
  legacyDueAt: Date | null;
  legacyPausedAt: Date | null;
  resolutionClock?: {
    dueAt: Date | null;
    status: 'ACTIVE' | 'PAUSED' | 'BREACHED' | 'COMPLETED' | 'CANCELLED';
    pausedAt: Date | null;
    completedAt: Date | null;
  } | null;
  /** True when more than one plausible current resolution clock exists. */
  ambiguousResolutionClock?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const POSITIVE_RESOLUTION_STATUSES = new Set(['RESOLVED', 'COMPLETED', 'PAYMENT_COMPLETED']);
const NON_POSITIVE_TERMINAL_STATUSES = new Set([
  'REIMBURSEMENT_CLOSED',
  'TICKET_CLOSED_FIN',
  'REJECTED',
  'CANCELLED',
  'ONBOARDING_COMPLETED',
  'OFFBOARDING_COMPLETED',
  'LOA_ACCEPTED',
  'CEO_REJECTED',
  'CEO_REJECTED_FIN',
  'CTO_REJECTED_IT',
  'CFO_REJECTED_IT',
  'MANAGER_REJECTED_IT',
  'MANAGER_REJECTED_FIN',
  'FINANCE_HEAD_REJECTED',
  'CFO_REJECTED_FIN',
  'GROUP_DCEO_REJECTED',
  'PAYMENT_CONFIRMED_FIN',
  'FROM_ENTITY_REJECTED',
  'TO_ENTITY_REJECTED',
  'CHARGEBACK_COMPLETED',
]);

function validMs(value: Date | null | undefined): number | null {
  if (!value) return null;
  const ms = value.getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function isPositiveResolutionStatus(status: string): boolean {
  return POSITIVE_RESOLUTION_STATUSES.has(status);
}

export function isNonPositiveTerminalStatus(status: string): boolean {
  return NON_POSITIVE_TERMINAL_STATUSES.has(status);
}

function result(
  state: DashboardSlaState,
  dueAt: Date | null,
  remainingMs: number | null,
  completedAt: Date | null,
  evidence: SlaEvidence,
): DashboardSla {
  return { state, dueAt, remainingMs, completedAt, evidence };
}

/** Classify the resolution clock at one fixed server timestamp. */
export function classifyDashboardSla(input: DashboardSlaInput, now: Date): DashboardSla {
  const nowMs = validMs(now);
  if (nowMs === null) return result('UNKNOWN', null, null, null, 'none');

  if (input.isTerminal) {
    if (!input.isPositiveResolution) {
      return result('NOT_APPLICABLE', null, null, null, 'none');
    }

    if (input.ambiguousResolutionClock) return result('UNKNOWN', null, null, null, 'none');
  const clock = input.resolutionClock;
  const dueMs = validMs(clock?.dueAt);
  const completedMs = validMs(clock?.completedAt);
  if (!clock || clock.status !== 'COMPLETED' || dueMs === null || completedMs === null) {
      return result('UNKNOWN', null, null, null, 'none');
    }

    return result(
      completedMs <= dueMs ? 'MET' : 'MISSED',
      clock.dueAt,
      null,
      clock.completedAt,
      'resolution-clock',
    );
  }

  if (input.ambiguousResolutionClock) return result('UNKNOWN', null, null, null, 'none');

  const clock = input.resolutionClock;
  const dueAt = clock ? clock.dueAt : input.legacyDueAt;
  const evidence: SlaEvidence = clock ? 'resolution-clock' : dueAt ? 'legacy-request' : 'none';
  const dueMs = validMs(dueAt);
  if (dueAt && dueMs === null) return result('UNKNOWN', null, null, null, evidence);
  if (!dueAt) return result('NO_SLA', null, null, null, 'none');
  if (dueMs === null) return result('UNKNOWN', null, null, null, evidence);

  if (clock) {
    if (clock.status === 'PAUSED') {
      if (!clock.pausedAt) return result('UNKNOWN', null, null, null, evidence);
    } else if (clock.status === 'ACTIVE' || clock.status === 'BREACHED') {
      if (clock.pausedAt || (clock.status === 'BREACHED' && dueMs > nowMs)) {
        return result('UNKNOWN', null, null, null, evidence);
      }
    } else {
      return result('UNKNOWN', null, null, null, evidence);
    }
    if (input.legacyPausedAt && clock.status !== 'PAUSED') {
      return result('UNKNOWN', null, null, null, evidence);
    }
  }

  const isPaused = clock
    ? clock.status === 'PAUSED'
    : input.legacyPausedAt !== null;
  if (isPaused) {
    const pausedAt = clock?.pausedAt ?? input.legacyPausedAt;
    const pausedMs = validMs(pausedAt);
    if (pausedAt && pausedMs === null) return result('UNKNOWN', null, null, null, evidence);
    // Freeze the displayed duration at the moment the current pause began.
    const remainingAtPause = dueMs - (pausedMs ?? nowMs);
    return result('PAUSED', dueAt, remainingAtPause, null, evidence);
  }

  const remainingMs = dueMs - nowMs;
  if (remainingMs <= 0) return result('BREACHED', dueAt, remainingMs, null, evidence);
  if (remainingMs <= DAY_MS) return result('DUE_SOON', dueAt, remainingMs, null, evidence);
  return result('ON_TRACK', dueAt, remainingMs, null, evidence);
}
