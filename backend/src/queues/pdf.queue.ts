import { Queue } from 'bullmq';
import { getRedisConnectionConfig } from '../utils/redis';
import { closeQueueAfterInitialization, registerQueueShutdown } from './shutdown';

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

/** Close the PDF queue. BullMQ owns the connection, so close() is sufficient. */
export async function closePdfQueue(): Promise<void> {
  try {
    await closeQueueAfterInitialization(pdfQueue);
  } catch {
    /* already closed */
  }
}

registerQueueShutdown('pdf queue', closePdfQueue);