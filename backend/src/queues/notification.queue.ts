import { Queue } from 'bullmq';
import { config } from '../config';
import { logger } from '../utils/logger';

export const NOTIFICATION_QUEUE_NAME = 'notification-delivery';

export interface NotificationDeliveryJobData {
  deliveryId: string;
}

let queue: Queue<NotificationDeliveryJobData> | null = null;

export function getNotificationQueue(): Queue<NotificationDeliveryJobData> | null {
  if (process.env.NOTIFICATION_QUEUE_ENABLED === 'false') return null;
  if (queue) return queue;

  queue = new Queue<NotificationDeliveryJobData>(NOTIFICATION_QUEUE_NAME, {
    connection: { url: config.redis.url },
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 60_000 },
      removeOnComplete: 1000,
      removeOnFail: false,
    },
  });

  return queue;
}

export async function enqueueNotificationDelivery(deliveryId: string, delayMs = 0): Promise<void> {
  const notificationQueue = getNotificationQueue();
  if (!notificationQueue) return;

  await notificationQueue.add(
    'deliver-notification',
    { deliveryId },
    {
      jobId: `notification-delivery:${deliveryId}`,
      delay: Math.max(0, delayMs),
    },
  );
}

export async function closeNotificationQueue(): Promise<void> {
  if (!queue) return;
  await queue.close().catch((error) => logger.warn('Failed to close notification queue', { error }));
  queue = null;
}
