/**
 * Removes refresh-token sessions that have expired without an explicit logout.
 */
import cron, { ScheduledTask } from 'node-cron';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import { JobConfig } from './sla-checker';

const DEFAULT_CRON = '0 4 * * *';
let cronTask: ScheduledTask | null = null;

export async function pruneExpiredSessions(): Promise<number> {
    const result = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    logger.info(`[SessionPruner] Deleted ${result.count} expired session(s)`);
    return result.count;
}

export function startSessionPrunerJob(cfg?: JobConfig): void {
    stopSessionPrunerJob();
    const effectiveCfg = cfg ?? { enabled: true, mode: 'cron' as const, cronExpr: DEFAULT_CRON };
    if (!effectiveCfg.enabled) {
        logger.info('[SessionPruner] Job disabled — skipping');
        return;
    }

    const expression = process.env.SESSION_PRUNE_CRON ?? effectiveCfg.cronExpr ?? DEFAULT_CRON;
    const scheduleExpression = cron.validate(expression) ? expression : DEFAULT_CRON;
    if (scheduleExpression !== expression) {
        logger.error(`[SessionPruner] Invalid cron expression: "${expression}". Falling back to daily 04:00.`);
    }
    cronTask = cron.schedule(scheduleExpression, () => {
        pruneExpiredSessions().catch((error) => logger.error('[SessionPruner] Run failed', { error }));
    });
    logger.info(`[SessionPruner] Job started (cron: ${scheduleExpression})`);
}

export function stopSessionPrunerJob(): void {
    if (cronTask) {
        cronTask.stop();
        cronTask = null;
        logger.info('[SessionPruner] Job stopped');
    }
}
