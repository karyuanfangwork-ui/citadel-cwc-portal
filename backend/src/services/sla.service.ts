import prisma from '../utils/prisma';
import { notify } from './notification.service';
import { logger } from '../utils/logger';

const db = prisma as any;

export async function checkSlaBreaches(): Promise<number> {
  const now = new Date();

  try {
    const breachedRequests = await prisma.request.findMany({
      where: {
        slaDueAt: { lte: now },
        slaPausedAt: null, // Skip paused requests — SLA clock is stopped
        status: { notIn: ['RESOLVED', 'REIMBURSEMENT_CLOSED', 'REJECTED', 'COMPLETED', 'PAYMENT_COMPLETED', 'CANCELLED'] },
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

      // Single-recipient: notify assigned agent only.
      // If no agent is assigned, fall back to a single admin.
      if (req.assignedToId) {
        await notify({
          userId: req.assignedToId,
          eventType: 'SLA_BREACHED',
          variables: {
            referenceNumber: req.referenceNumber,
            slaDeadline: req.slaDueAt?.toISOString() ?? '',
          },
          relatedRequestId: req.id,
        });
      } else if (adminIds.length > 0) {
        // No agent assigned — notify the single most senior admin
        await notify({
          userId: adminIds[0],
          eventType: 'SLA_BREACHED',
          variables: {
            referenceNumber: req.referenceNumber,
            slaDeadline: req.slaDueAt?.toISOString() ?? '',
          },
          relatedRequestId: req.id,
        });
      }
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
        status: { notIn: ['RESOLVED', 'REIMBURSEMENT_CLOSED', 'REJECTED', 'COMPLETED', 'PAYMENT_COMPLETED', 'CANCELLED'] },
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

        const tenantId = req.tenantId;
        if (!tenantId) continue;
        const escalationLevel = rule.triggerHoursAfterBreach;
        const idempotencyKey = `${req.id}:rule:${rule.id}:level:${escalationLevel}`;
        await db.slaEscalationEvent.upsert({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
          update: {},
          create: {
            tenantId,
            departmentId: req.departmentId ?? null,
            requestId: req.id,
            escalationLevel,
            ruleId: rule.id,
            idempotencyKey,
            notifyRoles: rule.notifyRoles,
            notificationIntent: {
              eventType: 'SLA_ESCALATED',
              referenceNumber: req.referenceNumber,
              escalationHours: rule.triggerHoursAfterBreach,
              escalationLabel: rule.label || '',
              notifyRoles: rule.notifyRoles,
            },
          },
        });

        await db.outboxEvent.create({
          data: {
            tenantId,
            departmentId: req.departmentId ?? null,
            eventType: 'SLA_ESCALATION_INTENT_CREATED',
            aggregateId: req.id,
            aggregateVersion: rule.triggerHoursAfterBreach,
            payload: { requestId: req.id, ruleId: rule.id, idempotencyKey, notifyRoles: rule.notifyRoles },
          },
        }).catch(() => undefined);

        // Notify matching escalation handlers and grant explicit request access as
        // escalation recipients. This is intentionally separate from manual participants.
        const escalationHandlers = await prisma.user.findMany({
          where: {
            isActive: true,
            roles: { some: { role: { name: { in: rule.notifyRoles } } } },
          },
          select: { id: true },
        });

        for (const handler of escalationHandlers) {
          await notify({
            userId: handler.id,
            eventType: 'SLA_ESCALATED',
            variables: {
              referenceNumber: req.referenceNumber,
              escalationHours: String(rule.triggerHoursAfterBreach),
              escalationLabel: rule.label || '',
              notifyRoles: rule.notifyRoles.join(', '),
            },
            relatedRequestId: req.id,
          });
          await prisma.requestParticipant.upsert({
            where: {
              requestId_userId_participantRole: {
                requestId: req.id,
                userId: handler.id,
                participantRole: 'ESCALATION_RECIPIENT',
              },
            },
            update: {},
            create: {
              requestId: req.id,
              userId: handler.id,
              participantRole: 'ESCALATION_RECIPIENT',
            },
          }).catch(() => undefined);
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
