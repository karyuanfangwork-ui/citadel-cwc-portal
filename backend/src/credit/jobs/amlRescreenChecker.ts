import cron, { ScheduledTask } from 'node-cron';
import { amlRescreenService } from '../services/amlRescreen.service';
import { logger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// §2.7 — AML Quarterly Re-Screening Cron Job
// ---------------------------------------------------------------------------
// Runs quarterly (or on configurable schedule) to:
//   1. Find active applications where the borrower hasn't been PEP/sanctions
//      screened in the last 90 days
//   2. Create AML_RESCREEN bureau check records (placeholder — Wave 4.5 will
//      implement the actual PEP/sanctions adapter)
// ---------------------------------------------------------------------------

let cronTask: ScheduledTask | null = null;

/**
 * Run a single AML re-screen check cycle.
 */
export async function runAmlRescreen(): Promise<number> {
  const queued = await amlRescreenService.queueQuarterlyRescreen();
  if (queued > 0) {
    logger.info(`[§2.7] AML re-screen: ${queued} applications queued for re-screening`);
  }
  return queued;
}

/**
 * Start the AML re-screening cron job.
 * Default schedule: 1st of every quarter at 2:00 AM (0 2 1 1,4,7,10 *)
 * Configurable via AML_RESCREEN_CRON env var.
 */
export function startAmlRescreenChecker(): void {
  stopAmlRescreenChecker();

  const expression = process.env.AML_RESCREEN_CRON ?? '0 2 1 1,4,7,10 *';

  if (!cron.validate(expression)) {
    logger.error(`[§2.7] Invalid AML re-screen cron expression: "${expression}". Using quarterly default.`);
    cronTask = cron.schedule('0 2 1 1,4,7,10 *', () => runAmlRescreen());
  } else {
    cronTask = cron.schedule(expression, () => {
      logger.info(`[§2.7] AML re-screen checker running (cron: ${expression})`);
      runAmlRescreen();
    });
  }

  logger.info(`[§2.7] AML re-screen checker started (cron: ${expression})`);
}

/**
 * Stop the AML re-screening cron job.
 */
export function stopAmlRescreenChecker(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    logger.info('[§2.7] AML re-screen checker stopped');
  }
}