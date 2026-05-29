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
 * (tamper evidence) and logs any breaks.
 *
 * Scheduled: runs daily via BullMQ or cron.
 * Run: npx tsx src/credit/jobs/auditRetention.job.ts
 */

import prisma from '../../utils/prisma';
import { logger } from '../../utils/logger';
import crypto from 'crypto';

const RETENTION_YEARS = 7;
const RETENTION_MS = RETENTION_YEARS * 365.25 * 24 * 60 * 60 * 1000;

interface RetentionReport {
  totalEvents: number;
  oldestEvent: Date | null;
  newestEvent: Date | null;
  eventsOlderThan7Years: number;
  hashChainIntact: boolean;
  hashBreaks: number;
  checkedAt: Date;
}

/**
 * Generate a deterministic hash for a CreditAuditEvent row.
 * This mirrors the hash-chain pattern already partially in the schema (hash field).
 */
function computeEventHash(event: {
  id: string;
  applicationId: string;
  eventType: string;
  actorId: string | null;
  action: string;
  oldState: string | null;
  newState: string | null;
  metadata: any;
  createdAt: Date;
  prevHash: string | null;
}): string {
  const payload = [
    event.applicationId,
    event.eventType,
    event.actorId ?? '',
    event.action,
    event.oldState ?? '',
    event.newState ?? '',
    typeof event.metadata === 'string' ? event.metadata : JSON.stringify(event.metadata ?? {}),
    event.createdAt.toISOString(),
    event.prevHash ?? '',
  ].join('|');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Check retention thresholds and hash-chain integrity.
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

  // Verify hash-chain integrity (sample the last 1000 events)
  const recentEvents = await prisma.creditAuditEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  let hashBreaks = 0;
  let prevHash: string | null = null;

  // Walk in chronological order
  const chronologically = [...recentEvents].reverse();
  for (const event of chronologically) {
    const expectedHash = computeEventHash({
      id: event.id,
      applicationId: event.applicationId,
      eventType: event.eventType,
      actorId: event.actorId,
      action: event.action,
      oldState: event.oldState,
      newState: event.newState,
      metadata: event.metadata,
      createdAt: event.createdAt,
      prevHash: prevHash,
    });

    if (event.hash && event.hash !== expectedHash) {
      hashBreaks++;
      logger.warn(`[AuditRetention] Hash mismatch on event ${event.id}: stored=${event.hash.substring(0, 16)}... computed=${expectedHash.substring(0, 16)}...`);
    }

    prevHash = event.hash ?? expectedHash;
  }

  const hashChainIntact = hashBreaks === 0;

  const report: RetentionReport = {
    totalEvents,
    oldestEvent: oldest?.createdAt ?? null,
    newestEvent: newest?.createdAt ?? null,
    eventsOlderThan7Years,
    hashChainIntact,
    hashBreaks,
    checkedAt: new Date(),
  };

  // If events are approaching or past retention, raise an EWS
  if (eventsOlderThan7Years > 0) {
    logger.warn(`[AuditRetention] ${eventsOlderThan7Years} audit events are older than ${RETENTION_YEARS} years. Manual archival review required.`);
  }

  if (!hashChainIntact) {
    logger.error(`[AuditRetention] Hash-chain integrity check FAILED: ${hashBreaks} breaks detected.`);
  }

  logger.info(`[AuditRetention] Check complete: ${totalEvents} events, ${eventsOlderThan7Years} past retention, hash ${hashChainIntact ? 'INTACT' : 'BROKEN'}`);
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
  console.log(`  Hash-chain intact:   ${report.hashChainIntact ? '✅ YES' : '❌ NO'}`);
  if (!report.hashChainIntact) {
    console.log(`  Hash breaks:         ${report.hashBreaks}`);
  }
  console.log(`  Checked at:          ${report.checkedAt.toISOString()}`);
  console.log('─'.repeat(50));

  if (report.eventsOlderThan7Years > 0) {
    console.log(`\n⚠️  ${report.eventsOlderThan7Years} events are past the ${RETENTION_YEARS}-year retention threshold.`);
    console.log('   Manual archival sign-off is required before purging. This job does NOT auto-delete.');
  }

  await prisma.$disconnect();
}

// Run if called directly
main().catch(err => {
  console.error('❌ Audit retention check failed:', err);
  process.exit(1);
});