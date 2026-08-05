/**
 * Sprint 4 — Webhook / Event Subscription Service
 *
 * Manages webhook subscriptions and delivers signed payloads to external
 * systems on key credit lifecycle events.
 *
 * Delivery flow:
 * 1. dispatchEvent() is called from transition/approval flows
 * 2. Matching subscriptions are looked up by event type
 * 3. A WebhookDelivery record is created (PENDING)
 * 4. Payload is sent via HTTP POST with HMAC-SHA256 signature
 * 5. On failure, retry up to maxRetries with exponential backoff
 */
import prisma from '../../utils/prisma';
import crypto from 'crypto';
import { logger } from '../../utils/logger';

export interface WebhookPayload {
  eventType: string;
  applicationId: string;
  applicationNo?: string;
  borrowerName?: string;
  state?: string;
  timestamp: string;
  [key: string]: any;
}

class WebhookService {
  /**
   * Dispatch a webhook event to all matching active subscriptions.
   * Non-blocking — failures are logged but never throw.
   */
  async dispatchEvent(eventType: string, payload: WebhookPayload): Promise<void> {
    try {
      const subscriptions = await prisma.webhookSubscription.findMany({
        where: {
          isActive: true,
          events: { has: eventType },
        },
      });

      if (subscriptions.length === 0) return;

      for (const sub of subscriptions) {
        await this.createDelivery(sub.id, sub.secret, eventType, payload);
      }
    } catch (err) {
      logger.error(`[Webhook] Failed to dispatch event ${eventType}:`, err);
    }
  }

  /**
   * Create a delivery record and attempt to send the webhook.
   */
  private async createDelivery(
    subscriptionId: string,
    secret: string | null,
    eventType: string,
    payload: WebhookPayload,
  ): Promise<void> {
    const body = JSON.stringify(payload);

    // Create delivery record
    const delivery = await prisma.webhookDelivery.create({
      data: {
        subscriptionId,
        eventType,
        payload: body as any,
        status: 'PENDING',
      },
    });

    // Attempt delivery
    await this.attemptDelivery(delivery.id, subscriptionId, secret, body);
  }

  /**
   * Attempt to deliver a webhook payload with HMAC signing.
   */
  private async attemptDelivery(
    deliveryId: string,
    subscriptionId: string,
    secret: string | null,
    body: string,
  ): Promise<void> {
    const subscription = await prisma.webhookSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription || !subscription.isActive) return;

    const attemptCount = await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { attemptCount: { increment: 1 } },
      select: { attemptCount: true },
    });

    // Compute HMAC signature
    const signature = secret
      ? crypto.createHmac('sha256', secret).update(body).digest('hex')
      : null;

    try {
      const response = await fetch(subscription.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(signature ? { 'X-Webhook-Signature': signature } : {}),
        },
        body,
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      const responseBody = await response.text().catch(() => '');

      if (response.ok) {
        await prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: 'DELIVERED',
            responseCode: response.status,
            responseBody: responseBody.slice(0, 2000),
            deliveredAt: new Date(),
          },
        });
      } else {
        await this.handleDeliveryFailure(deliveryId, subscription, response.status, responseBody, attemptCount.attemptCount);
      }
    } catch (err: any) {
      await this.handleDeliveryFailure(deliveryId, subscription, null, err.message, attemptCount.attemptCount);
    }
  }

  /**
   * Handle a failed delivery — retry or mark as failed.
   */
  private async handleDeliveryFailure(
    deliveryId: string,
    subscription: { maxRetries: number; retryDelaySec: number },
    responseCode: number | null,
    error: string,
    currentAttempt: number,
  ): Promise<void> {
    if (currentAttempt < subscription.maxRetries) {
      // Schedule retry
      const delaySec = subscription.retryDelaySec * Math.pow(2, currentAttempt - 1);
      const nextRetryAt = new Date(Date.now() + delaySec * 1000);
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'RETRY',
          responseCode,
          error: error.slice(0, 2000),
          nextRetryAt,
        },
      });
      logger.info(`[Webhook] Delivery ${deliveryId} will retry in ${delaySec}s (attempt ${currentAttempt}/${subscription.maxRetries})`);
    } else {
      // Max retries exhausted
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'FAILED',
          responseCode,
          error: error.slice(0, 2000),
        },
      });
      logger.warn(`[Webhook] Delivery ${deliveryId} failed after ${currentAttempt} attempts`);
    }
  }

  /**
   * Process pending retries — called by a scheduled job.
   */
  async processRetries(): Promise<number> {
    const now = new Date();
    const pending = await prisma.webhookDelivery.findMany({
      where: {
        status: 'RETRY',
        nextRetryAt: { lte: now },
      },
      include: { subscription: true },
      take: 50,
    });

    for (const delivery of pending) {
      const body = JSON.stringify(delivery.payload);
      await this.attemptDelivery(delivery.id, delivery.subscriptionId, delivery.subscription.secret, body);
    }

    return pending.length;
  }

  // ── CRUD for subscriptions ──

  async listSubscriptions() {
    return prisma.webhookSubscription.findMany({
      where: { isActive: true },
      include: { _count: { select: { deliveries: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSubscription(data: {
    name: string;
    url: string;
    secret?: string;
    events: string[];
    maxRetries?: number;
    retryDelaySec?: number;
  }) {
    return prisma.webhookSubscription.create({
      data: {
        name: data.name,
        url: data.url,
        secret: data.secret ?? null,
        events: data.events,
        maxRetries: data.maxRetries ?? 3,
        retryDelaySec: data.retryDelaySec ?? 60,
      },
    });
  }

  async deleteSubscription(id: string) {
    return prisma.webhookSubscription.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async listDeliveries(subscriptionId?: string, limit = 50) {
    const where = subscriptionId ? { subscriptionId } : {};
    return prisma.webhookDelivery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { subscription: { select: { name: true, url: true } } },
    });
  }
}

export const webhookService = new WebhookService();