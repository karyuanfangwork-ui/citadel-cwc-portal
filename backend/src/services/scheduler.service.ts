import cron from 'node-cron';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import { startSlaChecker, stopSlaChecker, runSlaChecks, JobConfig } from '../jobs/sla-checker';
import { startCrmJob, stopCrmJob, CrmJobKey, CRM_JOB_FNS } from '../jobs/crm-checker';
import { startMonitorJob, stopMonitorJob, processDailyCheck } from '../credit/jobs/monitor.job';

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
  { jobKey: 'crm.activity_reminders', label: 'CRM: Activity Reminders',  enabled: true, mode: 'cron', cronExpr: '0 */4 * * *',   intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'crm.lead_aging',         label: 'CRM: Lead Aging',          enabled: true, mode: 'cron', cronExpr: '0 8 * * 1-5',   intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'crm.overdue_followups',  label: 'CRM: Overdue Follow-Ups',  enabled: true, mode: 'cron', cronExpr: '30 8 * * 1-5',  intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'crm.stale_deals',        label: 'CRM: Stale Deals',         enabled: true, mode: 'cron', cronExpr: '0 9 * * 1-5',   intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'crm.trust_reviews',      label: 'CRM: Trust Review Dates',  enabled: true, mode: 'cron', cronExpr: '0 10 * * 1-5',  intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'crm.kyc_expiration',     label: 'CRM: KYC Expiration',      enabled: true, mode: 'cron', cronExpr: '0 6 * * 1-5',   intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'crm.rep_inactivity',     label: 'CRM: Rep Inactivity',      enabled: true, mode: 'cron', cronExpr: '0 16 * * 1-5',  intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'credit.monitor',         label: 'Credit Daily Monitor',     enabled: true, mode: 'interval', cronExpr: null, intervalMs: 86400000, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
];

async function seedDefaults(): Promise<void> {
  for (const cfg of DEFAULT_CONFIGS) {
    await prisma.schedulerConfig.upsert({
      where: { jobKey: cfg.jobKey },
      update: {},
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
  }
}

function stopJobByKey(jobKey: string): void {
  if (jobKey === 'sla') {
    stopSlaChecker();
  } else if (jobKey.startsWith('crm.')) {
    stopCrmJob(jobKey as CrmJobKey);
  } else if (jobKey === 'credit.monitor') {
    stopMonitorJob();
  }
}

export async function initScheduler(): Promise<void> {
  const count = await prisma.schedulerConfig.count();
  if (count === 0) await seedDefaults();

  const rows = await prisma.schedulerConfig.findMany();
  for (const row of rows) {
    startJobByKey(row as SchedulerConfigRow);
  }
  logger.info(`[Scheduler] Initialized ${rows.length} jobs`);
}

export async function shutdownScheduler(): Promise<void> {
  stopSlaChecker();
  (Object.keys(CRM_JOB_FNS) as CrmJobKey[]).forEach(stopCrmJob);
  await stopMonitorJob();
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

export async function triggerJob(jobKey: string): Promise<void> {
  const row = await prisma.schedulerConfig.findUnique({ where: { jobKey } });
  if (!row) throw Object.assign(new Error(`Unknown jobKey: ${jobKey}`), { status: 404 });

  try {
    if (jobKey === 'sla') {
      await runSlaChecks();
    } else if (jobKey.startsWith('crm.')) {
      await CRM_JOB_FNS[jobKey as CrmJobKey]();
    } else if (jobKey === 'credit.monitor') {
      await processDailyCheck();
    }
    await prisma.schedulerConfig.update({
      where: { jobKey },
      data: { lastRunAt: new Date(), lastStatus: 'success', lastError: null },
    });
  } catch (err: any) {
    await prisma.schedulerConfig.update({
      where: { jobKey },
      data: { lastRunAt: new Date(), lastStatus: 'error', lastError: String(err?.message || err) },
    });
    throw err;
  }
}