/**
 * Transactional outbox dispatcher.
 *
 * `executeWorkflowCommand` commits OutboxEvent rows in the same transaction as
 * the state change. This service is the other half: it claims unpublished rows,
 * hands them to registered handlers, and retries with exponential backoff until
 * maxAttempts, after which the row is dead-lettered for operator attention.
 *
 * Retry semantics mirror SlaTimerJob in workers/timer.worker.ts.
 */

import { OutboxEventStatus } from '@prisma/client';

import prisma from '../utils/prisma';
import { logger } from '../utils/logger';

export interface OutboxEventView {
  id: string;
  tenantId: string;
  eventType: string;
  aggregateId: string;
  aggregateVersion: number;
  payload: Record<string, unknown>;
}

export type OutboxHandler = (event: OutboxEventView) => Promise<void>;

export interface DispatchResult {
  claimed: number;
  published: number;
  failed: number;
  deadLettered: number;
}

const handlers = new Map<string, OutboxHandler>();

export function registerOutboxHandler(eventType: string, handler: OutboxHandler): void {
  handlers.set(eventType, handler);
}

export function clearOutboxHandlers(): void {
  handlers.clear();
}

/** 1m, 2m, 4m … capped at 30m. */
export function outboxBackoffMs(attempts: number): number {
  return Math.min(60_000 * 2 ** Math.max(0, attempts - 1), 30 * 60_000);
}

const db = prisma as any;

export async function dispatchOutboxBatch(
  opts: { limit?: number; workerId?: string; now?: Date } = {},
): Promise<DispatchResult> {
  const limit = opts.limit ?? 100;
  const workerId = opts.workerId ?? 'outbox-dispatcher';
  const now = opts.now ?? new Date();

  const candidates = await db.outboxEvent.findMany({
    where: {
      status: { in: [OutboxEventStatus.PENDING, OutboxEventStatus.FAILED] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  const result: DispatchResult = { claimed: 0, published: 0, failed: 0, deadLettered: 0 };

  for (const event of candidates) {
    // Claim by CAS on status so concurrent dispatchers cannot double-deliver.
    const claim = await db.outboxEvent.updateMany({
      where: {
        id: event.id,
        status: { in: [OutboxEventStatus.PENDING, OutboxEventStatus.FAILED] },
      },
      data: { status: OutboxEventStatus.CLAIMED, claimedAt: now, claimedBy: workerId },
    });
    if (claim.count !== 1) continue;
    result.claimed += 1;

    const handler = handlers.get(event.eventType);
    if (!handler) {
      // Nothing subscribes to this event type. Retrying cannot help, and leaving
      // it PENDING would grow the table forever, so record it as delivered.
      await db.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: OutboxEventStatus.PUBLISHED,
          published: true,
          publishedAt: now,
          lastError: null,
          nextAttemptAt: null,
        },
      });
      result.published += 1;
      continue;
    }

    try {
      await handler({
        id: event.id,
        tenantId: event.tenantId,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        aggregateVersion: event.aggregateVersion,
        payload: (event.payload ?? {}) as Record<string, unknown>,
      });
      await db.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: OutboxEventStatus.PUBLISHED,
          published: true,
          publishedAt: now,
          lastError: null,
          nextAttemptAt: null,
        },
      });
      result.published += 1;
    } catch (error) {
      const attempts = Number(event.attempts ?? 0) + 1;
      const exhausted = attempts >= Number(event.maxAttempts ?? 5);
      await db.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: exhausted ? OutboxEventStatus.DEAD_LETTER : OutboxEventStatus.FAILED,
          attempts,
          lastError: String((error as Error)?.message ?? error),
          nextAttemptAt: exhausted ? null : new Date(now.getTime() + outboxBackoffMs(attempts)),
        },
      });
      if (exhausted) {
        result.deadLettered += 1;
        logger.error('Outbox event dead-lettered', {
          eventId: event.id,
          eventType: event.eventType,
          aggregateId: event.aggregateId,
          attempts,
        });
      } else {
        result.failed += 1;
        logger.warn('Outbox event delivery failed; will retry', {
          eventId: event.id,
          eventType: event.eventType,
          attempts,
        });
      }
    }
  }

  if (result.claimed > 0) {
    logger.info('Outbox batch dispatched', result);
  }
  return result;
}