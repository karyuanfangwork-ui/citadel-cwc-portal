import { Queue } from 'bullmq';
import { getRedisConnectionConfig } from '../../utils/redis';

// BullMQ queue names cannot contain colons — use dots as namespace separator
const QUEUE_NAMES = {
  SCREENING: 'credit.screening.run',
  OCR: 'credit.ocr.extract',
  SCORE: 'credit.score.run',
  MONITOR: 'credit.monitor.daily',
  REPORT: 'credit.report.run',
  AI: 'credit.ai.invoke',
  NOTIFY: 'credit.notify.send',
} as const;

const connection = getRedisConnectionConfig();

const defaultJobOptions = {
  removeOnComplete: 1000,
  removeOnFail: 5000,
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
};

export const screeningQueue = new Queue(QUEUE_NAMES.SCREENING, { connection, defaultJobOptions });
export const ocrQueue = new Queue(QUEUE_NAMES.OCR, { connection, defaultJobOptions });
export const scoreQueue = new Queue(QUEUE_NAMES.SCORE, { connection, defaultJobOptions });
export const monitorQueue = new Queue(QUEUE_NAMES.MONITOR, { connection, defaultJobOptions });
export const reportQueue = new Queue(QUEUE_NAMES.REPORT, { connection, defaultJobOptions });
export const aiQueue = new Queue(QUEUE_NAMES.AI, { connection, defaultJobOptions });
export const notifyQueue = new Queue(QUEUE_NAMES.NOTIFY, { connection, defaultJobOptions });

export { connection, QUEUE_NAMES };

const queues = {
  [QUEUE_NAMES.SCREENING]: screeningQueue,
  [QUEUE_NAMES.OCR]: ocrQueue,
  [QUEUE_NAMES.SCORE]: scoreQueue,
  [QUEUE_NAMES.MONITOR]: monitorQueue,
  [QUEUE_NAMES.REPORT]: reportQueue,
  [QUEUE_NAMES.AI]: aiQueue,
  [QUEUE_NAMES.NOTIFY]: notifyQueue,
};

/**
 * Close all credit queues.
 *
 * Each Queue is constructed with a connection config object, so BullMQ builds
 * and owns its own ioredis instance — queue.close() disposes of it. Do not read
 * queue.client: that getter forces a connection during teardown.
 */
export async function closeCreditQueues(): Promise<void> {
  await Promise.all(
    Object.values(queues).map(async (queue) => {
      try {
        await queue.close();
      } catch {
        /* already closed */
      }
    }),
  );
}

export async function getQueueHealth(): Promise<Record<string, any>> {
  const health: Record<string, any> = {};

  for (const [name, queue] of Object.entries(queues)) {
    const counts = await queue.getJobCounts();
    health[name] = {
      waiting: counts.waiting,
      active: counts.active,
      completed: counts.completed,
      failed: counts.failed,
      delayed: counts.delayed,
    };
  }

  return health;
}