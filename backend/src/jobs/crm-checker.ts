import cron, { ScheduledTask } from 'node-cron';
import {
  checkActivityReminders,
  checkLeadAging,
  checkOverdueFollowUps,
  checkStaleDeals,
  checkTrustReviewDates,
  checkKycExpiration,
  checkRepInactivity,
} from '../services/crm-automation.service';
import { logger } from '../utils/logger';

export interface JobConfig {
  enabled: boolean;
  mode: 'cron' | 'interval';
  cronExpr?: string;
  intervalMs?: number;
}

export type CrmJobKey =
  | 'crm.activity_reminders'
  | 'crm.lead_aging'
  | 'crm.overdue_followups'
  | 'crm.stale_deals'
  | 'crm.trust_reviews'
  | 'crm.kyc_expiration'
  | 'crm.rep_inactivity';

function safeRun(key: string, fn: () => Promise<void>): Promise<void> {
  return fn().catch((e) => { logger.error(`[CRM] ${key} failed`, { error: e }); });
}

export const CRM_JOB_FNS: Record<CrmJobKey, () => Promise<void>> = {
  'crm.activity_reminders': () => safeRun('Activity reminders', checkActivityReminders),
  'crm.lead_aging':         () => safeRun('Lead aging', checkLeadAging),
  'crm.overdue_followups':  () => safeRun('Overdue follow-ups', checkOverdueFollowUps),
  'crm.stale_deals':        () => safeRun('Stale deals', checkStaleDeals),
  'crm.trust_reviews':      () => safeRun('Trust reviews', checkTrustReviewDates),
  'crm.kyc_expiration':     () => safeRun('KYC expiration', checkKycExpiration),
  'crm.rep_inactivity':     () => safeRun('Rep inactivity', checkRepInactivity),
};

const tasks = new Map<CrmJobKey, ScheduledTask | ReturnType<typeof setInterval>>();

export function startCrmJob(jobKey: CrmJobKey, cfg: JobConfig): void {
  stopCrmJob(jobKey);
  if (!cfg.enabled) {
    logger.info(`[CRM] ${jobKey} disabled — skipping`);
    return;
  }
  const fn = CRM_JOB_FNS[jobKey];
  if (cfg.mode === 'cron') {
    const expr = cfg.cronExpr || '0 9 * * 1-5';
    if (!cron.validate(expr)) {
      logger.error(`[CRM] Invalid cron for ${jobKey}: "${expr}" — skipping`);
      return;
    }
    const task = cron.schedule(expr, () => {
      logger.info(`[CRM] ${jobKey} running (cron: ${expr})`);
      fn();
    });
    tasks.set(jobKey, task);
    logger.info(`[CRM] ${jobKey} scheduled (cron: ${expr})`);
  } else {
    const ms = cfg.intervalMs || 3600000;
    const id = setInterval(() => { fn(); }, ms);
    tasks.set(jobKey, id);
    logger.info(`[CRM] ${jobKey} started (interval: ${ms / 1000}s)`);
  }
}

export function stopCrmJob(jobKey: CrmJobKey): void {
  const handle = tasks.get(jobKey);
  if (!handle) return;
  if (typeof handle === 'object' && 'stop' in handle) {
    (handle as ScheduledTask).stop();
  } else {
    clearInterval(handle as ReturnType<typeof setInterval>);
  }
  tasks.delete(jobKey);
}

export function startCrmChecker(configs: Record<CrmJobKey, JobConfig>): void {
  (Object.keys(configs) as CrmJobKey[]).forEach((key) => startCrmJob(key, configs[key]));
}

export function stopCrmChecker(): void {
  (Object.keys(CRM_JOB_FNS) as CrmJobKey[]).forEach(stopCrmJob);
  logger.info('[CRM] All CRM jobs stopped');
}