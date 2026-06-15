import { Queue } from 'bullmq';
import { getRedisConnectionConfig } from '../utils/redis';

export const PDF_QUEUE_NAME = 'pdf.generation';

export const pdfQueue = new Queue(PDF_QUEUE_NAME, {
  connection: getRedisConnectionConfig(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 500,
    removeOnFail: 1000,
  },
});