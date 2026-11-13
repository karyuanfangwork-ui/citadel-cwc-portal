import type { Queue } from 'bullmq';

/**
 * Release every background queue and worker without requiring callers to know
 * which subsystem was imported by a test or application path.
 */
type EagerQueueName = 'credit queues' | 'pdf queue' | 'attachment scan queue';
const eagerQueueClosers = new Map<EagerQueueName, () => Promise<unknown>>();

/** Eager BullMQ modules register on import; teardown must not import cold queues. */
export function registerQueueShutdown(name: EagerQueueName, close: () => Promise<unknown>): void {
  eagerQueueClosers.set(name, close);
}

/** BullMQ removes error listeners on close; let an in-flight init settle first. */
export async function closeQueueAfterInitialization(queue: Pick<Queue, 'waitUntilReady' | 'close'>): Promise<void> {
  try {
    // BullMQ starts initialization in the constructor; this awaits that promise.
    await queue.waitUntilReady();
  } catch {
    /* connection failed; close still releases its resources */
  }
  await queue.close();
}

export async function shutdownAllQueues(): Promise<void> {
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['credit queues', () => eagerQueueClosers.get('credit queues')?.() ?? Promise.resolve()],
    ['pdf queue', () => eagerQueueClosers.get('pdf queue')?.() ?? Promise.resolve()],
    ['attachment scan queue', () => eagerQueueClosers.get('attachment scan queue')?.() ?? Promise.resolve()],
    ['cache redis', async () => {
      const m = await import('../utils/cache');
      return m.closeCacheRedis();
    }],
    ['sla timer queue', async () => {
      const m = await import('./timer.queue');
      return m.closeSlaTimerQueue();
    }],
    ['sla timer worker', async () => {
      const m = await import('../workers/timer.worker');
      return m.stopSlaTimerWorker();
    }],
    ['monitor job', async () => {
      const m = await import('../credit/jobs/monitor.job');
      return m.stopMonitorJob();
    }],
  ];

  for (const [, run] of steps) {
    try {
      await run();
    } catch {
      /* subsystem not loaded, or already shut down */
    }
  }
}