// backend/src/credit/services/__tests__/returnDiff.test.ts
jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: { creditAuditEvent: { findMany: jest.fn() } },
}));

import prisma from '../../../utils/prisma';
import { getReturnChangeDiff } from '../creditApplication.service';

const findMany = (prisma as any).creditAuditEvent.findMany as jest.Mock;

describe('LOS-015 — getReturnChangeDiff', () => {
  it('returns an empty diff when the application was never returned', async () => {
    findMany.mockResolvedValueOnce([]);
    const diff = await getReturnChangeDiff('app-1');
    expect(diff.returnedAt).toBeNull();
    expect(diff.changes).toEqual([]);
  });

  it('lists only events after the most recent return', async () => {
    findMany.mockResolvedValueOnce([
      { id: 'e1', createdAt: new Date('2026-08-01T00:00:00Z'), actorId: 'u1', eventType: 'FINANCIAL', action: 'update', oldState: null, newState: null, metadata: {} },
      { id: 'e2', createdAt: new Date('2026-08-02T00:00:00Z'), actorId: 'rev', eventType: 'APPROVAL', action: 'return', oldState: 'COMMITTEE_REVIEW', newState: 'REFERRED_BACK', metadata: { comment: 'DSR evidence missing' } },
      { id: 'e3', createdAt: new Date('2026-08-03T00:00:00Z'), actorId: 'u1', eventType: 'DOCUMENT', action: 'upload', oldState: null, newState: null, metadata: {} },
    ]);
    const diff = await getReturnChangeDiff('app-1');
    expect(diff.returnedAt).toBe('2026-08-02T00:00:00.000Z');
    expect(diff.returnReason).toBe('DSR evidence missing');
    expect(diff.returnedBy).toBe('rev');
    expect(diff.changes.map((c) => c.action)).toEqual(['upload']);
  });

  it('uses the latest return when the application was returned twice', async () => {
    findMany.mockResolvedValueOnce([
      { id: 'e1', createdAt: new Date('2026-08-01T00:00:00Z'), actorId: 'rev', eventType: 'APPROVAL', action: 'return', oldState: 'COMMITTEE_REVIEW', newState: 'REFERRED_BACK', metadata: { comment: 'first' } },
      { id: 'e2', createdAt: new Date('2026-08-02T00:00:00Z'), actorId: 'u1', eventType: 'DOCUMENT', action: 'upload', oldState: null, newState: null, metadata: {} },
      { id: 'e3', createdAt: new Date('2026-08-03T00:00:00Z'), actorId: 'rev', eventType: 'APPROVAL', action: 'return', oldState: 'COMMITTEE_REVIEW', newState: 'REFERRED_BACK', metadata: { comment: 'second' } },
      { id: 'e4', createdAt: new Date('2026-08-04T00:00:00Z'), actorId: 'u1', eventType: 'FINANCIAL', action: 'update', oldState: null, newState: null, metadata: {} },
    ]);
    const diff = await getReturnChangeDiff('app-1');
    expect(diff.returnReason).toBe('second');
    expect(diff.changes.map((c) => c.action)).toEqual(['update']);
  });
});