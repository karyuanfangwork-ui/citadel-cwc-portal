import cron, { ScheduledTask } from 'node-cron';
import { creditSlaService } from '../services/creditSla.service';
import { logger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// §2.2 — Credit SLA Checker Cron Job
// ---------------------------------------------------------------------------
// Runs every 15 minutes to:
//   1. Check for new SLA breaches
//   2. Process escalations for existing breaches
// ---------------------------------------------------------------------------

let cronTask: ScheduledTask | null = null;

/**
 * Run a single SLA check cycle — called by the cron and manually.
 */
export async function runCreditSlaChecks(): Promise<{ breachesDetected: number; escalationsProcessed: number }> {
  const breachCount = await creditSlaService.checkAndRecordBreaches();
  const escalationCount = await creditSlaService.processEscalations();

  if (breachCount > 0 || escalationCount > 0) {
    logger.info(`[§2.2] Credit SLA check: ${breachCount} new breaches, ${escalationCount} escalations`);
  }

  return { breachesDetected: breachCount, escalationsProcessed: escalationCount };
}

/**
 * Start the 15-minute credit SLA cron job.
 */
export function startCreditSlaChecker(): void {
  stopCreditSlaChecker();

  // Every 15 minutes: */15 * * * *
  // For testing: every minute: * * * * *
  const expression = process.env.CREDIT_SLA_CRON ?? '*/15 * * * *';

  if (!cron.validate(expression)) {
    logger.error(`[§2.2] Invalid credit SLA cron expression: "${expression}". Falling back to 15-minute interval.`);
    cronTask = cron.schedule('*/15 * * * *', () => runCreditSlaChecks());
  } else {
    cronTask = cron.schedule(expression, () => {
      logger.info(`[§2.2] Credit SLA checker running (cron: ${expression})`);
      runCreditSlaChecks();
    });
  }

  logger.info(`[§2.2] Credit SLA checker started (cron: ${expression})`);

  // Run immediately on start
  runCreditSlaChecks();
}

/**
 * Stop the credit SLA cron job.
 */
export function stopCreditSlaChecker(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    logger.info('[§2.2] Credit SLA checker stopped');
  }
}