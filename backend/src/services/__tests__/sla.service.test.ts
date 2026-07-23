import prisma from '../../utils/prisma';
import { checkSlaBreaches, checkEscalations } from '../sla.service';

// ── Mock Prisma (inline object, hoisted properly by Jest) ────────────────────
jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    request: { findMany: jest.fn() },
    requestActivity: { create: jest.fn(), findFirst: jest.fn() },
    requestParticipant: { upsert: jest.fn() },
    slaEscalationEvent: { upsert: jest.fn() },
    outboxEvent: { create: jest.fn() },
    escalationRule: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
  },
}));

jest.mock('../notification.service', () => ({
  notify: jest.fn(),
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
  requestParticipant: { upsert: jest.Mock };
  slaEscalationEvent: { upsert: jest.Mock };
  outboxEvent: { create: jest.Mock };
  escalationRule: { findMany: jest.Mock };
  user: { findMany: jest.Mock };
};

const { notify } = require('../notification.service');
const mockNotify = notify as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.requestActivity.create.mockResolvedValue({ id: 'activity-1' });
  mockPrisma.requestParticipant.upsert.mockResolvedValue({ id: 'participant-1' });
  mockPrisma.slaEscalationEvent.upsert.mockResolvedValue({ id: 'escalation-event-1' });
  mockPrisma.outboxEvent.create.mockResolvedValue({ id: 'outbox-1' });
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
    // notify called for assigned agent
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'agent-1', eventType: 'SLA_BREACHED' }),
    );
  });

  it('skips requests that already have a breach activity', async () => {
    const alreadyNotified = {
      id: 'req-2',
      referenceNumber: 'IT-002',
      requesterId: 'user-2',
      assignedToId: null,
      slaDueAt: new Date('2025-01-01'),
      activities: [{ id: 'a1', activityType: 'SYSTEM', message: 'SLA BRECH: ...' }],
    };

    mockPrisma.request.findMany.mockResolvedValue([alreadyNotified]);
    const result = await checkSlaBreaches();
    expect(result).toBe(0);
    expect(mockPrisma.requestActivity.create).not.toHaveBeenCalled();
  });

  it('includes assignee in notification; falls back to admin when no assignee', async () => {
    const breachedReq = {
      id: 'req-3',
      referenceNumber: 'IT-003',
      requesterId: 'user-3',
      assignedToId: null, // no assignee — should fall back to admin
      slaDueAt: new Date('2025-01-01'),
      activities: [],
    };

    mockPrisma.request.findMany.mockResolvedValue([breachedReq]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'admin-1' },
    ]);

    await checkSlaBreaches();

    // Should notify admin since no assignee
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'admin-1' }),
    );
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

  function breachedRequest(id: string, requesterId: string, breachedAt: Date) {
    return {
      id,
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      referenceNumber: `IT-${id}`,
      requesterId,
      requestTypeId: 'type-1',
      slaDueAt: new Date('2024-12-31'),
      activities: [{ metadata: { breachedAt: breachedAt.toISOString() } }],
    };
  }

  it('fires escalation when triggerHoursAfterBreach has passed', async () => {
    const breachedAt = new Date('2025-01-01T00:00:00Z');
    const now = new Date('2025-01-01T05:00:00Z');

    jest.useFakeTimers();
    jest.setSystemTime(now);
    const breachedReq = breachedRequest('req-1', 'user-1', breachedAt);

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
    expect(mockPrisma.slaEscalationEvent.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.slaEscalationEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_idempotencyKey: { tenantId: 'tenant-1', idempotencyKey: 'req-1:rule:rule-1:level:2' } },
        create: expect.objectContaining({
          tenantId: 'tenant-1',
          departmentId: 'dept-1',
          requestId: 'req-1',
          escalationLevel: 2,
          ruleId: 'rule-1',
          notifyRoles: ['AGENT', 'ADMIN'],
        }),
      }),
    );
    expect(mockPrisma.outboxEvent.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.requestParticipant.upsert).not.toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'admin-1', eventType: 'SLA_ESCALATED' }),
    );

    jest.useRealTimers();
  });

  it('skips escalation when triggerHoursAfterBreach has NOT passed yet', async () => {
    const breachedAt = new Date('2025-01-01T00:00:00Z');
    const now = new Date('2025-01-01T01:00:00Z');

    jest.useFakeTimers();
    jest.setSystemTime(now);

    const breachedReq = breachedRequest('req-2', 'user-2', breachedAt);

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
    expect(mockPrisma.requestParticipant.upsert).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('skips already-fired escalation for same rule', async () => {
    const breachedAt = new Date('2025-01-01T00:00:00Z');
    const now = new Date('2025-01-01T05:00:00Z');

    jest.useFakeTimers();
    jest.setSystemTime(now);

    const breachedReq = breachedRequest('req-3', 'user-3', breachedAt);

    mockPrisma.request.findMany.mockResolvedValue([breachedReq]);
    mockPrisma.escalationRule.findMany.mockResolvedValue([{
      id: 'rule-3',
      triggerHoursAfterBreach: 2,
      label: 'Team Lead',
      notifyRoles: ['AGENT'],
      requestTypeId: 'type-1',
      isActive: true,
    }]);
    // Already fired — findFirst returns existing activity
    mockPrisma.requestActivity.findFirst.mockResolvedValue({ id: 'existing-activity' });

    const result = await checkEscalations();

    expect(result).toBe(0);
    expect(mockPrisma.requestActivity.create).not.toHaveBeenCalled();
    expect(mockPrisma.requestParticipant.upsert).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('fires multiple escalations when multiple rules pass', async () => {
    const breachedAt = new Date('2025-01-01T00:00:00Z');
    const now = new Date('2025-01-01T05:00:00Z');

    jest.useFakeTimers();
    jest.setSystemTime(now);

    const breachedReq = breachedRequest('req-4', 'user-4', breachedAt);

    mockPrisma.request.findMany.mockResolvedValue([breachedReq]);
    mockPrisma.escalationRule.findMany.mockResolvedValue([
      {
        id: 'rule-4a',
        triggerHoursAfterBreach: 1,
        label: 'Team Lead',
        notifyRoles: ['AGENT'],
        requestTypeId: 'type-1',
        isActive: true,
      },
      {
        id: 'rule-4b',
        triggerHoursAfterBreach: 3,
        label: 'Manager',
        notifyRoles: ['ADMIN'],
        requestTypeId: 'type-1',
        isActive: true,
      },
    ]);
    mockPrisma.requestActivity.findFirst.mockResolvedValue(null);
    // Both escalation queries return the same handler
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

    const result = await checkEscalations();

    expect(result).toBe(2);
    expect(mockPrisma.requestActivity.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.slaEscalationEvent.upsert).toHaveBeenCalledTimes(2);
    expect(mockPrisma.outboxEvent.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.requestParticipant.upsert).not.toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  it('notifies ALL matching escalation handlers without adding participants', async () => {
    const breachedAt = new Date('2025-01-01T00:00:00Z');
    const now = new Date('2025-01-01T05:00:00Z');

    jest.useFakeTimers();
    jest.setSystemTime(now);

    const breachedReq = breachedRequest('req-5', 'user-5', breachedAt);

    mockPrisma.request.findMany.mockResolvedValue([breachedReq]);
    mockPrisma.escalationRule.findMany.mockResolvedValue([{
      id: 'rule-5',
      triggerHoursAfterBreach: 1,
      label: 'GROUP_DCEO Escalation',
      notifyRoles: ['GROUP_DCEO'],
      requestTypeId: 'type-1',
      isActive: true,
    }]);
    mockPrisma.requestActivity.findFirst.mockResolvedValue(null);
    // Multiple GROUP_DCEO users should ALL be notified without participant grants
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'dceo-1' },
      { id: 'dceo-2' },
    ]);

    const result = await checkEscalations();

    expect(result).toBe(1);
    expect(mockPrisma.requestActivity.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.slaEscalationEvent.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.requestParticipant.upsert).not.toHaveBeenCalled();
    // Both handlers notified
    expect(mockNotify).toHaveBeenCalledTimes(2);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'dceo-1', eventType: 'SLA_ESCALATED' }),
    );
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'dceo-2', eventType: 'SLA_ESCALATED' }),
    );

    jest.useRealTimers();
  });

  it('handles zero escalation handlers gracefully', async () => {
    const breachedAt = new Date('2025-01-01T00:00:00Z');
    const now = new Date('2025-01-01T05:00:00Z');

    jest.useFakeTimers();
    jest.setSystemTime(now);

    const breachedReq = breachedRequest('req-6', 'user-6', breachedAt);

    mockPrisma.request.findMany.mockResolvedValue([breachedReq]);
    mockPrisma.escalationRule.findMany.mockResolvedValue([{
      id: 'rule-6',
      triggerHoursAfterBreach: 1,
      label: 'Orphaned',
      notifyRoles: ['NONEXISTENT_ROLE'],
      requestTypeId: 'type-1',
      isActive: true,
    }]);
    mockPrisma.requestActivity.findFirst.mockResolvedValue(null);
    // No users found for the role
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await checkEscalations();

    expect(result).toBe(1); // Escalation activity still recorded
    expect(mockPrisma.requestActivity.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.slaEscalationEvent.upsert).toHaveBeenCalledTimes(1);
    // No handlers to add as participants or notify
    expect(mockPrisma.requestParticipant.upsert).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();

    jest.useRealTimers();
  });
});