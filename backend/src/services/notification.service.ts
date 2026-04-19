import prisma from '../utils/prisma';
import { sendEmail, renderTemplate } from './email.service';
import { logger } from '../utils/logger';

interface NotifyOptions {
  userId: string;
  eventType: string;
  variables: Record<string, string>;
  relatedRequestId?: string;
}

export async function notify(options: NotifyOptions): Promise<void> {
  const { userId, eventType, variables, relatedRequestId } = options;

  try {
    // Find template
    const template = await prisma.notificationTemplate.findFirst({
      where: { eventType, isActive: true },
    });

    const subject = template
      ? renderTemplate(template.emailSubject ?? '', variables)
      : `Notification: ${eventType}`;
    const body = template
      ? renderTemplate(template.emailBody ?? '', variables)
      : `Event: ${eventType}`;

    // Create in-app notification
    await prisma.notification.create({
      data: {
        userId,
        channel: 'IN_APP',
        subject,
        body,
        relatedRequestId,
        status: 'SENT',
      },
    });

    // Send email notification
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email) {
      const emailSent = await sendEmail(user.email, subject, body);

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
