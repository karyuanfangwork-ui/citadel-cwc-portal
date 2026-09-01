import {
  DECIDED_STATES,
  isDecidedState,
  selectDecisionSnapshot,
  resolveSnapshotMode,
} from '../applicationSnapshotView';
import type { ApplicationSnapshotSummary } from '../../../services/credit.service';

const snap = (over: Partial<ApplicationSnapshotSummary> = {}): ApplicationSnapshotSummary => ({
  id: 'snap-1',
  snapshotType: 'FINAL_DECISION',
  takenAt: '2026-06-15T10:00:00.000Z',
  triggerAction: 'approve',
  hash: 'a'.repeat(64),
  takenBy: { id: 'u-1', firstName: 'Ada', lastName: 'Lim' },
  ...over,
});

describe('isDecidedState', () => {
  it('treats every post-decision state as decided', () => {
    for (const state of ['APPROVED', 'REJECTED', 'CONDITION_FULFILMENT', 'OFFER', 'ACCEPTED', 'DISBURSED', 'ACTIVE', 'CLOSED']) {
      expect(isDecidedState(state)).toBe(true);
    }
  });

  it('treats in-flight and non-decision terminal states as live', () => {
    for (const state of ['DRAFT', 'SUBMITTED', 'KYC_REVIEW', 'COMPLIANCE_HOLD', 'KYC_APPROVED', 'KYC_REJECTED', 'UNDERWRITING', 'CREDIT_ASSESSMENT', 'COMMITTEE_REVIEW', 'WITHDRAWN', 'REFERRED_BACK']) {
      expect(isDecidedState(state)).toBe(false);
    }
  });

  it('is safe for null, undefined and unknown states', () => {
    expect(isDecidedState(null)).toBe(false);
    expect(isDecidedState(undefined)).toBe(false);
    expect(isDecidedState('SOMETHING_NEW')).toBe(false);
  });

  it('DECIDED_STATES is exactly the eight post-decision states', () => {
    expect([...DECIDED_STATES].sort()).toEqual(
      ['ACCEPTED', 'ACTIVE', 'APPROVED', 'CLOSED', 'CONDITION_FULFILMENT', 'DISBURSED', 'OFFER', 'REJECTED'],
    );
  });
});

describe('selectDecisionSnapshot', () => {
  it('picks the newest FINAL_DECISION snapshot', () => {
    const older = snap({ id: 'old', takenAt: '2026-05-01T00:00:00.000Z' });
    const newer = snap({ id: 'new', takenAt: '2026-06-15T10:00:00.000Z' });
    expect(selectDecisionSnapshot([older, newer])?.id).toBe('new');
    expect(selectDecisionSnapshot([newer, older])?.id).toBe('new');
  });

  it('never picks a COMMITTEE_SUBMISSION snapshot, even a newer one', () => {
    const decision = snap({ id: 'dec', takenAt: '2026-05-01T00:00:00.000Z' });
    const submission = snap({ id: 'sub', snapshotType: 'COMMITTEE_SUBMISSION', takenAt: '2026-07-01T00:00:00.000Z' });
    expect(selectDecisionSnapshot([decision, submission])?.id).toBe('dec');
  });

  it('returns null when there is no decision snapshot', () => {
    expect(selectDecisionSnapshot([])).toBeNull();
    expect(selectDecisionSnapshot([snap({ snapshotType: 'COMMITTEE_SUBMISSION' })])).toBeNull();
  });
});

describe('resolveSnapshotMode', () => {
  it('is snapshot mode when a decided application has a decision snapshot', () => {
    expect(resolveSnapshotMode('APPROVED', [snap()])).toEqual({ mode: 'snapshot', snapshot: snap() });
  });

  it('is decided-without-snapshot when a decided application has none', () => {
    expect(resolveSnapshotMode('APPROVED', [])).toEqual({ mode: 'decided-without-snapshot', snapshot: null });
  });

  it('is decided-without-snapshot when only a committee submission exists', () => {
    expect(resolveSnapshotMode('DISBURSED', [snap({ snapshotType: 'COMMITTEE_SUBMISSION' })])).toEqual({
      mode: 'decided-without-snapshot', snapshot: null,
    });
  });

  it('is live for an in-flight application even when snapshots exist', () => {
    expect(resolveSnapshotMode('COMMITTEE_REVIEW', [snap({ snapshotType: 'COMMITTEE_SUBMISSION' })])).toEqual({ mode: 'live', snapshot: null });
    expect(resolveSnapshotMode('REFERRED_BACK', [snap()])).toEqual({ mode: 'live', snapshot: null });
  });

  it('is live for a withdrawn application, which was never decided', () => {
    expect(resolveSnapshotMode('WITHDRAWN', [snap()])).toEqual({ mode: 'live', snapshot: null });
  });
});
