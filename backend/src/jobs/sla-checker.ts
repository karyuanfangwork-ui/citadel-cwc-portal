import { checkSlaBreaches } from '../services/sla.service';
import { logger } from '../utils/logger';

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startSlaChecker(): void {
  logger.info(`SLA checker started (interval: ${CHECK_INTERVAL_MS / 60000} minutes)`);
  checkSlaBreaches().catch(() => {});
  intervalId = setInterval(() => {
    checkSlaBreaches().catch(() => {});
  }, CHECK_INTERVAL_MS);
}

export function stopSlaChecker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('SLA checker stopped');
  }
}
