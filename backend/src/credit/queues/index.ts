import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../../config';

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

const connection = new Redis(config.redis.url, { maxRetriesPerRequest: null });

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