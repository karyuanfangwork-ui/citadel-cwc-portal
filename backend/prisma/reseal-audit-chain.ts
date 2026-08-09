#!/usr/bin/env tsx
/**
 * Reseal Audit Chain — LOS-013
 *
 * Recomputes the hash chain IN PLACE, walking each application's events in
 * `sequence` order. Unlike `rehash-audit-chain.ts`, this deletes nothing and
 * synthesizes nothing: every existing event is preserved with its own actor,
 * metadata and timestamp. Only the `hash` / `hash_version` columns change.
 *
 * Run once after the 20260810120000_credit_audit_sequence migration, which
 * backfilled `sequence` but left hashes computed under the old ambiguous
 * createdAt ordering.
 *
 * Usage:
 *   npx tsx prisma/reseal-audit-chain.ts --dry-run   # report only
 *   npx tsx prisma/reseal-audit-chain.ts             # rewrite hashes
 */
import { PrismaClient } from '@prisma/client';
import { AuditChainService } from '../src/credit/services/auditChain.service';

const prisma = new PrismaClient();

const HASH_VERSION = 2;
const dryRun = process.argv.slice(2).includes('--dry-run');

async function main() {
  const apps = await prisma.creditAuditEvent.findMany({
    select: { applicationId: true },
    distinct: ['applicationId'],
  });

  console.log(`${dryRun ? '🔍 Dry run —' : '🔧'} resealing ${apps.length} application chains\n`);

  let resealed = 0;
  let alreadyValid = 0;

  for (const { applicationId } of apps) {
    const before = await AuditChainService.verifyChain(applicationId);
    if (before.valid) {
      alreadyValid++;
      continue;
    }

    const events = await prisma.creditAuditEvent.findMany({
      where: { applicationId },
      orderBy: [{ sequence: 'asc' }, { createdAt: 'asc' }],
    });

    let previousHash = '';
    const updates: { id: string; hash: string }[] = [];

    for (const event of events) {
      const hash = await AuditChainService.computeHash({
        id: event.id,
        applicationId: event.applicationId,
        eventType: event.eventType,
        actorId: event.actorId,
        action: event.action,
        oldState: event.oldState,
        newState: event.newState,
        metadata: event.metadata,
        createdAt: event.createdAt,
        previousHash,
        hashVersion: HASH_VERSION,
      });
      if (hash !== event.hash || event.hashVersion !== HASH_VERSION) {
        updates.push({ id: event.id, hash });
      }
      previousHash = hash;
    }

    console.log(`  ${applicationId}: ${updates.length}/${events.length} events need resealing`);

    if (!dryRun && updates.length > 0) {
      // The immutability trigger denies UPDATE; this is the documented
      // maintenance bypass, scoped to this transaction only.
      await AuditChainService.withImmutabilityBypass(async (tx) => {
        for (const u of updates) {
          await tx.$executeRaw`
            UPDATE credit_audit_events
            SET hash = ${u.hash}, hash_version = ${HASH_VERSION}
            WHERE id = ${u.id}::uuid`;
        }
      });

      const after = await AuditChainService.verifyChain(applicationId);
      if (!after.valid) {
        throw new Error(`Reseal failed for ${applicationId}: still broken at ${after.brokenAt}`);
      }
      resealed++;
    }
  }

  console.log(
    `\n📊 ${alreadyValid} already valid, ${dryRun ? 'would reseal' : 'resealed'} ${dryRun ? apps.length - alreadyValid : resealed}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
