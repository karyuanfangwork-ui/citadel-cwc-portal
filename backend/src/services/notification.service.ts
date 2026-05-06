import prisma from '../utils/prisma';
import { sendEmail, renderTemplate } from './email.service';
import { logger } from '../utils/logger';
import { pushToUser } from '../utils/sseClients';
import { config } from '../config';
import { registerEmailEnabledCacheInvalidator } from '../controllers/systemSetting.controller';

// Global email toggle — 30-second TTL cache to avoid a DB hit on every notification
let _emailEnabledCache: { value: boolean; expiresAt: number } | null = null;

registerEmailEnabledCacheInvalidator(() => { _emailEnabledCache = null; });

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

interface NotifyOptions {
  userId: string;
  eventType: string;
  variables: Record<string, string>;
  relatedRequestId?: string;
  /** If true, wrap the rendered email body in the branded layout (default: true) */
  wrapInLayout?: boolean;
}

export async function notify(options: NotifyOptions): Promise<void> {
  const { userId, eventType, variables, relatedRequestId, wrapInLayout = true } = options;

  try {
    // Find template
    const template = await prisma.notificationTemplate.findFirst({
      where: { eventType, isActive: true },
    });

    // ── Auto-enrich variables from the database ──────────────────────
    // Resolve the recipient user so we always have {{userName}}
    const recipientUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true },
    });
    const userName = recipientUser
      ? `${recipientUser.firstName} ${recipientUser.lastName}`
      : '';

    // Resolve the related request so templates can use consistent variable names
    // regardless of what individual controllers choose to pass in.
    let requestVars: Record<string, string> = {};
    if (relatedRequestId) {
      const relatedReq = await prisma.request.findUnique({
        where: { id: relatedRequestId },
        select: {
          referenceNumber: true,
          summary: true,
          status: true,
          priority: true,
          requester: { select: { firstName: true, lastName: true } },
          assignedTo: { select: { firstName: true, lastName: true } },
          serviceDesk: { select: { name: true } },
          requestType: { select: { name: true } },
        },
      });

      if (relatedReq) {
        const requesterName = relatedReq.requester
          ? `${relatedReq.requester.firstName} ${relatedReq.requester.lastName}`
          : '';
        const assigneeName = relatedReq.assignedTo
          ? `${relatedReq.assignedTo.firstName} ${relatedReq.assignedTo.lastName}`
          : '';

        requestVars = {
          // Primary display name — human-readable reference (e.g. "IT-5", "HR-12")
          requestId:       relatedReq.referenceNumber,
          requestTitle:    relatedReq.summary,
          // Legacy aliases: some controllers pass referenceNumber/summary instead
          referenceNumber: relatedReq.referenceNumber,
          summary:         relatedReq.summary,
          // UUID for building links — must NOT be shown to users in display text
          requestUuid:     relatedRequestId!,
          // Contextual fields
          status:          relatedReq.status,
          priority:        relatedReq.priority ?? '',
          requesterName,
          assigneeName,
          categoryName:    relatedReq.serviceDesk?.name ?? '',
          requestTypeName: relatedReq.requestType?.name ?? '',
        };
      }
    }

    // Merge order (highest precedence last):
    //   1. Caller-supplied variables (e.g. newStatus, comments, decision)
    //   2. Auto-resolved request fields — override caller's requestId with
    //      the human-readable referenceNumber (callers often pass the UUID)
    //   3. Recipient userName (always from DB, not caller)
    //   4. appUrl
    const enrichedVars: Record<string, string> = {
      ...variables,
      ...requestVars,
      userName,
      appUrl: variables.appUrl || config.app.url,
    };

    const subject = template
      ? renderTemplate(template.emailSubject ?? '', enrichedVars)
      : `Notification: ${eventType}`;
    const body = template
      ? renderTemplate(template.emailBody ?? '', enrichedVars)
      : `Event: ${eventType}`;

    // Create in-app notification
    const inAppNotification = await prisma.notification.create({
      data: {
        userId,
        channel: 'IN_APP',
        subject,
        body,
        relatedRequestId,
        status: 'SENT',
      },
    });

    // Push real-time event to any connected SSE client for this user
    pushToUser(userId, 'notification', {
      id: inAppNotification.id,
      subject,
      body,
      relatedRequestId: relatedRequestId ?? null,
      createdAt: inAppNotification.createdAt,
    });

    // Send email notification
    if (recipientUser?.email) {
      const globallyEnabled = await isEmailGloballyEnabled();
      if (!globallyEnabled) {
        logger.info(`[EmailToggle] Email globally disabled — skipping email for ${eventType} to ${recipientUser.email}`);
      } else {
        const emailSent = await sendEmail(recipientUser.email, subject, body, { wrapInLayout });
        await prisma.notification.create({
          data: {
            userId,
            channel: 'EMAIL',
            subject,
            body,
            relatedRequestId: relatedRequestId ?? null,
            status: emailSent ? 'SENT' : 'FAILED',
            sentAt: emailSent ? new Date() : undefined,
            errorMessage: emailSent ? undefined : 'SMTP delivery failed',
          },
        });
      }
    }
  } catch (error) {
    logger.error(`Failed to create notification for user ${userId}`, { error, eventType });
  }
}

export async function notifyMultiple(
  userIds: string[],
  eventType: string,
  variables: Record<string, string>,
  relatedRequestId?: string
): Promise<void> {
  await Promise.allSettled(
    userIds.map((userId) => notify({ userId, eventType, variables, relatedRequestId }))
  );
}