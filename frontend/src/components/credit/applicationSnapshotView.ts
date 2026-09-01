import type { ApplicationSnapshotSummary } from '../../services/credit.service';

/**
 * CA-P1-004 / GAP-P1-01(c) — decide whether Application 360 is showing frozen
 * decision context or live master data.
 */
export const DECIDED_STATES = [
  'APPROVED',
  'REJECTED',
  'CONDITION_FULFILMENT',
  'OFFER',
  'ACCEPTED',
  'DISBURSED',
  'ACTIVE',
  'CLOSED',
] as const;

export type SnapshotViewMode = 'live' | 'snapshot' | 'decided-without-snapshot';

export interface SnapshotResolution {
  mode: SnapshotViewMode;
  snapshot: ApplicationSnapshotSummary | null;
}

export function isDecidedState(state: string | null | undefined): boolean {
  if (!state) return false;
  return (DECIDED_STATES as readonly string[]).includes(state);
}

/** Return the newest FINAL_DECISION snapshot, never a committee submission. */
export function selectDecisionSnapshot(
  snapshots: ApplicationSnapshotSummary[],
): ApplicationSnapshotSummary | null {
  const decisions = snapshots.filter((snapshot) => snapshot.snapshotType === 'FINAL_DECISION');
  if (decisions.length === 0) return null;

  return decisions.reduce((newest, candidate) =>
    new Date(candidate.takenAt).getTime() > new Date(newest.takenAt).getTime() ? candidate : newest,
  );
}

export function resolveSnapshotMode(
  state: string | null | undefined,
  snapshots: ApplicationSnapshotSummary[],
): SnapshotResolution {
  if (!isDecidedState(state)) return { mode: 'live', snapshot: null };

  const snapshot = selectDecisionSnapshot(snapshots);
  return snapshot
    ? { mode: 'snapshot', snapshot }
    : { mode: 'decided-without-snapshot', snapshot: null };
}
