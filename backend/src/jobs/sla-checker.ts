import cron, { ScheduledTask } from 'node-cron';
import { config } from '../config';
import { checkSlaBreaches, checkEscalations } from '../services/sla.service';
import { checkStalePauses } from '../services/sla-pause.service';
import { logger } from '../utils/logger';

let intervalId: ReturnType<typeof setInterval> | null = null;
let cronTask: ScheduledTask | null = null;

async function runChecks(): Promise<void> {
    await checkStalePauses().catch((err) => logger.error('Stale SLA pause check failed', { error: err }));
    await checkSlaBreaches().catch((err) => logger.error('SLA breach check failed', { error: err }));
    await checkEscalations().catch((err) => logger.error('SLA escalation check failed', { error: err }));
}

export function startSlaChecker(): void {
    const { mode, intervalMs, cronExpression } = config.slaSchedule;

    if (mode === 'cron') {
        // Validate the cron expression
        if (!cron.validate(cronExpression)) {
            logger.error(`Invalid SLA cron expression: "${cronExpression}". Falling back to interval mode (60s).`);
            startIntervalMode(60000);
            return;
        }
        // Run once on startup, then schedule via cron
        runChecks();
        cronTask = cron.schedule(cronExpression, () => {
            logger.info(`SLA checker running (cron: ${cronExpression})`);
            runChecks();
        });
        logger.info(`SLA checker started (cron: ${cronExpression})`);
    } else {
        // Legacy interval mode
        startIntervalMode(intervalMs);
    }
}

function startIntervalMode(ms: number): void {
    logger.info(`SLA checker started (interval: ${ms / 1000}s)`);
    runChecks();
    intervalId = setInterval(() => {
        runChecks();
    }, ms);
}

export function stopSlaChecker(): void {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    if (cronTask) {
        cronTask.stop();
        cronTask = null;
    }
    logger.info('SLA checker stopped');
}