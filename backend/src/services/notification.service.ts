import prisma from '../utils/prisma';
import crypto from 'crypto';
import { sendEmail, renderTemplate } from './email.service';
import { logger } from '../utils/logger';
import { pushToUser } from '../utils/sseClients';
import { config } from '../config';
import { registerEmailEnabledCacheInvalidator } from '../controllers/systemSetting.controller';
import { enqueueNotificationDelivery } from '../queues/notification.queue';

// Global email toggle — 30-second TTL cache to avoid a DB hit on every notification
let _emailEnabledCache: { value: boolean; expiresAt: number } | null = null;

registerEmailEnabledCacheInvalidator(() => { _emailEnabledCache = null; });

type PrismaLike = typeof prisma;
type TxClient = PrismaLike | any;

type NotificationChannelName = 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH';
type NotificationClassificationName = 'PUBLIC' | 'INTERNAL' | 'HR_CONFIDENTIAL' | 'FINANCE_CONFIDENTIAL' | 'RESTRICTED';

interface NotifyOptions {
  userId: string;
  eventType: string;
  variables: Record<string, string>;
  relatedRequestId?: string;
  /** If true, wrap the rendered email body in the branded layout (default: true) */
  wrapInLayout?: boolean;
}

export interface PublishDomainEventInput {
  eventKey: string;
  tenantId: string;
  departmentId?: string | null;
  eventType: string;
  classification?: NotificationClassificationName;
  resourceType: string;
  resourceId?: string | null;
  payloadVersion?: number;
  payload: Record<string, unknown>;
  occurredAt?: Date;
  recipientIds?: string[];
  channels?: NotificationChannelName[];
}

interface MaterializedNotificationContent {
  pushSubject: string;
  pushBodyText: string;
  emailSubject: string;
  emailBodyHtml: string;
  relatedRequestId?: string | null;
  wrapInLayout: boolean;
}

async function isEmailGloballyEnabled(): Promise<boolean> {
  const now = Date.now();
  if (_emailEnabledCache && now < _emailEnabledCache.expiresAt) {
    return _emailEnabledCache.value;
  }
  const setting = await prisma.systemSetting.findUnique({ where: { key: 'email_notifications_enabled' } });
  const value = setting ? setting.value === 'true' : true;
  _emailEnabledCache = { value, expiresAt: now + 30_000 };
  return value;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values.filter(Boolean))];
}

function retryDelay(attemptCount: number): Date {
  const delayMs = Math.min(60_000 * Math.max(1, 2 ** attemptCount), 15 * 60_000);
  return new Date(Date.now() + delayMs);
}

// A provider call is not transactional with the database. Hold a delivery lease
// while it is in flight so concurrent workers cannot send the same delivery.
// If a worker dies, the lease expires and the delivery becomes retryable.
const DELIVERY_LEASE_MS = 10 * 60_000;

function isScopedClassification(classification: NotificationClassificationName): boolean {
  return ['HR_CONFIDENTIAL', 'FINANCE_CONFIDENTIAL', 'RESTRICTED'].includes(classification);
}

async function resolveAuthorizedRecipients(
  db: TxClient,
  event: Pick<PublishDomainEventInput, 'tenantId' | 'departmentId' | 'classification' | 'recipientIds'>,
): Promise<string[]> {
  const recipientIds = unique(event.recipientIds ?? []);
  if (recipientIds.length === 0) return [];

  const classification = event.classification ?? 'INTERNAL';
  const users = await db.user.findMany({
    where: {
      id: { in: recipientIds },
      tenantId: event.tenantId,
      isActive: true,
    },
    select: { id: true },
  });

  const activeTenantRecipientIds = users.map((user: { id: string }) => user.id);
  if (!isScopedClassification(classification)) {
    return activeTenantRecipientIds;
  }

  if (!event.departmentId) {
    return [];
  }

  const memberships = await db.departmentMembership.findMany({
    where: {
      tenantId: event.tenantId,
      departmentId: event.departmentId,
      userId: { in: activeTenantRecipientIds },
      validFrom: { lte: new Date() },
      OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
    },
    select: { userId: true },
  });

  return unique(memberships.map((membership: { userId: string }) => membership.userId));
}

export async function resolveRecipients(event: PublishDomainEventInput): Promise<string[]> {
  return resolveAuthorizedRecipients(prisma, event);
}

export async function publishDomainEvent(tx: TxClient, input: PublishDomainEventInput): Promise<{ eventId: string; deliveryIds: string[] }> {
  const channels = unique(input.channels ?? ['IN_APP']);
  const classification = input.classification ?? 'INTERNAL';
  const payloadVersion = input.payloadVersion ?? 1;
  const occurredAt = input.occurredAt ?? new Date();

  const event = await tx.notificationDomainEvent.upsert({
    where: {
      tenantId_eventKey: {
        tenantId: input.tenantId,
        eventKey: input.eventKey,
      },
    },
    update: {},
    create: {
      eventKey: input.eventKey,
      tenantId: input.tenantId,
      departmentId: input.departmentId ?? null,
      eventType: input.eventType,
      classification,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      payloadVersion,
      payload: input.payload,
      occurredAt,
    },
    select: { id: true },
  });

  const recipients = await resolveAuthorizedRecipients(tx, { ...input, classification });
  if (recipients.length === 0 || channels.length === 0) {
    return { eventId: event.id, deliveryIds: [] };
  }

  await tx.notificationDelivery.createMany({
    data: recipients.flatMap((recipientId) => channels.map((channel) => ({
      eventId: event.id,
      tenantId: input.tenantId,
      departmentId: input.departmentId ?? null,
      recipientId,
      channel,
      status: 'PENDING',
    }))),
    skipDuplicates: true,
  });

  const deliveries = await tx.notificationDelivery.findMany({
    where: {
      eventId: event.id,
      recipientId: { in: recipients },
      channel: { in: channels },
    },
    select: { id: true },
  });

  return { eventId: event.id, deliveryIds: deliveries.map((delivery: { id: string }) => delivery.id) };
}

async function loadRelatedRequestVars(relatedRequestId?: string | null): Promise<Record<string, string>> {
  if (!relatedRequestId) return {};

  const relatedReq = await prisma.request.findUnique({
    where: { id: relatedRequestId },
    select: {
      referenceNumber: true,
      summary: true,
      customFields: true,
      status: true,
      priority: true,
      requester: { select: { firstName: true, lastName: true } },
      assignedTo: { select: { firstName: true, lastName: true } },
      serviceDesk: { select: { name: true } },
      requestType: { select: { name: true } },
    },
  });

  if (!relatedReq) return {};

  const customFields = (relatedReq.customFields ?? {}) as Record<string, unknown>;
  const amountValue = customFields.finalizedAmount
    ?? customFields.amount
    ?? customFields.estimatedCost
    ?? null;
  const numericAmount = typeof amountValue === 'number'
    || (typeof amountValue === 'string' && amountValue.trim() !== '' && Number.isFinite(Number(amountValue)))
    ? Number(amountValue)
    : null;
  const amount = numericAmount !== null
    ? numericAmount.toFixed(2)
    : amountValue === null || amountValue === undefined || amountValue === ''
      ? 'Not available'
      : String(amountValue);
  const currency = typeof customFields.currency === 'string' && customFields.currency.trim()
    ? customFields.currency.trim()
    : 'MYR';

  const requesterName = relatedReq.requester
    ? `${relatedReq.requester.firstName} ${relatedReq.requester.lastName}`
    : '';
  const assigneeName = relatedReq.assignedTo
    ? `${relatedReq.assignedTo.firstName} ${relatedReq.assignedTo.lastName}`
    : '';

  return {
    requestId: relatedReq.referenceNumber,
    requestTitle: relatedReq.summary,
    referenceNumber: relatedReq.referenceNumber,
    summary: relatedReq.summary,
    requestUuid: relatedRequestId,
    status: relatedReq.status,
    priority: relatedReq.priority ?? '',
    requesterName,
    assigneeName,
    categoryName: relatedReq.serviceDesk?.name ?? '',
    requestTypeName: relatedReq.requestType?.name ?? '',
    amount,
    currency,
  };
}

async function materializeContent(delivery: any): Promise<MaterializedNotificationContent> {
  const event = delivery.event;
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const variables = (payload.variables ?? {}) as Record<string, string>;
  const relatedRequestId = typeof payload.relatedRequestId === 'string' ? payload.relatedRequestId : null;
  const wrapInLayout = payload.wrapInLayout !== false;

  const template = await prisma.notificationTemplate.findFirst({
    where: {
      eventType: event.eventType,
      isActive: true,
      OR: [{ tenantId: event.tenantId }, { tenantId: null }],
    },
    orderBy: [{ tenantId: 'desc' }, { updatedAt: 'desc' }],
  });

  const recipientUser = delivery.recipient;
  const userName = recipientUser ? `${recipientUser.firstName} ${recipientUser.lastName}` : '';
  const requestVars = await loadRelatedRequestVars(relatedRequestId);
  const enrichedVars: Record<string, string> = {
    ...variables,
    ...requestVars,
    userName,
    appUrl: variables.appUrl || config.app.url,
  };

  const fallbackSubject = typeof payload.subject === 'string'
    ? payload.subject
    : `Notification: ${event.eventType}`;
  const fallbackBody = typeof payload.body === 'string'
    ? payload.body
    : `Event: ${event.eventType}`;

  const pushSubject = template
    ? renderTemplate(template.pushTitle ?? template.emailSubject ?? '', enrichedVars)
    : fallbackSubject;
  const pushBodyText = template
    ? renderTemplate(template.pushBody ?? '', enrichedVars)
    : fallbackBody;

  const emailSubject = template
    ? renderTemplate(template.emailSubject ?? '', enrichedVars)
    : fallbackSubject;
  const emailBodyHtml = template
    ? renderTemplate(template.emailBody ?? '', enrichedVars)
    : fallbackBody;

  return { pushSubject, pushBodyText, emailSubject, emailBodyHtml, relatedRequestId, wrapInLayout };
}

async function isDeliveryRecipientStillAuthorized(delivery: any): Promise<boolean> {
  const event = delivery.event;
  const authorized = await resolveAuthorizedRecipients(prisma, {
    tenantId: event.tenantId,
    departmentId: event.departmentId,
    classification: event.classification,
    recipientIds: [delivery.recipientId],
  });
  return authorized.includes(delivery.recipientId);
}

export async function deliverNotification(deliveryId: string): Promise<void> {
  const delivery = await (prisma as any).notificationDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      event: true,
      recipient: { select: { id: true, email: true, firstName: true, lastName: true, tenantId: true } },
      notification: true,
    },
  });

  if (!delivery) return;
  if (['SENT', 'CANCELLED'].includes(delivery.status)) return;

  const claimed = await (prisma as any).notificationDelivery.updateMany({
    where: {
      id: delivery.id,
      status: { in: ['PENDING', 'RETRYING'] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
    },
    data: {
      status: 'RETRYING',
      attemptCount: { increment: 1 },
      nextAttemptAt: new Date(Date.now() + DELIVERY_LEASE_MS),
    },
  });

  // Another worker owns the delivery, or it was completed while this worker
  // was loading it. Never call the provider unless this worker acquired it.
  if (claimed.count !== 1) return;

  const authorized = await isDeliveryRecipientStillAuthorized(delivery);
  if (!authorized) {
    await (prisma as any).notificationDelivery.update({
      where: { id: delivery.id },
      data: { status: 'CANCELLED', errorMessage: 'Recipient is not authorized for notification event scope' },
    });
    return;
  }

  const content = await materializeContent(delivery);

  if (delivery.channel === 'IN_APP') {
    const notification = await (prisma as any).notification.upsert({
      where: { deliveryId: delivery.id },
      update: {},
      create: {
        deliveryId: delivery.id,
        userId: delivery.recipientId,
        tenantId: delivery.tenantId,
        channel: 'IN_APP',
        subject: content.pushSubject,
        body: content.pushBodyText,
        relatedRequestId: content.relatedRequestId ?? null,
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    await (prisma as any).notificationDelivery.update({
      where: { id: delivery.id },
      data: { status: 'SENT', deliveredAt: new Date(), attemptCount: { increment: 1 }, errorMessage: null },
    });

    // SSE is a wake-up channel only: inbox row is committed before publishing.
    pushToUser(delivery.recipientId, 'notification', {
      id: notification.id,
      cursor: notification.id,
      subject: notification.subject,
      body: notification.body,
      relatedRequestId: notification.relatedRequestId ?? null,
      createdAt: notification.createdAt,
    });
    return;
  }

  if (delivery.channel === 'EMAIL') {
    if (!delivery.recipient?.email) {
      await (prisma as any).notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: 'CANCELLED', errorMessage: 'Recipient has no email address' },
      });
      return;
    }

    const globallyEnabled = await isEmailGloballyEnabled();
    if (!globallyEnabled) {
      logger.info(`[EmailToggle] Email globally disabled — skipping email for ${delivery.event.eventType} to ${delivery.recipient.email}`);
      await (prisma as any).notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: 'CANCELLED', errorMessage: 'Email globally disabled' },
      });
      return;
    }

    const emailSent = await sendEmail(delivery.recipient.email, content.emailSubject, content.emailBodyHtml, { wrapInLayout: content.wrapInLayout });
    if (!emailSent) {
      await (prisma as any).notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'RETRYING',
          nextAttemptAt: retryDelay(delivery.attemptCount + 1),
          errorMessage: 'SMTP delivery failed',
        },
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await (tx as any).notification.upsert({
        where: { deliveryId: delivery.id },
        update: {},
        create: {
          deliveryId: delivery.id,
          userId: delivery.recipientId,
          tenantId: delivery.tenantId,
          channel: 'EMAIL',
          subject: content.emailSubject,
          body: content.emailBodyHtml,
          relatedRequestId: content.relatedRequestId ?? null,
          status: 'SENT',
          sentAt: new Date(),
        },
      });
      await (tx as any).notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: 'SENT', deliveredAt: new Date(), attemptCount: { increment: 1 }, errorMessage: null },
      });
    });
  }
}

export async function deliverPendingNotifications(limit = 100): Promise<number> {
  const deliveries = await (prisma as any).notificationDelivery.findMany({
    where: {
      status: { in: ['PENDING', 'RETRYING'] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true },
  });

  let processed = 0;
  for (const delivery of deliveries) {
    await deliverNotification(delivery.id);
    processed += 1;
  }
  return processed;
}

export async function notify(options: NotifyOptions): Promise<void> {
  const { userId, eventType, variables, relatedRequestId, wrapInLayout = true } = options;

  const recipientUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { tenantId: true, email: true },
  });
  if (!recipientUser?.tenantId) {
    logger.warn(`Skipping notification for missing or tenantless user ${userId}`, { eventType });
    return;
  }
  const tenantId: string = recipientUser.tenantId as string;

  const channels: NotificationChannelName[] = recipientUser.email ? ['IN_APP', 'EMAIL'] : ['IN_APP'];
  const eventDigest = crypto
    .createHash('sha256')
    .update(JSON.stringify({ eventType, relatedRequestId: relatedRequestId ?? null, userId, variables }))
    .digest('hex');
  const eventKey = `legacy:${eventType}:${eventDigest}`;

  const result = await prisma.$transaction((tx) => publishDomainEvent(tx, {
    eventKey,
    tenantId,
    eventType,
    classification: 'INTERNAL',
    resourceType: relatedRequestId ? 'request' : 'notification',
    resourceId: relatedRequestId ?? null,
    payload: { variables, relatedRequestId: relatedRequestId ?? null, wrapInLayout },
    recipientIds: [userId],
    channels,
  }));

  for (const deliveryId of result.deliveryIds) {
    await deliverNotification(deliveryId);
  }
}

/**
 * Create notification deliveries without performing provider delivery inline.
 * The notification worker owns delivery and BullMQ retries failed jobs.
 */
export async function notifyDurably(options: NotifyOptions): Promise<void> {
  const { userId, eventType, variables, relatedRequestId, wrapInLayout = true } = options;

  const recipientUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { tenantId: true, email: true },
  });
  if (!recipientUser?.tenantId) {
    logger.warn(`Skipping notification for missing or tenantless user ${userId}`, { eventType });
    return;
  }

  const eventDigest = crypto
    .createHash('sha256')
    .update(JSON.stringify({ eventType, relatedRequestId: relatedRequestId ?? null, userId, variables }))
    .digest('hex');
  const result = await prisma.$transaction((tx) => publishDomainEvent(tx, {
    eventKey: `legacy:${eventType}:${eventDigest}`,
    tenantId: recipientUser.tenantId as string,
    eventType,
    classification: 'INTERNAL',
    resourceType: relatedRequestId ? 'request' : 'notification',
    resourceId: relatedRequestId ?? null,
    payload: { variables, relatedRequestId: relatedRequestId ?? null, wrapInLayout },
    recipientIds: [userId],
    channels: recipientUser.email ? ['IN_APP', 'EMAIL'] : ['IN_APP'],
  }));

  for (const deliveryId of result.deliveryIds) {
    await enqueueNotificationDelivery(deliveryId);
  }
}

export async function notifyMultiple(
  userIds: string[],
  eventType: string,
  variables: Record<string, string>,
  relatedRequestId?: string,
): Promise<void> {
  const uniqueIds = unique(userIds);
  const results = await Promise.allSettled(
    uniqueIds.map((userId) => notify({ userId, eventType, variables, relatedRequestId })),
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      logger.error('Failed to create notification in notifyMultiple', { error: result.reason, eventType });
    }
  }
}
