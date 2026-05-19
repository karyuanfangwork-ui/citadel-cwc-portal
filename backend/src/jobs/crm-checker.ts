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

export const CRM_JOB_FNS: Record<CrmJobKey, () => Promise<void>> = {
  'crm.activity_reminders': () => checkActivityReminders().catch((e) => logger.error('[CRM] Activity reminders failed', { error: e })),
  'crm.lead_aging':         () => checkLeadAging().catch((e) => logger.error('[CRM] Lead aging failed', { error: e })),
  'crm.overdue_followups':  () => checkOverdueFollowUps().catch((e) => logger.error('[CRM] Overdue follow-ups failed', { error: e })),
  'crm.stale_deals':        () => checkStaleDeals().catch((e) => logger.error('[CRM] Stale deals failed', { error: e })),
  'crm.trust_reviews':      () => checkTrustReviewDates().catch((e) => logger.error('[CRM] Trust reviews failed', { error: e })),
  'crm.kyc_expiration':     () => checkKycExpiration().catch((e) => logger.error('[CRM] KYC expiration failed', { error: e })),
  'crm.rep_inactivity':     () => checkRepInactivity().catch((e) => logger.error('[CRM] Rep inactivity failed', { error: e })),
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