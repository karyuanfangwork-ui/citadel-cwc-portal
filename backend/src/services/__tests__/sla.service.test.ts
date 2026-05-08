import prisma from '../../utils/prisma';
import { checkSlaBreaches, checkEscalations } from '../sla.service';

// ── Mock Prisma (inline object, hoisted properly by Jest) ────────────────────
jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    request: { findMany: jest.fn() },
    requestActivity: { create: jest.fn(), findFirst: jest.fn() },
    escalationRule: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
  },
}));

jest.mock('../notification.service', () => ({
  notifyMultiple: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

const mockPrisma = prisma as unknown as {
  request: { findMany: jest.Mock };
  requestActivity: { create: jest.Mock; findFirst: jest.Mock };
  escalationRule: { findMany: jest.Mock };
  user: { findMany: jest.Mock };
};

const { notifyMultiple } = require('../notification.service');
const mockNotifyMultiple = notifyMultiple as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.requestActivity.create.mockResolvedValue({ id: 'activity-1' });
});

// ── checkSlaBreaches ──────────────────────────────────────────────────────

describe('checkSlaBreaches', () => {
  it('returns 0 when no breached requests exist', async () => {
    mockPrisma.request.findMany.mockResolvedValue([]);

    const result = await checkSlaBreaches();

    expect(result).toBe(0);
    expect(mockPrisma.requestActivity.create).not.toHaveBeenCalled();
  });

  it('creates activity and notifications for newly breached requests', async () => {
    const breachedReq = {
      id: 'req-1',
      referenceNumber: 'IT-001',
      requesterId: 'user-1',
      assignedToId: 'agent-1',
      slaDueAt: new Date('2025-01-01'),
      activities: [],
    };

    mockPrisma.request.findMany.mockResolvedValue([breachedReq]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'admin-1' },
      { id: 'agent-1' },
    ]);

    const result = await checkSlaBreaches();

    expect(result).toBe(1);
    expect(mockPrisma.requestActivity.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.requestActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requestId: 'req-1',
          activityType: 'SYSTEM',
          message: 'SLA BREACH: This request has exceeded its SLA deadline.',
        }),
      }),
    );
    expect(mockNotifyMultiple).toHaveBeenCalledTimes(1);
  });

  it('skips requests that already have a breach activity', async () => {
    const alreadyNotified = {
      id: 'req-2',
      referenceNumber: 'IT-002',
      requesterId: 'user-2',
      assignedToId: null,
      slaDueAt: new Date('2025-01-01'),
      activities: [{ id: 'a1', activityType: 'SYSTEM', message: 'SLA BREACH: ...' }],
    };

    mockPrisma.request.findMany.mockResolvedValue([alreadyNotified]);

    const result = await checkSlaBreaches();

    expect(result).toBe(0);
    expect(mockPrisma.requestActivity.create).not.toHaveBeenCalled();
  });

  it('includes assignee and admins in notification, deduplicating', async () => {
    const breachedReq = {
      id: 'req-3',
      referenceNumber: 'IT-003',
      requesterId: 'user-3',
      assignedToId: 'agent-3',
      slaDueAt: new Date('2025-01-01'),
      activities: [],
    };

    mockPrisma.request.findMany.mockResolvedValue([breachedReq]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'admin-1' },
      { id: 'agent-3' },
    ]);

    await checkSlaBreaches();

    const calledIds = mockNotifyMultiple.mock.calls[0][0];
    expect(calledIds).toContain('agent-3');
    expect(calledIds).toContain('admin-1');
    expect(calledIds.length).toBe(2);
  });

  it('returns 0 and logs error when an exception occurs', async () => {
    mockPrisma.request.findMany.mockRejectedValue(new Error('DB connection lost'));

    const result = await checkSlaBreaches();

    expect(result).toBe(0);
    const { logger } = require('../../utils/logger');
    expect(logger.error).toHaveBeenCalledWith('SLA breach check failed', expect.any(Object));
  });

  it('verifies findMany query includes slaPausedAt: null filter', async () => {
    mockPrisma.request.findMany.mockResolvedValue([]);

    await checkSlaBreaches();

    const callArgs = mockPrisma.request.findMany.mock.calls[0][0];
    expect(callArgs.where.slaPausedAt).toBeNull();
  });
});

// ── checkEscalations ──────────────────────────────────────────────────────

describe('checkEscalations', () => {
  it('returns 0 when no breached requests exist', async () => {
    mockPrisma.request.findMany.mockResolvedValue([]);

    const result = await checkEscalations();

    expect(result).toBe(0);
    expect(mockPrisma.escalationRule.findMany).not.toHaveBeenCalled();
  });

  it('fires escalation when triggerHoursAfterBreach has passed', async () => {
    const breachedAt = new Date('2025-01-01T00:00:00Z');
    const now = new Date('2025-01-01T05:00:00Z');

    jest.useFakeTimers();
    jest.setSystemTime(now);

    const breachedReq = {
      id: 'req-1',
      referenceNumber: 'IT-001',
      requesterId: 'user-1',
      requestTypeId: 'type-1',
      slaDueAt: new Date('2024-12-31'),
      activities: [{ metadata: { breachedAt: breachedAt.toISOString() } }],
    };

    mockPrisma.request.findMany.mockResolvedValue([breachedReq]);
    mockPrisma.escalationRule.findMany.mockResolvedValue([{
      id: 'rule-1',
      triggerHoursAfterBreach: 2,
      label: 'Team Lead',
      notifyRoles: ['AGENT', 'ADMIN'],
      requestTypeId: 'type-1',
      isActive: true,
    }]);
    mockPrisma.requestActivity.findFirst.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

    const result = await checkEscalations();

    expect(result).toBe(1);
    expect(mockPrisma.requestActivity.create).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('skips escalation when triggerHoursAfterBreach has NOT passed yet', async () => {
    const breachedAt = new Date('2025-01-01T00:00:00Z');
    const now = new Date('2025-01-01T01:00:00Z');

    jest.useFakeTimers();
    jest.setSystemTime(now);

    const breachedReq = {
      id: 'req-2',
      referenceNumber: 'IT-002',
      requesterId: 'user-2',
      requestTypeId: 'type-1',
      activities: [{ metadata: { breachedAt: breachedAt.toISOString() } }],
    };

    mockPrisma.request.findMany.mockResolvedValue([breachedReq]);
    mockPrisma.escalationRule.findMany.mockResolvedValue([{
      id: 'rule-2',
      triggerHoursAfterBreach: 4,
      label: 'Manager',
      notifyRoles: ['ADMIN'],
      requestTypeId: 'type-1',
      isActive: true,
    }]);

    const result = await checkEscalations();

    expect(result).toBe(0);
    expect(mockPrisma.requestActivity.create).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('skips already-fired escalation for same rule', async () => {
    const breachedAt = new Date('2025-01-01T00:00:00Z');
    const now = new Date('2025-01-01T05:00:00Z');

    jest.useFakeTimers();
    jest.setSystemTime(now);

    const breachedReq = {
      id: 'req-3',
      referenceNumber: 'IT-003',
      requesterId: 'user-3',
      requestTypeId: 'type-1',
      activities: [{ metadata: { breachedAt: breachedAt.toISOString() } }],
    };

    mockPrisma.request.findMany.mockResolvedValue([breachedReq]);
    mockPrisma.escalationRule.findMany.mockResolvedValue([{
      id: 'rule-3',
      triggerHoursAfterBreach: 1,
      label: 'L1',
      notifyRoles: ['AGENT'],
      requestTypeId: 'type-1',
      isActive: true,
    }]);
    mockPrisma.requestActivity.findFirst.mockResolvedValue({ id: 'existing-escalation' });

    const result = await checkEscalations();

    expect(result).toBe(0);
    expect(mockPrisma.requestActivity.create).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('skips requests without breach activity metadata', async () => {
    const breachedReq = {
      id: 'req-4',
      referenceNumber: 'IT-004',
      requesterId: 'user-4',
      requestTypeId: 'type-1',
      activities: [{ metadata: null }],
    };

    mockPrisma.request.findMany.mockResolvedValue([breachedReq]);

    const result = await checkEscalations();

    expect(result).toBe(0);
    expect(mockPrisma.escalationRule.findMany).not.toHaveBeenCalled();
  });

  it('skips requests with no breach activity at all', async () => {
    const breachedReq = {
      id: 'req-5',
      referenceNumber: 'IT-005',
      requesterId: 'user-5',
      requestTypeId: 'type-1',
      activities: [],
    };

    mockPrisma.request.findMany.mockResolvedValue([breachedReq]);

    const result = await checkEscalations();

    expect(result).toBe(0);
  });

  it('returns 0 and logs error when an exception occurs', async () => {
    mockPrisma.request.findMany.mockRejectedValue(new Error('DB down'));

    const result = await checkEscalations();

    expect(result).toBe(0);
    const { logger } = require('../../utils/logger');
    expect(logger.error).toHaveBeenCalledWith('SLA escalation check failed', expect.any(Object));
  });

  it('fires multiple escalations when multiple rules pass', async () => {
    const breachedAt = new Date('2025-01-01T00:00:00Z');
    const now = new Date('2025-01-01T10:00:00Z');

    jest.useFakeTimers();
    jest.setSystemTime(now);

    const breachedReq = {
      id: 'req-6',
      referenceNumber: 'IT-006',
      requesterId: 'user-6',
      requestTypeId: 'type-1',
      activities: [{ metadata: { breachedAt: breachedAt.toISOString() } }],
    };

    mockPrisma.request.findMany.mockResolvedValue([breachedReq]);
    mockPrisma.escalationRule.findMany.mockResolvedValue([
      { id: 'rule-a', triggerHoursAfterBreach: 2, label: 'L1 Escalation', notifyRoles: ['AGENT'], requestTypeId: 'type-1', isActive: true },
      { id: 'rule-b', triggerHoursAfterBreach: 6, label: 'L2 Escalation', notifyRoles: ['ADMIN'], requestTypeId: 'type-1', isActive: true },
    ]);
    mockPrisma.requestActivity.findFirst.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

    const result = await checkEscalations();

    expect(result).toBe(2);
    expect(mockPrisma.requestActivity.create).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });
});