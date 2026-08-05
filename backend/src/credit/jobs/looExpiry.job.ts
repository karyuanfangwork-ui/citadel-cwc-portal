/**
 * §6.3 — LOO Expiry Check Job
 *
 * Runs daily to check LOO expiry and send notifications.
 * Wired into scheduler.service.ts as 'credit.loo_expiry'.
 */

import { logger } from '../../utils/logger';
import { looService } from '../services/loo.service';

let looExpiryInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Run the LOO expiry check once.
 */
export async function runLooExpiryCheck(): Promise<void> {
  logger.info('[LooExpiryJob] Starting LOO expiry check...');
  const result = await looService.checkAndNotifyExpiring();
  logger.info(`[LooExpiryJob] Complete — notified: ${result.notified}, expired: ${result.expired}`);
}

/**
 * Start the LOO expiry job based on config.
 */
export function startLooExpiryJob(cfg: { enabled: boolean; mode: string; cronExpr?: string; intervalMs?: number }): void {
  if (!cfg.enabled) return;
  stopLooExpiryJob();

  if (cfg.mode === 'interval' && cfg.intervalMs) {
    runLooExpiryCheck().catch(err => logger.error('[LooExpiryJob] Initial run failed:', err));
    looExpiryInterval = setInterval(() => {
      runLooExpiryCheck().catch(err => logger.error('[LooExpiryJob] Interval run failed:', err));
    }, cfg.intervalMs);
    logger.info(`[LooExpiryJob] Started — interval: ${cfg.intervalMs}ms`);
  } else {
    // Default: run once daily via scheduler trigger
    runLooExpiryCheck().catch(err => logger.error('[LooExpiryJob] Default run failed:', err));
    looExpiryInterval = setInterval(() => {
      runLooExpiryCheck().catch(err => logger.error('[LooExpiryJob] Daily run failed:', err));
    }, 24 * 60 * 60 * 1000);
    logger.info('[LooExpiryJob] Started — daily interval (default)');
  }
}

/**
 * Stop the LOO expiry job.
 */
export function stopLooExpiryJob(): void {
  if (looExpiryInterval) {
    clearInterval(looExpiryInterval);
    looExpiryInterval = null;
    logger.info('[LooExpiryJob] Stopped');
  }
}