import prisma from '../utils/prisma';
import { createRedisClient } from '../utils/redis';
import { logger } from '../utils/logger';

const redis = createRedisClient();
const CACHE_PREFIX = 'sla:pause_status:';
const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Pause the SLA timer for a request.
 * Sets slaPausedAt = now(). Idempotent — no-op if already paused.
 */
export async function pauseSla(requestId: string): Promise<void> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { id: true, slaPausedAt: true, referenceNumber: true, requesterId: true },
  });

  if (!request) {
    logger.warn(`pauseSla: Request ${requestId} not found`);
    return;
  }

  // Already paused — idempotent, do not reset the timestamp
  if (request.slaPausedAt) {
    logger.info(`pauseSla: Request ${request.referenceNumber} already paused at ${request.slaPausedAt.toISOString()}`);
    return;
  }

  const now = new Date();

  await prisma.request.update({
    where: { id: requestId },
    data: { slaPausedAt: now },
  });

  await prisma.requestActivity.create({
    data: {
      requestId,
      authorId: request.requesterId,
      authorName: 'System',
      activityType: 'SYSTEM',
      message: 'SLA timer paused — request entered approval status',
      isSystemGenerated: true,
      metadata: { action: 'sla_pause', pausedAt: now.toISOString() },
    },
  });

  logger.info(`pauseSla: SLA paused for request ${request.referenceNumber}`);
}

/**
 * Resume the SLA timer for a request.
 * Accumulates pause duration, extends slaDueAt, clears slaPausedAt.
 * Idempotent — no-op if not paused.
 */
export async function resumeSla(requestId: string): Promise<void> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      slaPausedAt: true,
      slaPauseDurationMs: true,
      slaDueAt: true,
      referenceNumber: true,
      requesterId: true,
    },
  });

  if (!request) {
    logger.warn(`resumeSla: Request ${requestId} not found`);
    return;
  }

  // Not paused — idempotent, no-op
  if (!request.slaPausedAt) {
    logger.info(`resumeSla: Request ${request.referenceNumber} not paused, skipping`);
    return;
  }

  const now = new Date();
  const pauseDurationMs = now.getTime() - request.slaPausedAt.getTime();
  const newTotalPauseMs = Number(request.slaPauseDurationMs) + pauseDurationMs;

  // Extend slaDueAt by the pause duration
  const updateData: any = {
    slaPausedAt: null,
    slaPauseDurationMs: newTotalPauseMs,
  };

  if (request.slaDueAt) {
    updateData.slaDueAt = new Date(request.slaDueAt.getTime() + pauseDurationMs);
  }

  await prisma.request.update({
    where: { id: requestId },
    data: updateData,
  });

  // Human-readable pause duration
  const pauseHours = Math.floor(pauseDurationMs / (1000 * 60 * 60));
  const pauseMinutes = Math.floor((pauseDurationMs % (1000 * 60 * 60)) / (1000 * 60));

  await prisma.requestActivity.create({
    data: {
      requestId,
      authorId: request.requesterId,
      authorName: 'System',
      activityType: 'SYSTEM',
      message: `SLA timer resumed — approval decision made (paused ${pauseHours}h ${pauseMinutes}m)`,
      isSystemGenerated: true,
      metadata: {
        action: 'sla_resume',
        pausedAt: request.slaPausedAt.toISOString(),
        resumedAt: now.toISOString(),
        pauseDurationMs,
        totalPauseMs: newTotalPauseMs,
      },
    },
  });

  logger.info(
    `resumeSla: SLA resumed for request ${request.referenceNumber}, paused for ${pauseHours}h ${pauseMinutes}m, due date extended`,
  );
}

/**
 * Check if a given status should pause the SLA.
 * Queries DB (WorkflowStep.slaPause), caches in Redis for 5 minutes.
 */
export async function isPauseStatus(status: string): Promise<boolean> {
  const cacheKey = `${CACHE_PREFIX}${status}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      return cached === '1';
    }
  } catch (err) {
    logger.warn(`isPauseStatus: Redis cache read failed for status ${status}`, { err });
  }

  const step = await prisma.workflowStep.findFirst({
    where: { status, slaPause: true },
    select: { id: true },
  });

  const result = step !== null;

  try {
    await redis.setex(cacheKey, CACHE_TTL_SECONDS, result ? '1' : '0');
  } catch (err) {
    logger.warn(`isPauseStatus: Redis cache write failed for status ${status}`, { err });
  }

  return result;
}

/**
 * Check if a given status transitions FROM a pause status TO another status,
 * meaning we should resume the SLA.
 */
export async function shouldResumeOnTransition(
  fromStatus: string,
  toStatus: string,
): Promise<{ shouldPause: boolean; shouldResume: boolean }> {
  const [fromPaused, toPaused] = await Promise.all([
    isPauseStatus(fromStatus),
    isPauseStatus(toStatus),
  ]);

  return {
    shouldPause: !fromPaused && toPaused,
    shouldResume: fromPaused && !toPaused,
  };
}

/**
 * Compute the effective SLA deadline, accounting for pause time.
 * If currently paused, the "remaining time" is frozen (effective due date = due + accumulated pause).
 */
export function getEffectiveSlaDueAt(request: {
  slaDueAt: Date | null;
  slaPausedAt: Date | null;
  slaPauseDurationMs: bigint;
}): Date | null {
  if (!request.slaDueAt) return null;

  // Base: slaDueAt + accumulated pause duration from previous pauses
  const base = new Date(request.slaDueAt.getTime() + Number(request.slaPauseDurationMs));

  // If currently paused, add current pause duration too
  if (request.slaPausedAt) {
    const currentPauseMs = Date.now() - request.slaPausedAt.getTime();
    return new Date(base.getTime() + currentPauseMs);
  }

  return base;
}

/**
 * Invalidate the pause-status cache. Call this when WorkflowStep.slaPause is updated.
 */
export async function invalidateSlaPauseCache(): Promise<void> {
  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${CACHE_PREFIX}*`, 'COUNT', 100);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      cursor = nextCursor;
    } while (cursor !== '0');
  } catch (err) {
    logger.warn('invalidateSlaPauseCache: Redis cache invalidation failed', { err });
  }
}

/**
 * Auto-resume stale SLA pauses — requests still paused after MAX_PAUSE_DAYS (default 14).
 * Prevents indefinite pause if an approver goes MIA or a workflow step is orphaned.
 * Returns the count of auto-resumed requests.
 */
const MAX_PAUSE_DAYS = parseInt(process.env.SLA_MAX_PAUSE_DAYS || '14', 10);

export async function checkStalePauses(): Promise<number> {
  const cutoff = new Date(Date.now() - MAX_PAUSE_DAYS * 24 * 60 * 60 * 1000);

  const staleRequests = await prisma.request.findMany({
    where: {
      slaPausedAt: { lte: cutoff },
      status: { notIn: ['RESOLVED', 'REIMBURSEMENT_CLOSED', 'REJECTED', 'COMPLETED', 'PAYMENT_COMPLETED'] },
    },
    select: { id: true, referenceNumber: true },
  });

  for (const req of staleRequests) {
    await resumeSla(req.id);
    logger.info(`checkStalePauses: Auto-resumed stale SLA pause for request ${req.referenceNumber} (paused for >${MAX_PAUSE_DAYS} days)`);
  }

  return staleRequests.length;
}