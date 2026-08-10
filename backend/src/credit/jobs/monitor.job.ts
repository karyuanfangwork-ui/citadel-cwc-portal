import { Queue, Worker } from 'bullmq';
import prisma from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { JobConfig } from '../../jobs/sla-checker';
import { getRedisConnectionConfig } from '../../utils/redis';
import { notifyMultiple } from '../../services/notification.service';
// @ts-ignore - Prisma client models may not be reflected until regenerated

const REDIS_CONFIG = getRedisConnectionConfig();

const QUEUE_NAME = 'credit.monitor.daily';

// Queue instance (for adding jobs)
let monitorQueue: Queue | null = null;
let monitorWorker: Worker | null = null;

/**
 * Resolve CREDIT_MANAGER role holders for notifications.
 */
async function getCreditManagerUserIds(): Promise<string[]> {
  const managers = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: {
        some: {
          role: {
            name: 'CREDIT_MANAGER',
          },
        },
      },
    },
    select: { id: true },
  });
  return managers.map((u) => u.id);
}

/**
 * Daily monitoring job processor:
 * 1. Check overdue covenant tests → create EWS signals + notify
 * 2. Check LATE_90+ payments → create EWS signals + notify
 * 3. Check facility reviews due → create EWS signals + notify
 * 4. Check overdue conditions → create EWS signals + notify
 */
async function processDailyCheck() {
  logger.info('[MonitorJob] Starting daily monitoring check...');

  let covenantsChecked = 0;
  let paymentsChecked = 0;
  let reviewsChecked = 0;
  let conditionsChecked = 0;

  try {
    // Pre-resolve CREDIT_MANAGER role holders once for this run
    const creditManagerIds = await getCreditManagerUserIds();

    // 1. Check covenants with no recent test or latest non-compliant
    const activeCovenants = await prisma.covenantDefinition.findMany({
      where: { isActive: true },
    });

    for (const covenant of activeCovenants) {
      const latestTest = await prisma.covenantTest.findFirst({
        where: { covenantId: covenant.id },
        orderBy: { testDate: 'desc' },
      });

      // No test in 60 days → flag
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      if (!latestTest || latestTest.testDate < sixtyDaysAgo) {
        // Check for existing signal via FK-based deduplication
        const existing = await prisma.earlyWarningSignal.findFirst({
          where: {
            applicationId: covenant.applicationId,
            signalType: 'COVENANT_BREACH',
            closedAt: null,
            covenantId: covenant.id,
          },
        });

        if (!existing) {
          await prisma.earlyWarningSignal.create({
            data: {
              applicationId: covenant.applicationId,
              signalType: 'COVENANT_BREACH',
              severity: 'LOW',
              description: `Covenant overdue for testing: ${covenant.description} (ID: ${covenant.id}). No test recorded in 60+ days.`,
              covenantId: covenant.id,
            },
          });

          // Notify RM + CREDIT_MANAGER via full pipeline (DB+SSE+email)
          try {
            const app = await prisma.creditApplication.findUnique({
              where: { id: covenant.applicationId },
              select: { assignedRmId: true, applicationNo: true },
            });
            if (app?.assignedRmId) {
              await notifyMultiple(
                [app.assignedRmId, ...creditManagerIds],
                'credit_covenant_breach',
                {
                  applicationId: covenant.applicationId,
                  applicationNo: app.applicationNo || covenant.applicationId,
                  borrowerName: `Covenant breach: ${covenant.description}`,
                },
              );
            }
          } catch (notifyErr) {
            logger.error(`[MonitorJob] Failed to notify for covenant breach ${covenant.id}:`, notifyErr);
          }
        }
      } else if (!latestTest.isCompliant) {
        // Non-compliant test → check if signal exists via FK deduplication
        const existing = await prisma.earlyWarningSignal.findFirst({
          where: {
            applicationId: covenant.applicationId,
            signalType: 'COVENANT_BREACH',
            closedAt: null,
            covenantId: covenant.id,
          },
        });

        if (!existing) {
          let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';
          if (['DEBT_SERVICE_COVERAGE', 'LOAN_TO_VALUE'].includes(covenant.covenantType)) severity = 'HIGH';
          else if (covenant.covenantType === 'FINANCIAL_RATIO') severity = 'CRITICAL';

          await prisma.earlyWarningSignal.create({
            data: {
              applicationId: covenant.applicationId,
              signalType: 'COVENANT_BREACH',
              severity,
              description: `Covenant breach detected: ${covenant.description} (ID: ${covenant.id}). Latest test was non-compliant.`,
              covenantId: covenant.id,
            },
          });

          // Notify RM + CREDIT_MANAGER via full pipeline (DB+SSE+email)
          try {
            const app = await prisma.creditApplication.findUnique({
              where: { id: covenant.applicationId },
              select: { assignedRmId: true, applicationNo: true },
            });
            if (app?.assignedRmId) {
              await notifyMultiple(
                [app.assignedRmId, ...creditManagerIds],
                'credit_covenant_breach',
                {
                  applicationId: covenant.applicationId,
                  applicationNo: app.applicationNo || covenant.applicationId,
                  borrowerName: `Covenant breach: ${covenant.description}`,
                },
              );
            }
          } catch (notifyErr) {
            logger.error(`[MonitorJob] Failed to notify for covenant breach ${covenant.id}:`, notifyErr);
          }
        }
      }
      covenantsChecked++;
    }

    // 2. Check overdue payments (LATE_90+)
    const overduePayments = await prisma.paymentEvent.findMany({
      where: { status: { in: ['LATE_90', 'MISSED'] } },
    });

    for (const payment of overduePayments) {
      const existing = await prisma.earlyWarningSignal.findFirst({
        where: {
          applicationId: payment.applicationId,
          signalType: 'PAYMENT_OVERDUE',
          closedAt: null,
        },
      });

      if (!existing) {
        await prisma.earlyWarningSignal.create({
          data: {
            applicationId: payment.applicationId,
            signalType: 'PAYMENT_OVERDUE',
            severity: 'HIGH',
            description: `Payment ${payment.id} is ${payment.status}. Amount: ${payment.amount}`,
          },
        });

        // Notify RM via full pipeline
        try {
          const app = await prisma.creditApplication.findUnique({
            where: { id: payment.applicationId },
            select: { assignedRmId: true, applicationNo: true },
          });
          if (app?.assignedRmId) {
            await notifyMultiple([app.assignedRmId], 'credit_payment_overdue', {
              applicationId: payment.applicationId,
              applicationNo: app.applicationNo || payment.applicationId,
              borrowerName: `Payment overdue: ${payment.status}`,
            });
          }
        } catch (notifyErr) {
          logger.error(`[MonitorJob] Failed to notify for overdue payment ${payment.id}:`, notifyErr);
        }
      }
      paymentsChecked++;
    }

    // 3. Check reviews due (nextReviewDate within 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const reviewsDue = await prisma.facilityHealth.findMany({
      where: {
        nextReviewDate: { lte: sevenDaysFromNow },
        healthStatus: { not: 'DEFAULT' },
      },
    });

    for (const fh of reviewsDue) {
      const existing = await prisma.earlyWarningSignal.findFirst({
        where: {
          applicationId: fh.applicationId,
          signalType: 'REVIEW_OVERDUE',
          closedAt: null,
        },
      });

      if (!existing) {
        await prisma.earlyWarningSignal.create({
          data: {
            applicationId: fh.applicationId,
            signalType: 'REVIEW_OVERDUE',
            severity: 'LOW',
            description: `Periodic review due for application ${fh.applicationId}. Next review date: ${fh.nextReviewDate?.toISOString().slice(0, 10)}`,
          },
        });

        // Notify RM via full pipeline
        try {
          const app = await prisma.creditApplication.findUnique({
            where: { id: fh.applicationId },
            select: { assignedRmId: true, applicationNo: true },
          });
          if (app?.assignedRmId) {
            await notifyMultiple([app.assignedRmId], 'credit_review_overdue', {
              applicationId: fh.applicationId,
              applicationNo: app.applicationNo || fh.applicationId,
              borrowerName: 'Review overdue',
            });
          }
        } catch (notifyErr) {
          logger.error(`[MonitorJob] Failed to notify for review overdue on ${fh.applicationId}:`, notifyErr);
        }
      }
      reviewsChecked++;
    }

    // 4. Check overdue conditions (unfulfilled/unwaived with dueDate < now)
    const now = new Date();
    const overdueConditions = await prisma.condition.findMany({
      where: {
        isFulfilled: false,
        waivedAt: null,
        status: { in: ['PENDING'] },
        dueDate: { lt: now, not: null },
      },
    });

    for (const condition of overdueConditions) {
      // FK-based deduplication
      const existing = await prisma.earlyWarningSignal.findFirst({
        where: {
          applicationId: condition.applicationId,
          signalType: 'CONDITION_OVERDUE' as any,
          closedAt: null,
          conditionId: condition.id,
        },
      });

      if (!existing) {
        let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';
        // Pre-disbursement conditions that are overdue are higher severity
        if (condition.category === 'PRE_DISBURSEMENT') severity = 'HIGH';

        await prisma.earlyWarningSignal.create({
          data: {
            applicationId: condition.applicationId,
            signalType: 'CONDITION_OVERDUE' as any,
            severity,
            description: `Overdue condition: "${condition.title}" (ID: ${condition.id}). Due: ${condition.dueDate?.toISOString().slice(0, 10)}`,
            conditionId: condition.id,
          },
        });

        // Notify RM + CREDIT_MANAGER via full pipeline (DB+SSE+email)
        try {
          const app = await prisma.creditApplication.findUnique({
            where: { id: condition.applicationId },
            select: { assignedRmId: true, applicationNo: true },
          });
          if (app?.assignedRmId) {
            await notifyMultiple(
              [app.assignedRmId, ...creditManagerIds],
              'credit_condition_overdue',
              {
                applicationId: condition.applicationId,
                applicationNo: app.applicationNo || condition.applicationId,
                borrowerName: `Overdue condition: ${condition.title}`,
              },
            );
          }
        } catch (notifyErr) {
          logger.error(`[MonitorJob] Failed to notify for overdue condition ${condition.id}:`, notifyErr);
        }
      }
      conditionsChecked++;
    }

    logger.info(`[MonitorJob] Daily check complete: ${covenantsChecked} covenants, ${paymentsChecked} overdue payments, ${reviewsChecked} reviews due, ${conditionsChecked} overdue conditions`);
  } catch (error) {
    logger.error('[MonitorJob] Error in daily check:', error);
  }
}

/**
 * Start the BullMQ monitoring job.
 * Gracefully handles Redis unavailability — logs warning and skips.
 */
export function startMonitorJob(cfg: JobConfig = { enabled: true, mode: 'interval', intervalMs: 86400000 }) {
  if (!cfg.enabled) {
    logger.info('[MonitorJob] Credit monitor disabled — skipping');
    return;
  }
  try {
    monitorQueue = new Queue(QUEUE_NAME, { connection: REDIS_CONFIG });

    monitorWorker = new Worker(QUEUE_NAME, async () => {
      await processDailyCheck();
    }, { connection: REDIS_CONFIG });

    const repeatMs = cfg.intervalMs || 86400000;
    monitorQueue.add('daily-check', {}, {
      repeat: { every: repeatMs },
    });

    logger.info(`[MonitorJob] Started monitoring queue: ${QUEUE_NAME} (interval: ${repeatMs / 1000}s)`);
  } catch (error) {
    logger.warn(`[MonitorJob] Could not start monitoring job (Redis may not be available): ${error}`);
  }
}

/**
 * Stop the BullMQ monitoring job.
 */
export async function stopMonitorJob() {
  try {
    if (monitorWorker) await monitorWorker.close(true);
    if (monitorQueue) await monitorQueue.close();
    logger.info('[MonitorJob] Stopped monitoring queue');
  } catch (error) {
    logger.warn(`[MonitorJob] Error stopping monitoring job: ${error}`);
  }
}

/**
 * Run the daily check manually (for testing).
 */
export { processDailyCheck };