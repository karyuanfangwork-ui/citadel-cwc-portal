import { jest } from '@jest/globals';
const snapshotFindFirstMock = jest.fn();
const snapshotFindManyMock = jest.fn();
const snapshotCreateMock = jest.fn();
jest.mock('../../../utils/prisma', () => ({ __esModule: true, default: { applicationSnapshot: { findFirst: snapshotFindFirstMock, findMany: snapshotFindManyMock, create: snapshotCreateMock } } }));
const getCaMemoDataMock = jest.fn();
jest.mock('../caMemoPdf.service', () => ({ getCaMemoData: getCaMemoDataMock }));
const linkStatementsMock = jest.fn();
jest.mock('../statementLinking.service', () => ({ linkStatementsToApplication: linkStatementsMock }));
import { clearTransitionHooks, runTransitionHooks } from '../transitionHooks';
import { hashPayload } from '../snapshotHash';
import { registerSnapshotHook, resolveSnapshotType, SNAPSHOT_ACTIONS, takeApplicationSnapshot } from '../applicationSnapshot.service';

const memo = { id: 'app-1', borrowerProfile: { name: 'Acme' } };
const ctx = (over: Record<string, unknown> = {}) => ({ applicationId: 'app-1', action: 'approve', fromState: 'COMMITTEE_REVIEW', toState: 'APPROVED', actorId: 'user-1', ...over });
beforeEach(() => { jest.clearAllMocks(); clearTransitionHooks(); getCaMemoDataMock.mockResolvedValue(memo); linkStatementsMock.mockResolvedValue({ linked: 0, alreadyLinked: 0 }); snapshotFindFirstMock.mockResolvedValue(null); snapshotCreateMock.mockResolvedValue({ id: 'snap-1' }); });

describe('application snapshots', () => {
  it('has exactly four lifecycle actions and maps them to two types', () => {
    expect([...SNAPSHOT_ACTIONS].sort()).toEqual(['approve', 'reject', 'resume_committee', 'submit_to_committee']);
    expect(resolveSnapshotType('submit_to_committee')).toBe('COMMITTEE_SUBMISSION');
    expect(resolveSnapshotType('approve')).toBe('FINAL_DECISION');
    expect(resolveSnapshotType('reject_kyc')).toBeNull();
  });
  it('links before building a committee snapshot and persists the hash', async () => {
    await takeApplicationSnapshot(ctx({ action: 'submit_to_committee', toState: 'COMMITTEE_REVIEW' }));
    expect(linkStatementsMock).toHaveBeenCalledWith('app-1');
    expect(getCaMemoDataMock).toHaveBeenCalledWith('app-1');
    expect(snapshotCreateMock).toHaveBeenCalledWith({ data: expect.objectContaining({ snapshotType: 'COMMITTEE_SUBMISSION', payload: memo, hash: hashPayload(memo) }) });
  });
  it('deduplicates the latest snapshot of the same type', async () => {
    snapshotFindFirstMock.mockResolvedValue({ id: 'old', hash: hashPayload(memo) });
    await expect(takeApplicationSnapshot(ctx({ action: 'resume_committee' }))).resolves.toMatchObject({ skipped: true, snapshotId: 'old' });
    expect(snapshotCreateMock).not.toHaveBeenCalled();
  });
  it('scopes the dedupe lookup to the same snapshot type, so a FINAL_DECISION matching its COMMITTEE_SUBMISSION still writes', async () => {
    await takeApplicationSnapshot(ctx({ action: 'approve' }));
    expect(snapshotFindFirstMock).toHaveBeenCalledWith({
      where: { applicationId: 'app-1', snapshotType: 'FINAL_DECISION' },
      orderBy: { takenAt: 'desc' },
      select: { id: true, hash: true },
    });
  });
  it('is a no-op for an action that is not a write point', async () => {
    await expect(takeApplicationSnapshot(ctx({ action: 'withdraw' }))).resolves.toMatchObject({ skipped: true, snapshotId: null, snapshotType: null });
    expect(getCaMemoDataMock).not.toHaveBeenCalled();
    expect(snapshotCreateMock).not.toHaveBeenCalled();
  });
  it('registers a non-blocking hook', async () => {
    registerSnapshotHook();
    await expect(runTransitionHooks(ctx())).resolves.toEqual([{ name: 'application-snapshot', ok: true, error: null }]);
    getCaMemoDataMock.mockRejectedValue(new Error('memo failed'));
    clearTransitionHooks(); registerSnapshotHook();
    await expect(runTransitionHooks(ctx())).resolves.toEqual([{ name: 'application-snapshot', ok: false, error: 'memo failed' }]);
  });
});
