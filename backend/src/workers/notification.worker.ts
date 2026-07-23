import { Worker } from 'bullmq';
import { config } from '../config';
import { logger } from '../utils/logger';
import { deliverNotification, deliverPendingNotifications } from '../services/notification.service';
import { NOTIFICATION_QUEUE_NAME, NotificationDeliveryJobData } from '../queues/notification.queue';

let worker: Worker<NotificationDeliveryJobData> | null = null;

export function startNotificationWorker(): Worker<NotificationDeliveryJobData> | null {
  if (process.env.NOTIFICATION_QUEUE_ENABLED === 'false') return null;
  if (worker) return worker;

  worker = new Worker<NotificationDeliveryJobData>(
    NOTIFICATION_QUEUE_NAME,
    async (job) => {
      await deliverNotification(job.data.deliveryId);
    },
    {
      connection: { url: config.redis.url },
      concurrency: Number(process.env.NOTIFICATION_WORKER_CONCURRENCY ?? 5),
    },
  );

  worker.on('failed', (job, error) => {
    logger.error('Notification delivery job failed', {
      deliveryId: job?.data.deliveryId,
      error,
    });
  });

  logger.info('Notification delivery worker started');
  return worker;
}

export async function stopNotificationWorker(): Promise<void> {
  if (!worker) return;
  await worker.close().catch((error) => logger.warn('Failed to close notification worker', { error }));
  worker = null;
}

export async function runDueNotificationDeliveries(limit = 100): Promise<number> {
  return deliverPendingNotifications(limit);
}
