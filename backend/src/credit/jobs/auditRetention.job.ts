/**
 * Audit Retention Job — 7-year retention for CreditAuditEvent
 *
 * Per compliance requirement (§0.3 / §2.7 of implementation plan):
 *   - CreditAuditEvent rows must be retained for a minimum of 7 years.
 *   - After 7 years, rows may be archived (exported) and then purged.
 *   - This job checks retention status and raises an EarlyWarningSignal if
 *     the audit log is approaching or exceeding retention thresholds.
 *   - Actual purge is NOT automatic — requires manual sign-off.
 *
 * The job also verifies the hash-chain integrity of CreditAuditEvent records
 * (tamper evidence) using AuditChainService.verifyChain() per application.
 *
 * Scheduled: runs daily via BullMQ or cron.
 * Run: npx tsx src/credit/jobs/auditRetention.job.ts
 */

import prisma from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { AuditChainService } from '../services/auditChain.service';

const RETENTION_YEARS = 7;
const RETENTION_MS = RETENTION_YEARS * 365.25 * 24 * 60 * 60 * 1000;

interface RetentionReport {
  totalEvents: number;
  oldestEvent: Date | null;
  newestEvent: Date | null;
  eventsOlderThan7Years: number;
  chainValid: boolean;
  applicationsWithBrokenChains: number;
  totalBrokenEvents: number;
  checkedAt: Date;
}

/**
 * Check retention thresholds and hash-chain integrity.
 * Uses AuditChainService.verifyChain() per application for tamper evidence.
 * Returns a report but does NOT delete any data.
 */
export async function checkAuditRetention(): Promise<RetentionReport> {
  logger.info('[AuditRetention] Starting audit retention check...');

  const cutoffDate = new Date(Date.now() - RETENTION_MS);

  // Count total events
  const totalEvents = await prisma.creditAuditEvent.count();

  // Find oldest and newest
  const oldest = await prisma.creditAuditEvent.findFirst({ orderBy: { createdAt: 'asc' } });
  const newest = await prisma.creditAuditEvent.findFirst({ orderBy: { createdAt: 'desc' } });

  // Count events older than 7 years
  const eventsOlderThan7Years = await prisma.creditAuditEvent.count({
    where: { createdAt: { lt: cutoffDate } },
  });

  // Verify hash-chain integrity per application
  // Get distinct application IDs
  const applicationIds = await prisma.creditAuditEvent.findMany({
    select: { applicationId: true },
    distinct: ['applicationId'],
  });

  let applicationsWithBrokenChains = 0;
  let totalBrokenEvents = 0;

  for (const { applicationId } of applicationIds) {
    const result = await AuditChainService.verifyChain(applicationId);
    if (!result.valid) {
      applicationsWithBrokenChains++;
      logger.warn(
        `[AuditRetention] Hash-chain broken for application ${applicationId} at event ${result.brokenAt}`,
      );
      // Count broken events for this application
      const brokenCount = await prisma.creditAuditEvent.count({
        where: { applicationId },
      });
      totalBrokenEvents += brokenCount;
    }
  }

  const chainValid = applicationsWithBrokenChains === 0;

  const report: RetentionReport = {
    totalEvents,
    oldestEvent: oldest?.createdAt ?? null,
    newestEvent: newest?.createdAt ?? null,
    eventsOlderThan7Years,
    chainValid,
    applicationsWithBrokenChains,
    totalBrokenEvents,
    checkedAt: new Date(),
  };

  // If events are approaching or past retention, raise an EWS
  if (eventsOlderThan7Years > 0) {
    logger.warn(`[AuditRetention] ${eventsOlderThan7Years} audit events are older than ${RETENTION_YEARS} years. Manual archival review required.`);
  }

  if (!chainValid) {
    logger.error(`[AuditRetention] Hash-chain integrity check FAILED: ${applicationsWithBrokenChains} applications have broken chains.`);
  }

  logger.info(`[AuditRetention] Check complete: ${totalEvents} events, ${eventsOlderThan7Years} past retention, hash ${chainValid ? 'INTACT' : 'BROKEN'}`);
  return report;
}

/**
 * CLI entry point — run standalone for ad-hoc checks.
 */
async function main() {
  const report = await checkAuditRetention();
  console.log('\n📋 Audit Retention Report');
  console.log('─'.repeat(50));
  console.log(`  Total events:        ${report.totalEvents}`);
  console.log(`  Oldest event:        ${report.oldestEvent?.toISOString() ?? 'N/A'}`);
  console.log(`  Newest event:        ${report.newestEvent?.toISOString() ?? 'N/A'}`);
  console.log(`  Past ${RETENTION_YEARS}-year retention: ${report.eventsOlderThan7Years}`);
  console.log(`  Hash-chain intact:   ${report.chainValid ? '✅ YES' : '❌ NO'}`);
  if (!report.chainValid) {
    console.log(`  Applications with broken chains: ${report.applicationsWithBrokenChains}`);
  }
  console.log(`  Checked at:          ${report.checkedAt.toISOString()}`);
  console.log('─'.repeat(50));

  if (report.eventsOlderThan7Years > 0) {
    console.log(`\n⚠️  ${report.eventsOlderThan7Years} events are past the ${RETENTION_YEARS}-year retention threshold.`);
    console.log('   Manual archival sign-off is required before purging. This job does NOT auto-delete.');
  }

  await prisma.$disconnect();
}

// ---------------------------------------------------------------------------
// Scheduler integration — start/stop/run for the scheduler.service
// ---------------------------------------------------------------------------

import { JobConfig } from '../../jobs/sla-checker';
import cron, { ScheduledTask } from 'node-cron';

let cronTask: ScheduledTask | null = null;

/**
 * Start the audit retention job on a cron schedule.
 * Default: daily at 3:00 AM. Configurable via AUDIT_RETENTION_CRON env var.
 */
export function startAuditRetentionJob(cfg?: JobConfig): void {
  stopAuditRetentionJob();

  const effectiveCfg = cfg ?? { enabled: true, mode: 'cron', cronExpr: '0 3 * * *' };
  if (!effectiveCfg.enabled) {
    logger.info('[AuditRetention] Job disabled — skipping');
    return;
  }

  const expression = process.env.AUDIT_RETENTION_CRON ?? effectiveCfg.cronExpr ?? '0 3 * * *';

  if (!cron.validate(expression)) {
    logger.error(`[AuditRetention] Invalid cron expression: "${expression}". Falling back to daily 03:00.`);
    cronTask = cron.schedule('0 3 * * *', () => checkAuditRetention());
  } else {
    cronTask = cron.schedule(expression, () => {
      logger.info(`[AuditRetention] Running (cron: ${expression})`);
      checkAuditRetention();
    });
  }

  logger.info(`[AuditRetention] Job started (cron: ${expression})`);

  // Run immediately on start
  checkAuditRetention();
}

/**
 * Stop the audit retention job.
 */
export function stopAuditRetentionJob(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    logger.info('[AuditRetention] Job stopped');
  }
}

/**
 * Run a single audit retention check (for manual trigger from scheduler).
 */
export async function runAuditRetentionCheck(): Promise<RetentionReport> {
  return checkAuditRetention();
}

// Run only when executed as a script, not when imported by the app or tests.
if (require.main === module) {
  main().catch(err => {
    console.error('❌ Audit retention check failed:', err);
    process.exit(1);
  });
}
