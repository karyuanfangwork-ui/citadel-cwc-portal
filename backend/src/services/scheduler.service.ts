import cron from 'node-cron';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import { startSlaChecker, stopSlaChecker, runSlaChecks, JobConfig } from '../jobs/sla-checker';
import { startCrmJob, stopCrmJob, CrmJobKey, CRM_JOB_FNS } from '../jobs/crm-checker';
import { startMonitorJob, stopMonitorJob, processDailyCheck } from '../credit/jobs/monitor.job';
import { startLooExpiryJob, stopLooExpiryJob, runLooExpiryCheck } from '../credit/jobs/looExpiry.job';
import { startCreditSlaChecker, stopCreditSlaChecker, runCreditSlaChecks } from '../credit/jobs/creditSlaChecker';
import { startAmlRescreenChecker, stopAmlRescreenChecker, runAmlRescreen } from '../credit/jobs/amlRescreenChecker';
import { startAuditRetentionJob, stopAuditRetentionJob, runAuditRetentionCheck } from '../credit/jobs/auditRetention.job';
import { acquireLock, releaseLock } from './schedulerLock.service';
import { startSlaTimerWorker, stopSlaTimerWorker } from '../workers/timer.worker';
import { dispatchOutboxBatch } from './outboxDispatcher.service';

export interface SchedulerConfigRow {
  id: string;
  jobKey: string;
  label: string;
  enabled: boolean;
  mode: string;
  cronExpr: string | null;
  intervalMs: number | null;
  lastRunAt: Date | null;
  lastStatus: string | null;
  lastError: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}

const DEFAULT_CONFIGS: Omit<SchedulerConfigRow, 'id' | 'updatedAt'>[] = [
  { jobKey: 'sla',                    label: 'SLA Checker',              enabled: true, mode: 'cron', cronExpr: process.env.SLA_CRON_EXPRESSION || '0 9 * * 1-5', intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'crm.activity_reminders', label: 'CRM: Activity Reminders',  enabled: true, mode: 'cron', cronExpr: '*/15 * * * *',   intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'crm.lead_aging',         label: 'CRM: Lead Aging',          enabled: true, mode: 'cron', cronExpr: '0 8 * * 1-5',   intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'crm.overdue_followups',  label: 'CRM: Overdue Follow-Ups',  enabled: true, mode: 'cron', cronExpr: '30 8 * * 1-5',  intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'crm.stale_deals',        label: 'CRM: Stale Deals',         enabled: true, mode: 'cron', cronExpr: '0 9 * * 1-5',   intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'crm.trust_reviews',      label: 'CRM: Trust Review Dates',  enabled: true, mode: 'cron', cronExpr: '0 10 * * 1-5',  intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'crm.kyc_expiration',     label: 'CRM: KYC Expiration',      enabled: true, mode: 'cron', cronExpr: '0 6 * * 1-5',   intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'crm.rep_inactivity',     label: 'CRM: Rep Inactivity',      enabled: true, mode: 'cron', cronExpr: '0 16 * * 1-5',  intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'credit.monitor',         label: 'Credit Daily Monitor',     enabled: true, mode: 'interval', cronExpr: null, intervalMs: 86400000, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'credit.loo_expiry',      label: 'LOO Expiry Check',         enabled: true, mode: 'interval', cronExpr: null, intervalMs: 86400000, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'credit.sla_checker',     label: 'Credit SLA Breach Check',  enabled: true, mode: 'cron', cronExpr: '*/15 * * * *', intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'credit.aml_rescreen',    label: 'AML Quarterly Re-Screen',   enabled: true, mode: 'cron', cronExpr: '0 2 1 1,4,7,10 *', intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'credit.audit_retention', label: 'Audit Retention & Hash Check', enabled: true, mode: 'cron', cronExpr: '0 3 * * *', intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'workflow.outbox', label: 'Workflow Outbox Dispatcher', enabled: true, mode: 'interval', cronExpr: null, intervalMs: 30000, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
];

async function seedDefaults(): Promise<void> {
  for (const cfg of DEFAULT_CONFIGS) {
    await prisma.schedulerConfig.upsert({
      where: { jobKey: cfg.jobKey },
      update: {
        cronExpr: cfg.cronExpr,
        intervalMs: cfg.intervalMs,
      },
      create: cfg,
    });
  }
  logger.info('[Scheduler] Default configs seeded');
}

function toJobConfig(row: SchedulerConfigRow): JobConfig {
  return {
    enabled: row.enabled,
    mode: row.mode as 'cron' | 'interval',
    cronExpr: row.cronExpr ?? undefined,
    intervalMs: row.intervalMs ?? undefined,
  };
}

function startJobByKey(row: SchedulerConfigRow): void {
  const cfg = toJobConfig(row);
  if (row.jobKey === 'sla') {
    startSlaChecker(cfg);
  } else if (row.jobKey.startsWith('crm.')) {
    startCrmJob(row.jobKey as CrmJobKey, cfg);
  } else if (row.jobKey === 'credit.monitor') {
    startMonitorJob(cfg);
  } else if (row.jobKey === 'credit.loo_expiry') {
    startLooExpiryJob(cfg);
  } else if (row.jobKey === 'credit.sla_checker') {
    startCreditSlaChecker();
  } else if (row.jobKey === 'credit.aml_rescreen') {
    startAmlRescreenChecker();
  } else if (row.jobKey === 'credit.audit_retention') {
    startAuditRetentionJob(cfg);
  } else if (row.jobKey === 'workflow.outbox') {
    // Interval-based: scheduler calls triggerJob on each tick; start is a no-op.
  }
}

function stopJobByKey(jobKey: string): void {
  if (jobKey === 'sla') {
    stopSlaChecker();
  } else if (jobKey.startsWith('crm.')) {
    stopCrmJob(jobKey as CrmJobKey);
  } else if (jobKey === 'credit.monitor') {
    stopMonitorJob();
  } else if (jobKey === 'credit.loo_expiry') {
    stopLooExpiryJob();
  } else if (jobKey === 'credit.sla_checker') {
    stopCreditSlaChecker();
  } else if (jobKey === 'credit.aml_rescreen') {
    stopAmlRescreenChecker();
  } else if (jobKey === 'credit.audit_retention') {
    stopAuditRetentionJob();
  }
  // workflow.outbox has no persistent worker to stop.
}

export async function initScheduler(): Promise<void> {
  const count = await prisma.schedulerConfig.count();
  if (count === 0) await seedDefaults();

  const rows = await prisma.schedulerConfig.findMany();
  for (const row of rows) {
    startJobByKey(row as SchedulerConfigRow);
  }
  startSlaTimerWorker();
  logger.info(`[Scheduler] Initialized ${rows.length} jobs`);
}

export async function shutdownScheduler(): Promise<void> {
  stopSlaChecker();
  (Object.keys(CRM_JOB_FNS) as CrmJobKey[]).forEach(stopCrmJob);
  await stopMonitorJob();
  stopLooExpiryJob();
  stopCreditSlaChecker();
  stopAmlRescreenChecker();
  stopAuditRetentionJob();
  await stopSlaTimerWorker();
  logger.info('[Scheduler] All jobs stopped');
}

export async function listConfigs(): Promise<SchedulerConfigRow[]> {
  return prisma.schedulerConfig.findMany({ orderBy: { jobKey: 'asc' } }) as Promise<SchedulerConfigRow[]>;
}

export async function updateConfig(
  jobKey: string,
  patch: { enabled?: boolean; mode?: string; cronExpr?: string | null; intervalMs?: number | null },
  updatedBy: string,
): Promise<SchedulerConfigRow> {
  const existing = await prisma.schedulerConfig.findUnique({ where: { jobKey } });
  if (!existing) throw Object.assign(new Error(`Unknown jobKey: ${jobKey}`), { status: 404 });

  const effectiveMode = patch.mode || existing.mode;
  const effectiveCronExpr = patch.cronExpr !== undefined ? patch.cronExpr : existing.cronExpr;

  if (effectiveMode === 'cron' && effectiveCronExpr && !cron.validate(effectiveCronExpr)) {
    throw Object.assign(new Error(`Invalid cron expression: "${effectiveCronExpr}"`), { status: 400 });
  }

  const updated = await prisma.schedulerConfig.update({
    where: { jobKey },
    data: { ...patch, updatedBy },
  });
  return updated as SchedulerConfigRow;
}

export async function restartJob(jobKey: string): Promise<void> {
  const row = await prisma.schedulerConfig.findUnique({ where: { jobKey } });
  if (!row) throw Object.assign(new Error(`Unknown jobKey: ${jobKey}`), { status: 404 });
  stopJobByKey(jobKey);
  startJobByKey(row as SchedulerConfigRow);
  logger.info(`[Scheduler] Restarted job: ${jobKey}`);
}

/**
 * P3-05: Run a job with a distributed lock.
 * Acquires a Redis lock before executing; skips if another instance holds it.
 * Always releases the lock afterward (even on error).
 */
async function runWithLock(jobKey: string, fn: () => Promise<void>): Promise<void> {
    const lock = await acquireLock(jobKey);
    if (!lock.acquired) {
        logger.info(`[Scheduler] Skipping ${jobKey} — lock held by another instance`);
        return;
    }
    try {
        await fn();
    } finally {
        await releaseLock(lock);
    }
}

export async function triggerJob(jobKey: string): Promise<void> {
  const row = await prisma.schedulerConfig.findUnique({ where: { jobKey } });
  if (!row) throw Object.assign(new Error(`Unknown jobKey: ${jobKey}`), { status: 404 });

  // P3-05: Wrap execution in a distributed lock so only one instance runs the job.
  await runWithLock(jobKey, async () => {
    if (jobKey === 'sla') {
      await runSlaChecks();
    } else if (jobKey.startsWith('crm.')) {
      await CRM_JOB_FNS[jobKey as CrmJobKey]();
    } else if (jobKey === 'credit.monitor') {
      await processDailyCheck();
    } else if (jobKey === 'credit.loo_expiry') {
      await runLooExpiryCheck();
    } else if (jobKey === 'credit.sla_checker') {
      await runCreditSlaChecks();
    } else if (jobKey === 'credit.aml_rescreen') {
      await runAmlRescreen();
    } else if (jobKey === 'credit.audit_retention') {
      await runAuditRetentionCheck();
    } else if (jobKey === 'workflow.outbox') {
      await dispatchOutboxBatch({ workerId: `scheduler-${process.pid}` });
    }
  });

  // Update lastRunAt after execution (whether lock was acquired or not —
  // if skipped, we still record a heartbeat so the admin dashboard shows activity)
  await prisma.schedulerConfig.update({
    where: { jobKey },
    data: { lastRunAt: new Date(), lastStatus: 'success', lastError: null },
  }).catch(async (err: any) => {
    await prisma.schedulerConfig.update({
      where: { jobKey },
      data: { lastRunAt: new Date(), lastStatus: 'error', lastError: String(err?.message || err) },
    });
  });
}