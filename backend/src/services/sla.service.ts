import prisma from '../utils/prisma';
import { notifyMultiple } from './notification.service';
import { logger } from '../utils/logger';

export async function checkSlaBreaches(): Promise<number> {
  const now = new Date();

  try {
    const breachedRequests = await prisma.request.findMany({
      where: {
        slaDueAt: { lte: now },
        slaPausedAt: null, // Skip paused requests — SLA clock is stopped
        status: { notIn: ['RESOLVED', 'REIMBURSEMENT_CLOSED', 'REJECTED', 'COMPLETED', 'PAYMENT_COMPLETED'] },
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

    if (unnotified.length === 0) return 0;

    // Load admins once for the whole batch — avoids N×DB queries
    const admins = await prisma.user.findMany({
      where: { roles: { some: { role: { name: 'ADMIN' } } } },
      select: { id: true },
    });
    const adminIds = admins.map((a) => a.id);

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
      adminIds.forEach((id) => {
        if (!notifyIds.includes(id)) notifyIds.push(id);
      });

      await notifyMultiple(notifyIds, 'SLA_BREACHED', {
        referenceNumber: req.referenceNumber,
        slaDeadline: req.slaDueAt?.toISOString() ?? '',
      }, req.id);
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

export async function checkEscalations(): Promise<number> {
  const now = new Date();
  let escalationsFired = 0;

  try {
    const breachedRequests = await prisma.request.findMany({
      where: {
        slaDueAt: { lte: now },
        slaPausedAt: null, // Skip paused requests — SLA clock is stopped
        requestTypeId: { not: null },
        status: { notIn: ['RESOLVED', 'REIMBURSEMENT_CLOSED', 'REJECTED', 'COMPLETED', 'PAYMENT_COMPLETED'] },
      },
      include: {
        activities: {
          where: { activityType: 'SYSTEM', message: { startsWith: 'SLA BREACH' } },
          take: 1,
        },
      },
    });

    for (const req of breachedRequests) {
      const breachActivity = req.activities[0];
      if (!breachActivity?.metadata) continue;

      const meta = breachActivity.metadata as { breachedAt?: string };
      if (!meta.breachedAt) continue;
      const breachedAt = new Date(meta.breachedAt);

      const rules = await prisma.escalationRule.findMany({
        where: { requestTypeId: req.requestTypeId!, isActive: true },
        orderBy: { triggerHoursAfterBreach: 'asc' },
      });

      for (const rule of rules) {
        const triggerAt = new Date(breachedAt.getTime() + rule.triggerHoursAfterBreach * 60 * 60 * 1000);
        if (triggerAt > now) continue;

        const alreadyFired = await prisma.requestActivity.findFirst({
          where: {
            requestId: req.id,
            activityType: 'SYSTEM',
            message: { startsWith: `SLA ESCALATION:${rule.id}` },
          },
        });
        if (alreadyFired) continue;

        await prisma.requestActivity.create({
          data: {
            requestId: req.id,
            authorId: req.requesterId,
            authorName: 'System',
            activityType: 'SYSTEM',
            message: `SLA ESCALATION:${rule.id} — Escalated ${rule.triggerHoursAfterBreach}h after breach${rule.label ? ` (${rule.label})` : ''}.`,
            isSystemGenerated: true,
            metadata: { ruleId: rule.id, triggeredAt: now.toISOString(), notifyRoles: rule.notifyRoles },
          },
        });

        const usersToNotify = await prisma.user.findMany({
          where: { roles: { some: { role: { name: { in: rule.notifyRoles } } } } },
          select: { id: true },
        });
        const notifyIds = usersToNotify.map((u) => u.id);

        if (notifyIds.length > 0) {
          await notifyMultiple(notifyIds, 'SLA_ESCALATED', {
            referenceNumber: req.referenceNumber,
            escalationHours: String(rule.triggerHoursAfterBreach),
            escalationLabel: rule.label || '',
            notifyRoles: rule.notifyRoles.join(', '),
          }, req.id);
        }

        logger.warn(`SLA escalation fired for request ${req.referenceNumber} (rule: ${rule.id}, +${rule.triggerHoursAfterBreach}h)`);
        escalationsFired++;
      }
    }

    if (escalationsFired > 0) {
      logger.info(`Escalation check complete: ${escalationsFired} escalation(s) fired`);
    }
  } catch (error) {
    logger.error('SLA escalation check failed', { error });
  }

  return escalationsFired;
}
