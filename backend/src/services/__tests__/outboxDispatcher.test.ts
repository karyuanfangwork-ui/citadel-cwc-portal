import { OutboxEventStatus } from '@prisma/client';

const mockPrisma = {
  outboxEvent: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('../../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  dispatchOutboxBatch,
  registerOutboxHandler,
  clearOutboxHandlers,
  outboxBackoffMs,
} from '../outboxDispatcher.service';

const NOW = new Date('2026-08-04T12:00:00.000Z');

function pendingEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    tenantId: 'tenant-1',
    eventType: 'REQUEST_STATUS_CHANGED',
    aggregateId: 'req-1',
    aggregateVersion: 2,
    payload: { requestId: 'req-1' },
    attempts: 0,
    maxAttempts: 5,
    ...overrides,
  };
}

describe('dispatchOutboxBatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearOutboxHandlers();
    mockPrisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.outboxEvent.update.mockResolvedValue({});
  });

  it('marks an event PUBLISHED when its handler succeeds', async () => {
    mockPrisma.outboxEvent.findMany.mockResolvedValue([pendingEvent()]);
    const handler = jest.fn().mockResolvedValue(undefined);
    registerOutboxHandler('REQUEST_STATUS_CHANGED', handler);

    const result = await dispatchOutboxBatch({ now: NOW, workerId: 'w1' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ claimed: 1, published: 1, failed: 0, deadLettered: 0 });
    expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: {
        status: OutboxEventStatus.PUBLISHED,
        published: true,
        publishedAt: NOW,
        lastError: null,
        nextAttemptAt: null,
      },
    });
  });

  it('schedules a retry with backoff when the handler throws', async () => {
    mockPrisma.outboxEvent.findMany.mockResolvedValue([pendingEvent({ attempts: 1 })]);
    registerOutboxHandler('REQUEST_STATUS_CHANGED', jest.fn().mockRejectedValue(new Error('smtp down')));

    const result = await dispatchOutboxBatch({ now: NOW, workerId: 'w1' });

    expect(result).toMatchObject({ published: 0, failed: 1, deadLettered: 0 });
    expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: {
        status: OutboxEventStatus.FAILED,
        attempts: 2,
        lastError: 'smtp down',
        nextAttemptAt: new Date(NOW.getTime() + outboxBackoffMs(2)),
      },
    });
  });

  it('dead-letters an event once attempts reach maxAttempts', async () => {
    mockPrisma.outboxEvent.findMany.mockResolvedValue([pendingEvent({ attempts: 4, maxAttempts: 5 })]);
    registerOutboxHandler('REQUEST_STATUS_CHANGED', jest.fn().mockRejectedValue(new Error('permanent')));

    const result = await dispatchOutboxBatch({ now: NOW, workerId: 'w1' });

    expect(result).toMatchObject({ failed: 0, deadLettered: 1 });
    expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: {
        status: OutboxEventStatus.DEAD_LETTER,
        attempts: 5,
        lastError: 'permanent',
        nextAttemptAt: null,
      },
    });
  });

  it('publishes events with no registered handler instead of retrying forever', async () => {
    mockPrisma.outboxEvent.findMany.mockResolvedValue([pendingEvent({ eventType: 'UNKNOWN_EVENT' })]);

    const result = await dispatchOutboxBatch({ now: NOW, workerId: 'w1' });

    expect(result).toMatchObject({ published: 1, failed: 0 });
  });

  it('skips an event it loses the claim race for', async () => {
    mockPrisma.outboxEvent.findMany.mockResolvedValue([pendingEvent()]);
    mockPrisma.outboxEvent.updateMany.mockResolvedValue({ count: 0 });
    const handler = jest.fn();
    registerOutboxHandler('REQUEST_STATUS_CHANGED', handler);

    const result = await dispatchOutboxBatch({ now: NOW, workerId: 'w1' });

    expect(handler).not.toHaveBeenCalled();
    expect(result).toMatchObject({ claimed: 0, published: 0 });
  });
});

describe('outboxBackoffMs', () => {
  it('grows exponentially and caps at 30 minutes', () => {
    expect(outboxBackoffMs(1)).toBe(60_000);
    expect(outboxBackoffMs(2)).toBe(120_000);
    expect(outboxBackoffMs(20)).toBe(1_800_000);
  });
});