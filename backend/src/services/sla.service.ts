import prisma from '../utils/prisma';
import { notifyMultiple } from './notification.service';
import { logger } from '../utils/logger';

export async function checkSlaBreaches(): Promise<number> {
  const now = new Date();

  try {
    const breachedRequests = await prisma.request.findMany({
      where: {
        slaDueAt: { lte: now },
        status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED', 'COMPLETED', 'PAYMENT_COMPLETED'] },
      },
      include: {
        assignedTo: { select: { id: true } },
        requester: { select: { id: true } },
        activities: {
          where: { activityType: 'SYSTEM', message: { startsWith: 'SLA BREACH' } },
          take: 1,
        },
      },
    });

    const unnotified = breachedRequests.filter((r) => r.activities.length === 0);

    for (const req of unnotified) {
      await prisma.requestActivity.create({
        data: {
          requestId: req.id,
          authorId: req.requesterId,
          authorName: 'System',
          activityType: 'SYSTEM',
          message: 'SLA BREACH: This request has exceeded its SLA deadline.',
          isSystemGenerated: true,
          metadata: { slaDueAt: req.slaDueAt?.toISOString(), breachedAt: now.toISOString() },
        },
      });

      const notifyIds: string[] = [];
      if (req.assignedToId) notifyIds.push(req.assignedToId);

      const admins = await prisma.user.findMany({
        where: { roles: { some: { role: { name: 'ADMIN' } } } },
        select: { id: true },
      });
      admins.forEach((a) => {
        if (!notifyIds.includes(a.id)) notifyIds.push(a.id);
      });

      await notifyMultiple(notifyIds, 'SLA_BREACHED', { referenceNumber: req.referenceNumber }, req.id);
      logger.warn(`SLA breach detected for request ${req.referenceNumber}`);
    }

    if (unnotified.length > 0) {
      logger.info(`SLA check complete: ${unnotified.length} new breach(es) detected`);
    }

    return unnotified.length;
  } catch (error) {
    logger.error('SLA breach check failed', { error });
    return 0;
  }
}
