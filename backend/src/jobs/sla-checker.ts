import cron, { ScheduledTask } from 'node-cron';
import { checkSlaBreaches, checkEscalations } from '../services/sla.service';
import { checkStalePauses } from '../services/sla-pause.service';
import { logger } from '../utils/logger';

export interface JobConfig {
  enabled: boolean;
  mode: 'cron' | 'interval';
  cronExpr?: string;
  intervalMs?: number;
}

let intervalId: ReturnType<typeof setInterval> | null = null;
let cronTask: ScheduledTask | null = null;

export async function runSlaChecks(): Promise<void> {
  await checkStalePauses().catch((err) => logger.error('Stale SLA pause check failed', { error: err }));
  await checkSlaBreaches().catch((err) => logger.error('SLA breach check failed', { error: err }));
  await checkEscalations().catch((err) => logger.error('SLA escalation check failed', { error: err }));
}

export function startSlaChecker(cfg: JobConfig): void {
  stopSlaChecker();
  if (!cfg.enabled) {
    logger.info('SLA checker disabled — skipping');
    return;
  }
  if (cfg.mode === 'cron') {
    const expr = cfg.cronExpr || '0 9 * * 1-5';
    if (!cron.validate(expr)) {
      logger.error(`Invalid SLA cron expression: "${expr}". Falling back to interval (60s).`);
      startSlaIntervalMode(60000);
      return;
    }
    runSlaChecks();
    cronTask = cron.schedule(expr, () => {
      logger.info(`SLA checker running (cron: ${expr})`);
      runSlaChecks();
    });
    logger.info(`SLA checker started (cron: ${expr})`);
  } else {
    startSlaIntervalMode(cfg.intervalMs || 60000);
  }
}

function startSlaIntervalMode(ms: number): void {
  logger.info(`SLA checker started (interval: ${ms / 1000}s)`);
  runSlaChecks();
  intervalId = setInterval(() => { runSlaChecks(); }, ms);
}

export function stopSlaChecker(): void {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
  if (cronTask) { cronTask.stop(); cronTask = null; }
}