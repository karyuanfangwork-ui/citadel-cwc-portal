/**
 * §6.3 — LOO Expiry Scheduler
 *
 * Runs daily at 8:00 AM to check LOO expiry and send notifications.
 * Triggered via node-cron pattern.
 */

import { looService } from '../services/loo.service';

let intervalHandle: ReturnType<typeof setInterval> | null = null;

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Start the LOO expiry scheduler.
 * Runs the check immediately, then every 24 hours.
 */
export function startLooExpiryScheduler(): void {
  if (intervalHandle) {
    console.log('[LOO Scheduler] Already running');
    return;
  }

  // Run immediately on start
  runCheck();

  // Then every 24 hours
  intervalHandle = setInterval(runCheck, CHECK_INTERVAL_MS);
  console.log('[LOO Scheduler] Started — checking every 24 hours');
}

/**
 * Stop the LOO expiry scheduler.
 */
export function stopLooExpiryScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[LOO Scheduler] Stopped');
  }
}

async function runCheck(): Promise<void> {
  try {
    const result = await looService.checkAndNotifyExpiring();
    if (result.notified > 0 || result.expired > 0) {
      console.log(`[LOO Scheduler] Notified: ${result.notified}, Expired: ${result.expired}`);
    }
  } catch (err) {
    console.error('[LOO Scheduler] Error during check:', err);
  }
}