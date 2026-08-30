import { enforceCreditSOD, enforceCommitteeSOD } from '../sod.middleware';
import { AppError } from '../../../middleware/error.middleware';
import prisma from '../../../utils/prisma';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../../utils/prisma', () => {
  const mockAppFindUnique = jest.fn();
  const mockAuditFindFirst = jest.fn();
  const mockAgendaFindUnique = jest.fn();
  return {
    __esModule: true,
    default: {
      creditApplication: {
        findUnique: mockAppFindUnique,
      },
      creditAuditEvent: {
        findFirst: mockAuditFindFirst,
      },
      committeeAgendaItem: {
        findUnique: mockAgendaFindUnique,
      },
    },
  };
});

jest.mock('../../services/auditChain.service', () => ({
  AuditChainService: {
    appendEvent: jest.fn().mockResolvedValue('mock-event-id'),
  },
}));

import { AuditChainService } from '../../services/auditChain.service';

const mockedPrisma = prisma as unknown as {
  creditApplication: { findUnique: jest.Mock };
  creditAuditEvent: { findFirst: jest.Mock };
  committeeAgendaItem: { findUnique: jest.Mock };
};

const mockedAuditAppend = AuditChainService.appendEvent as jest.Mock;

// ── Helpers ───────────────────────────────────────────────────────────────────

// Valid UUIDs for params that are now validated as UUIDs
const APP_ID = '00000000-0000-0000-0000-000000000001';
const ITEM_ID = '00000000-0000-4000-8000-000000000002';

function makeReq(overrides: Partial<{ id: string; roles: string[] }> = {})
 {
  return {
    user: {
      id: overrides.id ?? 'user-1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      roles: overrides.roles ?? ['CREDIT_MANAGER'],
      permissions: ['credit:approve'],
    },
    params: { id: APP_ID },
  } as any;
}

function makeCommitteeReq(overrides: Partial<{ id: string; roles: string[] }> = {})
 {
  return {
    user: {
      id: overrides.id ?? 'user-1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      roles: overrides.roles ?? ['CREDIT_MANAGER'],
      permissions: ['credit:approve'],
    },
    params: { itemId: ITEM_ID },
  } as any;
}
function makeRes() {
  return {} as any;
}

function resetMocks() {
  mockedPrisma.creditApplication.findUnique.mockReset();
  mockedPrisma.creditAuditEvent.findFirst.mockReset();
  mockedPrisma.committeeAgendaItem.findUnique.mockReset();
  mockedAuditAppend.mockClear();
}

// ── enforceCreditSOD tests ────────────────────────────────────────────────────

describe('enforceCreditSOD', () => {
  beforeEach(resetMocks);

  // ── Rule 1: RM-self ───────────────────────────────────────────────────────

  describe('Rule 1 — assigned RM cannot approve their own application', () => {
    it('blocks a CREDIT_ADMIN who is the assigned RM from approving', async () => {
      const req = makeReq({ id: 'rm-user', roles: ['CREDIT_ADMIN'] });
      mockedPrisma.creditApplication.findUnique.mockResolvedValue({
        assignedRmId: 'rm-user',
        assignedAnalystId: null,
      });

      const middleware = enforceCreditSOD();
      const next = jest.fn();

      await middleware(req, makeRes(), next);

      expect(next).not.toHaveBeenCalledWith();
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain('Segregation of Duties');
      expect(error.message).toContain('Relationship Manager');
    });

    it('blocks an ADMIN who is the assigned RM from approving', async () => {
      const req = makeReq({ id: 'rm-user', roles: ['ADMIN'] });
      mockedPrisma.creditApplication.findUnique.mockResolvedValue({
        assignedRmId: 'rm-user',
        assignedAnalystId: null,
      });

      const middleware = enforceCreditSOD();
      const next = jest.fn();

      await middleware(req, makeRes(), next);

      expect(next).not.toHaveBeenCalledWith();
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain('Segregation of Duties');
      expect(error.message).toContain('Relationship Manager');
    });

    it('allows a different user (not the RM) to proceed', async () => {
      const req = makeReq({ id: 'other-user', roles: ['CREDIT_MANAGER'] });
      mockedPrisma.creditApplication.findUnique.mockResolvedValue({
        assignedRmId: 'rm-user',
        assignedAnalystId: null,
      });
      mockedPrisma.creditAuditEvent.findFirst.mockResolvedValue(null);

      const middleware = enforceCreditSOD();
      const next = jest.fn();

      await middleware(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(); // called with no error
    });
  });

  // ── Rule 2: Maker-checker ──────────────────────────────────────────────────

  describe('Rule 2 — maker-checker constraint', () => {
    it('blocks a CREDIT_ADMIN who originated the last state transition from approving', async () => {
      const req = makeReq({ id: 'maker-user', roles: ['CREDIT_ADMIN'] });
      mockedPrisma.creditApplication.findUnique.mockResolvedValue({
        assignedRmId: 'different-rm',
        assignedAnalystId: null,
      });
      mockedPrisma.creditAuditEvent.findFirst.mockResolvedValue({
        actorId: 'maker-user',
        oldState: 'DRAFT',
        newState: 'PENDING',
      });

      const middleware = enforceCreditSOD();
      const next = jest.fn();

      await middleware(req, makeRes(), next);

      expect(next).not.toHaveBeenCalledWith();
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain('maker-checker');
    });

    it('blocks an ADMIN who originated the last state transition from approving', async () => {
      const req = makeReq({ id: 'maker-user', roles: ['ADMIN'] });
      mockedPrisma.creditApplication.findUnique.mockResolvedValue({
        assignedRmId: 'different-rm',
        assignedAnalystId: null,
      });
      mockedPrisma.creditAuditEvent.findFirst.mockResolvedValue({
        actorId: 'maker-user',
        oldState: 'DRAFT',
        newState: 'PENDING',
      });

      const middleware = enforceCreditSOD();
      const next = jest.fn();

      await middleware(req, makeRes(), next);

      expect(next).not.toHaveBeenCalledWith();
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain('maker-checker');
    });

    it('allows a different user to approve a transition they did not originate', async () => {
      const req = makeReq({ id: 'approver-user', roles: ['CREDIT_MANAGER'] });
      mockedPrisma.creditApplication.findUnique.mockResolvedValue({
        assignedRmId: 'rm-user',
        assignedAnalystId: null,
      });
      mockedPrisma.creditAuditEvent.findFirst.mockResolvedValue({
        actorId: 'maker-user',
        oldState: 'DRAFT',
        newState: 'PENDING',
      });

      const middleware = enforceCreditSOD();
      const next = jest.fn();

      await middleware(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(); // called with no error
    });

    it('allows same user if last event was a field-only update (oldState === newState)', async () => {
      const req = makeReq({ id: 'same-user', roles: ['CREDIT_MANAGER'] });
      mockedPrisma.creditApplication.findUnique.mockResolvedValue({
        assignedRmId: 'rm-user',
        assignedAnalystId: null,
      });
      mockedPrisma.creditAuditEvent.findFirst.mockResolvedValue({
        actorId: 'same-user',
        oldState: 'PENDING',
        newState: 'PENDING',
      });

      const middleware = enforceCreditSOD();
      const next = jest.fn();

      await middleware(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(); // called with no error
    });
  });

  // ── ADMIN bypass for authority-level checks ─────────────────────────────────

  describe('ADMIN bypass — authority-level short-circuit', () => {
    it('ADMIN who is NOT the RM and NOT the maker proceeds and logs SOD_BYPASSED audit event', async () => {
      const req = makeReq({ id: 'admin-user', roles: ['ADMIN'] });
      mockedPrisma.creditApplication.findUnique.mockResolvedValue({
        assignedRmId: 'rm-user',
        assignedAnalystId: null,
      });
      mockedPrisma.creditAuditEvent.findFirst.mockResolvedValue({
        actorId: 'different-maker',
        oldState: 'DRAFT',
        newState: 'PENDING',
      });

      const middleware = enforceCreditSOD();
      const next = jest.fn();

      await middleware(req, makeRes(), next);

      // ADMIN should pass through since they're not RM or maker
      expect(next).toHaveBeenCalledWith();
      // SOD_BYPASSED audit event should have been logged
      expect(mockedAuditAppend).toHaveBeenCalledWith(
        APP_ID,
        'SOD_BYPASSED',
        'admin-user',
        'SOD bypassed by ADMIN',
        undefined,
        undefined,
        { rule: 'authority-bypass', roles: ['ADMIN'] },
      );
    });

    it('CREDIT_ADMIN who is NOT the RM and NOT the maker proceeds and logs SOD_BYPASSED', async () => {
      const req = makeReq({ id: 'credit-admin-user', roles: ['CREDIT_ADMIN'] });
      mockedPrisma.creditApplication.findUnique.mockResolvedValue({
        assignedRmId: 'rm-user',
        assignedAnalystId: null,
      });
      mockedPrisma.creditAuditEvent.findFirst.mockResolvedValue({
        actorId: 'different-maker',
        oldState: 'DRAFT',
        newState: 'PENDING',
      });

      const middleware = enforceCreditSOD();
      const next = jest.fn();

      await middleware(req, makeRes(), next);

      expect(next).toHaveBeenCalledWith();
      expect(mockedAuditAppend).toHaveBeenCalledWith(
        APP_ID,
        'SOD_BYPASSED',
        'credit-admin-user',
        'SOD bypassed by CREDIT_ADMIN',
        undefined,
        undefined,
        { rule: 'authority-bypass', roles: ['CREDIT_ADMIN'] },
      );
    });

    it('ADMIN who IS the RM is still blocked (Rule 1 holds)', async () => {
      const req = makeReq({ id: 'rm-user', roles: ['ADMIN'] });
      mockedPrisma.creditApplication.findUnique.mockResolvedValue({
        assignedRmId: 'rm-user',
        assignedAnalystId: null,
      });

      const middleware = enforceCreditSOD();
      const next = jest.fn();

      await middleware(req, makeRes(), next);

      expect(next).not.toHaveBeenCalledWith();
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(403);
      // No SOD_BYPASSED should be logged because they were blocked
      expect(mockedAuditAppend).not.toHaveBeenCalled();
    });
  });
});

// GAP-P1-03 — maker-checker must order by sequence, never createdAt.
describe('enforceCreditSOD — Rule 2 ordering (GAP-P1-03)', () => {
  beforeEach(resetMocks);

  it('queries the audit chain ordered by sequence', async () => {
    const req = makeReq({ id: 'approver-user', roles: ['CREDIT_MANAGER'] });
    mockedPrisma.creditApplication.findUnique.mockResolvedValue({ assignedRmId: 'rm-user', assignedAnalystId: null });
    mockedPrisma.creditAuditEvent.findFirst.mockResolvedValue(null);

    await enforceCreditSOD()(req, makeRes(), jest.fn());

    expect(mockedPrisma.creditAuditEvent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { sequence: 'desc' } }),
    );
    expect(mockedPrisma.creditAuditEvent.findFirst.mock.calls[0][0].orderBy).not.toHaveProperty('createdAt');
  });

  it('blocks the maker identified by the highest sequence when timestamps tie', async () => {
    const sameInstant = new Date('2026-08-29T10:00:00.000Z');
    const chain = [
      { sequence: 5, createdAt: sameInstant, actorId: 'other-user', oldState: 'UNDERWRITING', newState: 'CREDIT_ASSESSMENT' },
      { sequence: 6, createdAt: sameInstant, actorId: 'maker-user', oldState: 'CREDIT_ASSESSMENT', newState: 'COMMITTEE_REVIEW' },
    ];
    mockedPrisma.creditApplication.findUnique.mockResolvedValue({ assignedRmId: 'rm-user', assignedAnalystId: null });
    mockedPrisma.creditAuditEvent.findFirst.mockImplementation(async (args: any) =>
      args?.orderBy?.sequence === 'desc' ? chain[1] : chain[0]);

    const next = jest.fn();
    await enforceCreditSOD()(makeReq({ id: 'maker-user', roles: ['CREDIT_MANAGER'] }), makeRes(), next);

    expect(next.mock.calls[0][0]).toBeInstanceOf(AppError);
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });

  it('allows a non-maker to approve when sequences tie on time', async () => {
    mockedPrisma.creditApplication.findUnique.mockResolvedValue({ assignedRmId: 'rm-user', assignedAnalystId: null });
    mockedPrisma.creditAuditEvent.findFirst.mockResolvedValue({
      sequence: 6, createdAt: new Date('2026-08-29T10:00:00.000Z'), actorId: 'maker-user',
      oldState: 'CREDIT_ASSESSMENT', newState: 'COMMITTEE_REVIEW',
    });

    const next = jest.fn();
    await enforceCreditSOD()(makeReq({ id: 'different-approver', roles: ['CREDIT_MANAGER'] }), makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });
});

// ── enforceCommitteeSOD tests ─────────────────────────────────────────────────

describe('enforceCommitteeSOD', () => {
  beforeEach(resetMocks);

  describe('Rule 1 — assigned RM cannot vote on their own application (committee context)', () => {
    it('blocks CREDIT_ADMIN who is the assigned RM from voting', async () => {
      const req = makeCommitteeReq({ id: 'rm-user', roles: ['CREDIT_ADMIN'] });
      mockedPrisma.committeeAgendaItem.findUnique.mockResolvedValue({
        applicationId: APP_ID,
      });
      mockedPrisma.creditApplication.findUnique.mockResolvedValue({
        assignedRmId: 'rm-user',
        assignedAnalystId: null,
      });

      const middleware = enforceCommitteeSOD();
      const next = jest.fn();

      await middleware(req, makeRes(), next);

      expect(next).not.toHaveBeenCalledWith();
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(403);
    });

    it('blocks ADMIN who is the assigned RM from voting', async () => {
      const req = makeCommitteeReq({ id: 'rm-user', roles: ['ADMIN'] });
      mockedPrisma.committeeAgendaItem.findUnique.mockResolvedValue({
        applicationId: APP_ID,
      });
      mockedPrisma.creditApplication.findUnique.mockResolvedValue({
        assignedRmId: 'rm-user',
        assignedAnalystId: null,
      });

      const middleware = enforceCommitteeSOD();
      const next = jest.fn();

      await middleware(req, makeRes(), next);

      expect(next).not.toHaveBeenCalledWith();
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(403);
    });
  });

  describe('Rule 2 — maker-checker in committee context', () => {
    it('blocks CREDIT_ADMIN who originated the last transition from voting', async () => {
      const req = makeCommitteeReq({ id: 'maker-user', roles: ['CREDIT_ADMIN'] });
      mockedPrisma.committeeAgendaItem.findUnique.mockResolvedValue({
        applicationId: APP_ID,
      });
      mockedPrisma.creditApplication.findUnique.mockResolvedValue({
        assignedRmId: 'different-rm',
        assignedAnalystId: null,
      });
      mockedPrisma.creditAuditEvent.findFirst.mockResolvedValue({
        actorId: 'maker-user',
        oldState: 'DRAFT',
        newState: 'PENDING',
      });

      const middleware = enforceCommitteeSOD();
      const next = jest.fn();

      await middleware(req, makeRes(), next);

      expect(next).not.toHaveBeenCalledWith();
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain('maker-checker');
    });
  });

  describe('ADMIN bypass logs SOD_BYPASSED (committee context)', () => {
    it('ADMIN not the RM and not the maker passes and logs SOD_BYPASSED', async () => {
      const req = makeCommitteeReq({ id: 'admin-user', roles: ['ADMIN'] });
      mockedPrisma.committeeAgendaItem.findUnique.mockResolvedValue({
        applicationId: APP_ID,
      });
      mockedPrisma.creditApplication.findUnique.mockResolvedValue({
        assignedRmId: 'rm-user',
        assignedAnalystId: null,
      });
      mockedPrisma.creditAuditEvent.findFirst.mockResolvedValue({
        actorId: 'different-maker',
        oldState: 'DRAFT',
        newState: 'PENDING',
      });

      const middleware = enforceCommitteeSOD();
      const next = jest.fn();

      await middleware(req, makeRes(), next);

      expect(next).toHaveBeenCalledWith();
      expect(mockedAuditAppend).toHaveBeenCalledWith(
        APP_ID,
        'SOD_BYPASSED',
        'admin-user',
        'SOD bypassed by ADMIN',
        undefined,
        undefined,
        { rule: 'authority-bypass', roles: ['ADMIN'] },
      );
    });
  });
});