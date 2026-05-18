import cron, { ScheduledTask } from 'node-cron';
import { config } from '../config';
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

let activityReminderTask: ScheduledTask | null = null;
let leadAgingTask: ScheduledTask | null = null;
let overdueFollowUpTask: ScheduledTask | null = null;
let staleDealsTask: ScheduledTask | null = null;
let trustReviewTask: ScheduledTask | null = null;
let kycExpirationTask: ScheduledTask | null = null;
let repInactivityTask: ScheduledTask | null = null;

// Cron expressions — run each check at a different time to spread load
const ACTIVITY_REMINDER_CRON = '0 */4 * * *';   // Every 4 hours
const LEAD_AGING_CRON = '0 8 * * 1-5';           // Mon–Fri 8:00 AM
const OVERDUE_FOLLOWUP_CRON = '30 8 * * 1-5';    // Mon–Fri 8:30 AM
const STALE_DEALS_CRON = '0 9 * * 1-5';           // Mon–Fri 9:00 AM
const TRUST_REVIEW_CRON = '0 10 * * 1-5';          // Mon–Fri 10:00 AM
const KYC_EXPIRATION_CRON = '0 6 * * 1-5';        // Mon–Fri 6:00 AM
const REP_INACTIVITY_CRON = '0 16 * * 1-5';       // Mon–Fri 4:00 PM

async function runActivityReminders(): Promise<void> {
  await checkActivityReminders().catch((err) =>
    logger.error('[CRM] Activity reminder check failed', { error: err }),
  );
}

async function runLeadAging(): Promise<void> {
  await checkLeadAging().catch((err) =>
    logger.error('[CRM] Lead aging check failed', { error: err }),
  );
}

async function runOverdueFollowUps(): Promise<void> {
  await checkOverdueFollowUps().catch((err) =>
    logger.error('[CRM] Overdue follow-up check failed', { error: err }),
  );
}

async function runStaleDeals(): Promise<void> {
  await checkStaleDeals().catch((err) =>
    logger.error('[CRM] Stale deals check failed', { error: err }),
  );
}

async function runTrustReviewDates(): Promise<void> {
  await checkTrustReviewDates().catch((err) =>
    logger.error('[CRM] Trust review dates check failed', { error: err }),
  );
}

async function runKycExpiration(): Promise<void> {
  await checkKycExpiration().catch((err) =>
    logger.error('[CRM] KYC expiration check failed', { error: err }),
  );
}

async function runRepInactivity(): Promise<void> {
  await checkRepInactivity().catch((err) =>
    logger.error('[CRM] Rep inactivity check failed', { error: err }),
  );
}

function scheduleTask(
  label: string,
  cronExpr: string,
  task: () => Promise<void>,
): ScheduledTask | null {
  if (!cron.validate(cronExpr)) {
    logger.error(`[CRM] Invalid cron expression for ${label}: "${cronExpr}" — skipping`);
    return null;
  }

  const scheduled = cron.schedule(cronExpr, () => {
    logger.info(`[CRM] Running ${label} (cron: ${cronExpr})`);
    task();
  });

  logger.info(`[CRM] ${label} scheduled (cron: ${cronExpr})`);
  return scheduled;
}

export function startCrmChecker(): void {
  const { mode } = config.crmSchedule;

  if (mode === 'disabled') {
    logger.info('[CRM] CRM checker is disabled (mode=disabled)');
    return;
  }

  if (mode === 'cron') {
    activityReminderTask = scheduleTask('Activity Reminders', ACTIVITY_REMINDER_CRON, runActivityReminders);
    leadAgingTask = scheduleTask('Lead Aging', LEAD_AGING_CRON, runLeadAging);
    overdueFollowUpTask = scheduleTask('Overdue Follow-Ups', OVERDUE_FOLLOWUP_CRON, runOverdueFollowUps);
    staleDealsTask = scheduleTask('Stale Deals', STALE_DEALS_CRON, runStaleDeals);
    trustReviewTask = scheduleTask('Trust Review Dates', TRUST_REVIEW_CRON, runTrustReviewDates);
    kycExpirationTask = scheduleTask('KYC Expiration', KYC_EXPIRATION_CRON, runKycExpiration);
    repInactivityTask = scheduleTask('Rep Inactivity', REP_INACTIVITY_CRON, runRepInactivity);
  } else {
    // Legacy interval mode — run all checks on a shared interval
    const { intervalMs } = config.crmSchedule;
    logger.info(`[CRM] CRM checker started (interval: ${intervalMs / 1000}s)`);

    setInterval(() => {
      logger.info(`[CRM] Running all checks (interval: ${intervalMs / 1000}s)`);
      runActivityReminders();
      runLeadAging();
      runOverdueFollowUps();
      runStaleDeals();
      runTrustReviewDates();
      runKycExpiration();
      runRepInactivity();
    }, intervalMs);
  }
}

export function stopCrmChecker(): void {
  if (activityReminderTask) {
    activityReminderTask.stop();
    activityReminderTask = null;
  }
  if (leadAgingTask) {
    leadAgingTask.stop();
    leadAgingTask = null;
  }
  if (overdueFollowUpTask) {
    overdueFollowUpTask.stop();
    overdueFollowUpTask = null;
  }
  if (staleDealsTask) {
    staleDealsTask.stop();
    staleDealsTask = null;
  }
  if (trustReviewTask) {
    trustReviewTask.stop();
    trustReviewTask = null;
  }
  if (kycExpirationTask) {
    kycExpirationTask.stop();
    kycExpirationTask = null;
  }
  if (repInactivityTask) {
    repInactivityTask.stop();
    repInactivityTask = null;
  }
  logger.info('[CRM] CRM checker stopped');
}