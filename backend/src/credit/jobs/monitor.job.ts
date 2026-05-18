import { Queue, Worker } from 'bullmq';
import prisma from '../../utils/prisma';
import { logger } from '../../utils/logger';
// @ts-ignore - Prisma client models may not be reflected until regenerated

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

const QUEUE_NAME = 'credit.monitor.daily';

// Queue instance (for adding jobs)
let monitorQueue: Queue | null = null;
let monitorWorker: Worker | null = null;

/**
 * Daily monitoring job processor:
 * 1. Check overdue covenant tests → create EWS signals
 * 2. Check LATE_90+ payments → create EWS signals
 * 3. Check facility reviews due → create EWS signals
 */
async function processDailyCheck() {
  logger.info('[MonitorJob] Starting daily monitoring check...');

  let covenantsChecked = 0;
  let paymentsChecked = 0;
  let reviewsChecked = 0;

  try {
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
        // Check for existing signal
        const existing = await prisma.earlyWarningSignal.findFirst({
          where: {
            applicationId: covenant.applicationId,
            signalType: 'COVENANT_BREACH',
            closedAt: null,
            description: { contains: covenant.id },
          },
        });

        if (!existing) {
          await prisma.earlyWarningSignal.create({
            data: {
              applicationId: covenant.applicationId,
              signalType: 'COVENANT_BREACH',
              severity: 'LOW',
              description: `Covenant overdue for testing: ${covenant.description} (ID: ${covenant.id}). No test recorded in 60+ days.`,
            },
          });
        }
      } else if (!latestTest.isCompliant) {
        // Non-compliant test → check if signal exists
        const existing = await prisma.earlyWarningSignal.findFirst({
          where: {
            applicationId: covenant.applicationId,
            signalType: 'COVENANT_BREACH',
            closedAt: null,
            description: { contains: covenant.id },
          },
        });

        if (!existing) {
          let severity = 'MEDIUM';
          if (['DEBT_SERVICE_COVERAGE', 'LOAN_TO_VALUE'].includes(covenant.covenantType)) severity = 'HIGH';
          else if (covenant.covenantType === 'FINANCIAL_RATIO') severity = 'CRITICAL';

          await prisma.earlyWarningSignal.create({
            data: {
              applicationId: covenant.applicationId,
              signalType: 'COVENANT_BREACH',
              severity: severity as any,
              description: `Covenant breach detected: ${covenant.description} (ID: ${covenant.id}). Latest test was non-compliant.`,
            },
          });
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
      }
      reviewsChecked++;
    }

    logger.info(`[MonitorJob] Daily check complete: ${covenantsChecked} covenants, ${paymentsChecked} overdue payments, ${reviewsChecked} reviews due`);
  } catch (error) {
    logger.error('[MonitorJob] Error in daily check:', error);
  }
}

/**
 * Start the BullMQ monitoring job.
 * Gracefully handles Redis unavailability — logs warning and skips.
 */
export function startMonitorJob() {
  try {
    monitorQueue = new Queue(QUEUE_NAME, { connection: REDIS_CONFIG });

    monitorWorker = new Worker(QUEUE_NAME, async () => {
      await processDailyCheck();
    }, { connection: REDIS_CONFIG });

    // Add repeatable job — runs every 24 hours
    monitorQueue.add('daily-check', {}, {
      repeat: { every: 86400000 }, // 24h in ms
    });

    logger.info(`[MonitorJob] Started monitoring queue: ${QUEUE_NAME}`);
  } catch (error) {
    logger.warn(`[MonitorJob] Could not start monitoring job (Redis may not be available): ${error}`);
  }
}

/**
 * Stop the BullMQ monitoring job.
 */
export async function stopMonitorJob() {
  try {
    if (monitorWorker) await monitorWorker.close();
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