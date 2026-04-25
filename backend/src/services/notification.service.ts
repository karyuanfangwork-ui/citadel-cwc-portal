import prisma from '../utils/prisma';
import { sendEmail, renderTemplate } from './email.service';
import { logger } from '../utils/logger';
import { pushToUser } from '../utils/sseClients';
import { config } from '../config';

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

    // Auto-inject appUrl into variables so templates can use {{appUrl}}
    const enrichedVars = { ...variables, appUrl: variables.appUrl || config.app.url };

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
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email) {
      const emailSent = await sendEmail(user.email, subject, body, { wrapInLayout });

      // Also create an EMAIL notification record for tracking
      await prisma.notification.create({
        data: {
          userId,
          channel: 'EMAIL',
          subject,
          body,
          relatedRequestId,
          status: emailSent ? 'SENT' : 'FAILED',
          sentAt: emailSent ? new Date() : undefined,
          errorMessage: emailSent ? undefined : 'SMTP delivery failed',
        },
      });
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