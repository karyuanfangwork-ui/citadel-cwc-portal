import { Worker, Job } from 'bullmq';

import prisma from '../utils/prisma';
import { getRedisConnectionConfig } from '../utils/redis';
import { logger } from '../utils/logger';
import { notify } from '../services/notification.service';
import { SLA_TIMER_QUEUE_NAME } from '../queues/timer.queue';

const db = prisma as any;

export interface TimerWorkerOptions {
  workerId?: string;
  now?: Date;
}

const TERMINAL_REQUEST_STATUSES = [
  'RESOLVED',
  'REIMBURSEMENT_CLOSED',
  'REJECTED',
  'COMPLETED',
  'PAYMENT_COMPLETED',
  'CANCELLED',
];

function backoffMs(attempts: number): number {
  return Math.min(30_000 * Math.max(1, 2 ** attempts), 30 * 60_000);
}

async function claimTimerJob(timerJobId: string, workerId: string, now: Date) {
  const claimed = await db.slaTimerJob.updateMany({
    where: {
      id: timerJobId,
      status: { in: ['SCHEDULED', 'FAILED'] },
      runAt: { lte: now },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    data: { status: 'CLAIMED', claimedAt: now, claimedBy: workerId },
  });

  if (claimed.count !== 1) {
    return db.slaTimerJob.findUnique({ where: { id: timerJobId } });
  }
  return db.slaTimerJob.findUnique({ where: { id: timerJobId } });
}

async function markTimerFailure(timerJob: any, error: unknown, now: Date) {
  const attempts = Number(timerJob.attempts ?? 0) + 1;
  const status = attempts >= Number(timerJob.maxAttempts ?? 5) ? 'DEAD_LETTER' : 'FAILED';
  await db.slaTimerJob.update({
    where: { id: timerJob.id },
    data: {
      status,
      attempts,
      lastError: String((error as Error)?.message || error),
      nextAttemptAt: status === 'FAILED' ? new Date(now.getTime() + backoffMs(attempts)) : null,
    },
  });
}

async function completeTimer(timerJobId: string) {
  await db.slaTimerJob.update({
    where: { id: timerJobId },
    data: { status: 'COMPLETED', lastError: null },
  });
}

export async function processSlaTimerJob(timerJobId: string, options: TimerWorkerOptions = {}) {
  const now = options.now ?? new Date();
  const workerId = options.workerId ?? `sla-worker-${process.pid}`;
  const timerJob = await claimTimerJob(timerJobId, workerId, now);

  if (!timerJob || timerJob.status === 'COMPLETED' || timerJob.status === 'CANCELLED' || timerJob.status === 'DEAD_LETTER') {
    return { processed: false, status: timerJob?.status ?? 'MISSING' };
  }
  if (timerJob.status !== 'CLAIMED') {
    return { processed: false, status: timerJob.status };
  }

  try {
    const clock = await db.slaClock.findUnique({ where: { id: timerJob.clockId } });
    if (!clock || clock.status === 'COMPLETED' || clock.status === 'CANCELLED') {
      await completeTimer(timerJob.id);
      return { processed: false, status: 'CLOCK_TERMINAL' };
    }
    if (clock.status === 'PAUSED' || clock.pausedAt) {
      await db.slaTimerJob.update({
        where: { id: timerJob.id },
        data: { status: 'SCHEDULED', runAt: clock.dueAt, claimedAt: null, claimedBy: null },
      });
      return { processed: false, status: 'CLOCK_PAUSED' };
    }

    const request = await prisma.request.findFirst({
      where: { id: timerJob.requestId, tenantId: timerJob.tenantId },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        requesterId: true,
        assignedToId: true,
        requestTypeId: true,
        referenceNumber: true,
        status: true,
        slaDueAt: true,
      },
    });

    if (!request || TERMINAL_REQUEST_STATUSES.includes(request.status)) {
      await db.slaClock.update({ where: { id: clock.id }, data: { status: 'CANCELLED', completedAt: now } });
      await completeTimer(timerJob.id);
      return { processed: false, status: 'REQUEST_TERMINAL' };
    }

    if (clock.dueAt > now) {
      await db.slaTimerJob.update({ where: { id: timerJob.id }, data: { status: 'SCHEDULED', runAt: clock.dueAt, claimedAt: null, claimedBy: null } });
      return { processed: false, status: 'NOT_DUE' };
    }

    if (timerJob.kind === 'SLA_RESPONSE_DUE' || timerJob.kind === 'SLA_RESOLUTION_DUE') {
      await prisma.$transaction(async (tx) => {
        const runtimeTx = tx as any;
        await runtimeTx.slaClock.update({
          where: { id: clock.id },
          data: { status: 'BREACHED', escalationLevel: { increment: 1 } },
        });
        await runtimeTx.requestActivity.create({
          data: {
            requestId: request.id,
            authorId: request.requesterId,
            authorName: 'System',
            activityType: 'SYSTEM',
            message: `SLA BREACH:${clock.id} — ${clock.kind.toLowerCase()} clock exceeded its due time.`,
            isSystemGenerated: true,
            metadata: { clockId: clock.id, timerJobId: timerJob.id, breachedAt: now.toISOString(), dueAt: clock.dueAt.toISOString() },
          },
        });
        await runtimeTx.outboxEvent.create({
          data: {
            tenantId: timerJob.tenantId,
            departmentId: timerJob.departmentId ?? request.departmentId,
            eventType: 'SLA_TIMER_BREACHED',
            aggregateId: request.id,
            aggregateVersion: Number(clock.escalationLevel ?? 0) + 1,
            payload: { requestId: request.id, clockId: clock.id, timerJobId: timerJob.id, kind: timerJob.kind, dueAt: clock.dueAt.toISOString() },
          },
        }).catch(() => undefined);
      });

      const recipientId = request.assignedToId || request.requesterId;
      if (recipientId) {
        await notify({
          userId: recipientId,
          eventType: 'SLA_BREACHED',
          variables: {
            referenceNumber: request.referenceNumber,
            slaDeadline: clock.dueAt.toISOString(),
          },
          relatedRequestId: request.id,
        }).catch((error) => logger.warn('[SLA Timer] Breach notification failed', { error: String(error) }));
      }
    }

    await completeTimer(timerJob.id);
    return { processed: true, status: 'COMPLETED' };
  } catch (error) {
    await markTimerFailure(timerJob, error, now);
    throw error;
  }
}

export async function runDueSlaTimers(limit = 50, now = new Date()) {
  const dueJobs = await db.slaTimerJob.findMany({
    where: {
      status: { in: ['SCHEDULED', 'FAILED'] },
      runAt: { lte: now },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { runAt: 'asc' },
    take: limit,
  });

  let processed = 0;
  for (const job of dueJobs) {
    const result = await processSlaTimerJob(job.id, { now });
    if (result.processed) processed++;
  }
  return processed;
}

let worker: Worker | null = null;

export function startSlaTimerWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(
    SLA_TIMER_QUEUE_NAME,
    async (job: Job<{ timerJobId: string }>) => processSlaTimerJob(job.data.timerJobId),
    { connection: getRedisConnectionConfig(), concurrency: Number(process.env.SLA_TIMER_WORKER_CONCURRENCY || 5) },
  );
  worker.on('failed', (job, error) => logger.error('[SLA Timer] Worker job failed', { jobId: job?.id, error: String(error) }));
  worker.on('completed', (job) => logger.debug('[SLA Timer] Worker job completed', { jobId: job.id }));
  return worker;
}

export async function stopSlaTimerWorker(): Promise<void> {
  if (!worker) return;
  await worker.close();
  worker = null;
}
