/**
 * Unit tests for SLA Pause Service
 * Covers: pauseSla, resumeSla, isPauseStatus, shouldResumeOnTransition,
 *         getEffectiveSlaDueAt, invalidateSlaPauseCache, checkStalePauses
 */

// ── Mock Prisma ────────────────────────────────────────────────────────────
const mockPrisma = {
  request: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  requestActivity: {
    create: jest.fn(),
  },
  workflowStep: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

// ── Mock Redis ─────────────────────────────────────────────────────────────
const redisStore = new Map<string, string>();

const mockRedis = {
  get: jest.fn(async (key: string) => redisStore.get(key) ?? null),
  setex: jest.fn(async (key: string, _ttl: number, val: string) => {
    redisStore.set(key, val);
    return 'OK';
  }),
  scan: jest.fn(async (cursor: string, ..._args: any[]) => {
    const allKeys = [...redisStore.keys()].filter(k => k.startsWith('sla:pause_status:'));
    return ['0', allKeys]; // single-page scan for simplicity
  }),
  del: jest.fn(async (...keys: string[]) => {
    keys.forEach(k => redisStore.delete(k));
    return keys.length;
  }),
};

jest.mock('ioredis', () => {
  return jest.fn(() => mockRedis);
});

// ── Mock logger ────────────────────────────────────────────────────────────
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ── Mock config ────────────────────────────────────────────────────────────
jest.mock('../../config', () => ({
  config: {
    redis: { url: 'redis://localhost:6379' },
  },
}));

// Import after mocks are set up
import {
  pauseSla,
  resumeSla,
  isPauseStatus,
  shouldResumeOnTransition,
  getEffectiveSlaDueAt,
  invalidateSlaPauseCache,
  checkStalePauses,
} from '../sla-pause.service';

// ── Helpers ─────────────────────────────────────────────────────────────────

const ONE_HOUR_MS = 1000 * 60 * 60;
const ONE_DAY_MS = 1000 * 60 * 60 * 24;

beforeEach(() => {
  jest.clearAllMocks();
  redisStore.clear();
});

// ── pauseSla ────────────────────────────────────────────────────────────────

describe('pauseSla', () => {
  it('sets slaPausedAt on a non-paused request', async () => {
    mockPrisma.request.findUnique.mockResolvedValue({
      id: 'req-1',
      slaPausedAt: null,
      referenceNumber: 'IT-001',
      requesterId: 'req-1',
    });
    mockPrisma.request.update.mockResolvedValue({});
    mockPrisma.requestActivity.create.mockResolvedValue({});

    await pauseSla('req-1');

    expect(mockPrisma.request.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: { slaPausedAt: expect.any(Date) },
    });
  });

  it('creates a SYSTEM activity log with pause message', async () => {
    mockPrisma.request.findUnique.mockResolvedValue({
      id: 'req-1',
      slaPausedAt: null,
      referenceNumber: 'IT-001',
      requesterId: 'req-1',
    });
    mockPrisma.request.update.mockResolvedValue({});
    mockPrisma.requestActivity.create.mockResolvedValue({});

    await pauseSla('req-1');

    expect(mockPrisma.requestActivity.create).toHaveBeenCalledWith({
      data: {
        requestId: 'req-1',
        authorId: 'req-1',
        authorName: 'System',
        activityType: 'SYSTEM',
        message: 'SLA timer paused — request entered approval status',
        isSystemGenerated: true,
        metadata: { action: 'sla_pause', pausedAt: expect.any(String) },
      },
    });
  });

  it('is idempotent — does not reset slaPausedAt if already paused', async () => {
    const pausedAt = new Date('2026-04-28T10:00:00Z');
    mockPrisma.request.findUnique.mockResolvedValue({
      id: 'req-1',
      slaPausedAt: pausedAt,
      referenceNumber: 'IT-001',
    });

    await pauseSla('req-1');

    // Should NOT call update or create activity
    expect(mockPrisma.request.update).not.toHaveBeenCalled();
    expect(mockPrisma.requestActivity.create).not.toHaveBeenCalled();
  });

  it('no-ops when request not found', async () => {
    mockPrisma.request.findUnique.mockResolvedValue(null);

    await pauseSla('nonexistent');

    expect(mockPrisma.request.update).not.toHaveBeenCalled();
  });
});

// ── resumeSla ───────────────────────────────────────────────────────────────

describe('resumeSla', () => {
  it('accumulates slaPauseDurationMs (adds to existing, not replaces)', async () => {
    const pausedAt = new Date(Date.now() - ONE_HOUR_MS);
    const existingDurationMs = BigInt(2 * ONE_HOUR_MS); // 2h already from previous pause

    mockPrisma.request.findUnique.mockResolvedValue({
      id: 'req-1',
      slaPausedAt: pausedAt,
      slaPauseDurationMs: existingDurationMs,
      slaDueAt: new Date('2026-05-01T00:00:00Z'),
      referenceNumber: 'IT-001',
      requesterId: 'user-1',
    });
    mockPrisma.request.update.mockResolvedValue({});
    mockPrisma.requestActivity.create.mockResolvedValue({});

    await resumeSla('req-1');

    const updateCall = mockPrisma.request.update.mock.calls[0][0];
    // Total should be 2h (previous) + ~1h (current) ≈ 3h
    expect(updateCall.data.slaPauseDurationMs).toBeGreaterThanOrEqual(
      Number(existingDurationMs) + ONE_HOUR_MS - 1000, // allow 1s tolerance
    );
  });

  it('extends slaDueAt by the pause duration', async () => {
    const originalDueAt = new Date('2026-05-01T00:00:00Z');
    const pausedAt = new Date(Date.now() - ONE_HOUR_MS);

    mockPrisma.request.findUnique.mockResolvedValue({
      id: 'req-1',
      slaPausedAt: pausedAt,
      slaPauseDurationMs: BigInt(0),
      slaDueAt: originalDueAt,
      referenceNumber: 'IT-001',
      requesterId: 'user-1',
    });
    mockPrisma.request.update.mockResolvedValue({});
    mockPrisma.requestActivity.create.mockResolvedValue({});

    await resumeSla('req-1');

    const updateCall = mockPrisma.request.update.mock.calls[0][0];
    // slaDueAt should be extended by ~1h
    const extendedDue = updateCall.data.slaDueAt.getTime();
    const expectedDue = originalDueAt.getTime() + ONE_HOUR_MS;
    expect(Math.abs(extendedDue - expectedDue)).toBeLessThan(1000); // within 1s
  });

  it('clears slaPausedAt to null', async () => {
    const pausedAt = new Date(Date.now() - ONE_HOUR_MS);

    mockPrisma.request.findUnique.mockResolvedValue({
      id: 'req-1',
      slaPausedAt: pausedAt,
      slaPauseDurationMs: BigInt(0),
      slaDueAt: new Date('2026-05-01T00:00:00Z'),
      referenceNumber: 'IT-001',
      requesterId: 'user-1',
    });
    mockPrisma.request.update.mockResolvedValue({});
    mockPrisma.requestActivity.create.mockResolvedValue({});

    await resumeSla('req-1');

    const updateCall = mockPrisma.request.update.mock.calls[0][0];
    expect(updateCall.data.slaPausedAt).toBeNull();
  });

  it('creates activity log with resume message including duration', async () => {
    const pausedAt = new Date(Date.now() - ONE_HOUR_MS * 2 + ONE_HOUR_MS / 2); // ~1.5h

    mockPrisma.request.findUnique.mockResolvedValue({
      id: 'req-1',
      slaPausedAt: pausedAt,
      slaPauseDurationMs: BigInt(0),
      slaDueAt: new Date('2026-05-01T00:00:00Z'),
      referenceNumber: 'IT-001',
      requesterId: 'user-1',
    });
    mockPrisma.request.update.mockResolvedValue({});
    mockPrisma.requestActivity.create.mockResolvedValue({});

    await resumeSla('req-1');

    const activityCall = mockPrisma.requestActivity.create.mock.calls[0][0];
    expect(activityCall.data.activityType).toBe('SYSTEM');
    expect(activityCall.data.message).toMatch(/SLA timer resumed/);
    expect(activityCall.data.message).toMatch(/paused \d+h \d+m/);
    expect(activityCall.data.metadata.action).toBe('sla_resume');
  });

  it('is idempotent — no-op when not paused', async () => {
    mockPrisma.request.findUnique.mockResolvedValue({
      id: 'req-1',
      slaPausedAt: null,
      slaPauseDurationMs: BigInt(0),
      slaDueAt: new Date('2026-05-01T00:00:00Z'),
      referenceNumber: 'IT-001',
      requesterId: 'user-1',
    });

    await resumeSla('req-1');

    expect(mockPrisma.request.update).not.toHaveBeenCalled();
    expect(mockPrisma.requestActivity.create).not.toHaveBeenCalled();
  });
});

// ── isPauseStatus ────────────────────────────────────────────────────────────

describe('isPauseStatus', () => {
  it('returns true for a pause status in DB', async () => {
    mockPrisma.workflowStep.findFirst.mockResolvedValue({ id: 'step-1' });

    const result = await isPauseStatus('PENDING_CEO_APPROVAL');

    expect(result).toBe(true);
    expect(mockPrisma.workflowStep.findFirst).toHaveBeenCalledWith({
      where: { status: 'PENDING_CEO_APPROVAL', slaPause: true },
      select: { id: true },
    });
  });

  it('returns false for a non-pause status', async () => {
    mockPrisma.workflowStep.findFirst.mockResolvedValue(null);

    const result = await isPauseStatus('IN_PROGRESS');

    expect(result).toBe(false);
  });

  it('caches result in Redis for subsequent calls', async () => {
    mockPrisma.workflowStep.findFirst.mockResolvedValue({ id: 'step-1' });

    // First call — queries DB, writes cache
    await isPauseStatus('PENDING_CFO_APPROVAL_IT');
    expect(mockPrisma.workflowStep.findFirst).toHaveBeenCalledTimes(1);
    expect(mockRedis.setex).toHaveBeenCalledWith(
      'sla:pause_status:PENDING_CFO_APPROVAL_IT',
      300,
      '1',
    );

    jest.clearAllMocks(); // reset call counts but keep cache

    // Second call — should hit Redis cache (mockRedis.get reads from redisStore)
    const result = await isPauseStatus('PENDING_CFO_APPROVAL_IT');
    expect(result).toBe(true);
    expect(mockPrisma.workflowStep.findFirst).not.toHaveBeenCalled();
  });
});

// ── shouldResumeOnTransition ─────────────────────────────────────────────────

describe('shouldResumeOnTransition', () => {
  it('returns shouldPause=true when moving from non-pause to pause status', async () => {
    // IN_PROGRESS → PENDING_CEO_APPROVAL
    mockPrisma.workflowStep.findFirst
      .mockResolvedValueOnce(null)       // IN_PROGRESS is not a pause status
      .mockResolvedValueOnce({ id: 's' }); // PENDING_CEO_APPROVAL is a pause status

    const result = await shouldResumeOnTransition('IN_PROGRESS', 'PENDING_CEO_APPROVAL');

    expect(result.shouldPause).toBe(true);
    expect(result.shouldResume).toBe(false);
  });

  it('returns shouldResume=true when moving from pause to non-pause status', async () => {
    // PENDING_CEO_APPROVAL → CEO_APPROVED
    mockPrisma.workflowStep.findFirst
      .mockResolvedValueOnce({ id: 's' }) // PENDING_CEO_APPROVAL is a pause status
      .mockResolvedValueOnce(null);       // CEO_APPROVED is not

    const result = await shouldResumeOnTransition('PENDING_CEO_APPROVAL', 'CEO_APPROVED');

    expect(result.shouldResume).toBe(true);
    expect(result.shouldPause).toBe(false);
  });

  it('returns neither when both statuses are pause or both are not', async () => {
    // Pause → Pause
    mockPrisma.workflowStep.findFirst
      .mockResolvedValueOnce({ id: 's1' })
      .mockResolvedValueOnce({ id: 's2' });

    const result1 = await shouldResumeOnTransition('PENDING_CEO_APPROVAL', 'PENDING_CTO_APPROVAL_IT');
    expect(result1.shouldPause).toBe(false);
    expect(result1.shouldResume).toBe(false);

    jest.clearAllMocks();

    // Non-pause → Non-pause
    mockPrisma.workflowStep.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result2 = await shouldResumeOnTransition('IN_PROGRESS', 'RESOLVED');
    expect(result2.shouldPause).toBe(false);
    expect(result2.shouldResume).toBe(false);
  });
});

// ── getEffectiveSlaDueAt ─────────────────────────────────────────────────────

describe('getEffectiveSlaDueAt', () => {
  it('returns null when slaDueAt is null', () => {
    const result = getEffectiveSlaDueAt({
      slaDueAt: null,
      slaPausedAt: null,
      slaPauseDurationMs: BigInt(0),
    });
    expect(result).toBeNull();
  });

  it('returns slaDueAt + accumulated pause when not currently paused', () => {
    const dueAt = new Date('2026-05-01T00:00:00Z');
    const pauseMs = BigInt(3 * ONE_HOUR_MS);

    const result = getEffectiveSlaDueAt({
      slaDueAt: dueAt,
      slaPausedAt: null,
      slaPauseDurationMs: pauseMs,
    });

    // effective = dueAt + 3h
    expect(result!.getTime()).toBe(dueAt.getTime() + Number(pauseMs));
  });

  it('adds current pause duration when currently paused', () => {
    const dueAt = new Date('2026-05-01T00:00:00Z');
    const previousPauseMs = BigInt(2 * ONE_HOUR_MS);
    const pausedAt = new Date(Date.now() - ONE_HOUR_MS); // 1h ago

    const result = getEffectiveSlaDueAt({
      slaDueAt: dueAt,
      slaPausedAt: pausedAt,
      slaPauseDurationMs: previousPauseMs,
    });

    // effective = dueAt + 2h (previous) + ~1h (current) ≈ dueAt + 3h
    const expectedMs = dueAt.getTime() + Number(previousPauseMs) + ONE_HOUR_MS;
    expect(Math.abs(result!.getTime() - expectedMs)).toBeLessThan(1000);
  });

  it('handles zero pause duration correctly', () => {
    const dueAt = new Date('2026-05-01T00:00:00Z');

    const result = getEffectiveSlaDueAt({
      slaDueAt: dueAt,
      slaPausedAt: null,
      slaPauseDurationMs: BigInt(0),
    });

    expect(result!.getTime()).toBe(dueAt.getTime());
  });
});

// ── invalidateSlaPauseCache ──────────────────────────────────────────────────

describe('invalidateSlaPauseCache', () => {
  it('clears all SLA pause cache keys from Redis', async () => {
    redisStore.set('sla:pause_status:PENDING_CEO_APPROVAL', '1');
    redisStore.set('sla:pause_status:IN_PROGRESS', '0');
    redisStore.set('other:key', 'keep'); // non-SLA key should survive

    await invalidateSlaPauseCache();

    expect(redisStore.has('sla:pause_status:PENDING_CEO_APPROVAL')).toBe(false);
    expect(redisStore.has('sla:pause_status:IN_PROGRESS')).toBe(false);
    expect(redisStore.has('other:key')).toBe(true);
  });
});

// ── checkStalePauses ─────────────────────────────────────────────────────────

describe('checkStalePauses', () => {
  it('auto-resumes requests paused for more than MAX_PAUSE_DAYS', async () => {
    const staleDate = new Date(Date.now() - 15 * ONE_DAY_MS); // 15 days ago > 14-day default

    mockPrisma.request.findMany.mockResolvedValue([
      { id: 'req-stale-1', referenceNumber: 'IT-STALE' },
    ]);
    mockPrisma.request.findUnique.mockResolvedValue({
      id: 'req-stale-1',
      slaPausedAt: staleDate,
      slaPauseDurationMs: BigInt(0),
      slaDueAt: new Date('2026-05-01T00:00:00Z'),
      referenceNumber: 'IT-STALE',
      requesterId: 'user-1',
    });
    mockPrisma.request.update.mockResolvedValue({});
    mockPrisma.requestActivity.create.mockResolvedValue({});

    const count = await checkStalePauses();

    expect(count).toBe(1);
    expect(mockPrisma.request.update).toHaveBeenCalled(); // resumeSla was called
  });

  it('returns 0 when no stale pauses exist', async () => {
    mockPrisma.request.findMany.mockResolvedValue([]);

    const count = await checkStalePauses();

    expect(count).toBe(0);
    expect(mockPrisma.request.update).not.toHaveBeenCalled();
  });
});

// ── Multiple pause/resume cycles ─────────────────────────────────────────────

describe('multiple pause/resume cycles', () => {
  it('cumulative duration is correct after 2+ cycles', async () => {
    // Cycle 1: pause for 1h
    const firstPausedAt = new Date(Date.now() - ONE_HOUR_MS);
    mockPrisma.request.findUnique.mockResolvedValue({
      id: 'req-1',
      slaPausedAt: firstPausedAt,
      slaPauseDurationMs: BigInt(0), // no previous pause
      slaDueAt: new Date('2026-05-01T00:00:00Z'),
      referenceNumber: 'IT-001',
      requesterId: 'user-1',
    });
    mockPrisma.request.update.mockResolvedValue({});
    mockPrisma.requestActivity.create.mockResolvedValue({});

    await resumeSla('req-1');

    const firstUpdate = mockPrisma.request.update.mock.calls[0][0];
    const afterFirstCycle = firstUpdate.data.slaPauseDurationMs;
    expect(afterFirstCycle).toBeGreaterThanOrEqual(ONE_HOUR_MS - 1000);

    // Cycle 2: pause for another 30 min
    jest.clearAllMocks();
    const secondPausedAt = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
    mockPrisma.request.findUnique.mockResolvedValue({
      id: 'req-1',
      slaPausedAt: secondPausedAt,
      slaPauseDurationMs: BigInt(afterFirstCycle), // carry forward from cycle 1
      slaDueAt: new Date('2026-05-01T00:00:00Z'),
      referenceNumber: 'IT-001',
      requesterId: 'user-1',
    });

    await resumeSla('req-1');

    const secondUpdate = mockPrisma.request.update.mock.calls[0][0];
    const afterSecondCycle = secondUpdate.data.slaPauseDurationMs;
    // Total should be ~1h + ~30min = ~1.5h
    expect(afterSecondCycle).toBeGreaterThanOrEqual(afterFirstCycle + 30 * 60 * 1000 - 1000);
    expect(afterSecondCycle).toBeLessThanOrEqual(afterFirstCycle + 30 * 60 * 1000 + 1000);
  });
});