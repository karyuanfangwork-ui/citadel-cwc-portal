#!/usr/bin/env tsx
/**
 * Rehash Audit Chain — Clear all audit events and re-seed with proper hashes
 *
 * This script:
 * 1. Deletes all creditAuditEvent rows
 * 2. Re-seeds audit events via AuditChainService.appendEvent() (v2 hash formula)
 * 3. Runs verifyChain on every application to confirm integrity
 *
 * Usage:
 *   npx tsx prisma/rehash-audit-chain.ts           # Full rehash
 *   npx tsx prisma/rehash-audit-chain.ts --verify   # Verify only (no data changes)
 */
import { PrismaClient } from '@prisma/client';
import { AuditChainService } from '../src/credit/services/auditChain.service';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const verifyOnly = args.includes('--verify');

const STATE_ORDER = [
  'DRAFT', 'SUBMITTED', 'KYC_REVIEW', 'KYC_APPROVED', 'UNDERWRITING',
  'CREDIT_ASSESSMENT', 'COMMITTEE_REVIEW', 'APPROVED', 'OFFER', 'ACCEPTED',
  'DISBURSED', 'ACTIVE', 'CLOSED',
];

const SPECIAL_STATES: Record<string, string[]> = {
  'REJECTED': ['DRAFT', 'SUBMITTED', 'KYC_REVIEW', 'KYC_APPROVED', 'UNDERWRITING', 'CREDIT_ASSESSMENT', 'COMMITTEE_REVIEW'],
  'WITHDRAWN': ['DRAFT', 'SUBMITTED'],
};

function getAction(prevState: string | null, newState: string): string {
  if (newState === 'REJECTED' || newState === 'KYC_REJECTED') return 'reject';
  if (newState === 'WITHDRAWN') return 'withdraw';
  if (!prevState) return 'submit';
  if (prevState === 'DRAFT') return 'submit';
  if (prevState === 'KYC_REVIEW') return 'approve';
  if (prevState === 'COMMITTEE_REVIEW') return 'approve';
  return 'advance';
}

async function verifyAll() {
  const apps = await prisma.creditAuditEvent.findMany({
    select: { applicationId: true },
    distinct: ['applicationId'],
  });

  let intact = 0;
  let broken = 0;

  for (const { applicationId } of apps) {
    const result = await AuditChainService.verifyChain(applicationId);
    if (result.valid) {
      intact++;
    } else {
      broken++;
      console.log(`  ❌ BROKEN: ${applicationId} at event ${result.brokenAt}`);
    }
  }

  console.log(`\n📊 Verification: ${intact} intact, ${broken} broken (total ${apps.length} applications)`);
  return broken === 0;
}

async function rehash() {
  // 1. Count and delete all audit events (LOS-013: must bypass immutability trigger)
  const count = await AuditChainService.withImmutabilityBypass(async (tx) => {
    const result = await tx.creditAuditEvent.deleteMany({});
    return result.count;
  });
  console.log(`🗑️  Deleted ${count} audit events`);

  // 2. Find all credit applications and admin user
  const apps = await prisma.creditApplication.findMany({
    select: { id: true, state: true },
  });
  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@test.local' },
    select: { id: true },
  });
  const adminId = adminUser?.id ?? '';
  console.log(`📋 Found ${apps.length} applications to re-seed (adminId: ${adminId || 'NOT FOUND'})`);

  if (!adminId) {
    console.error('❌ Admin user not found. Cannot re-seed audit events.');
    process.exit(1);
  }

  // 3. Re-seed audit events using AuditChainService
  let total = 0;
  for (const app of apps) {
    const currentState = app.state as string;
    let visitedStates: string[];

    if (SPECIAL_STATES[currentState]) {
      visitedStates = SPECIAL_STATES[currentState];
    } else {
      const idx = STATE_ORDER.indexOf(currentState);
      if (idx < 0) continue;
      visitedStates = STATE_ORDER.slice(0, idx + 1);
    }

    for (let i = 0; i < visitedStates.length; i++) {
      const newState = visitedStates[i];
      const prevState = i > 0 ? visitedStates[i - 1] : null;
      if (prevState === null && newState === 'DRAFT') continue;

      const action = getAction(prevState, newState);
      await AuditChainService.appendEvent(
        app.id,
        'STATE_TRANSITION',
        adminId,
        action,
        prevState,
        newState,
        { source: 'rehash', transition: `${prevState || 'NEW'} → ${newState}` },
      );
      total++;
    }
  }

  console.log(`✅ Re-seeded ${total} audit events with v2 hash chain`);

  // 4. Verify
  const ok = await verifyAll();
  if (ok) {
    console.log('🎉 Hash chain integrity confirmed — all chains INTACT');
  } else {
    console.error('⚠️  Hash chain verification FAILED — some chains are still broken');
    process.exit(1);
  }
}

async function main() {
  if (verifyOnly) {
    console.log('🔍 Verifying audit hash chain integrity...\n');
    const ok = await verifyAll();
    if (ok) {
      console.log('🎉 All chains intact!');
    } else {
      console.error('⚠️  Some chains are broken!');
      process.exit(1);
    }
  } else {
    console.log('🔄 Rehashing audit chain — clear and re-seed...\n');
    await rehash();
  }
}

main()
  .catch((e) => {
    console.error('❌ Rehash failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });