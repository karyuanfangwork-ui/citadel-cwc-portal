/**
 * P2-2: Backfill Processing Lane
 *
 * Assigns lane to existing CreditApplications based on their borrower type,
 * requested amount, and (where available) annual turnover.
 *
 * Run: npx ts-node prisma/backfill-lane.ts
 */

import { PrismaClient, ProcessingLane, BorrowerType } from '@prisma/client';

const prisma = new PrismaClient();

const PERSONAL_FAST_CAP = 150_000;
const SME_TURNOVER_CAP = 5_000_000;

function determineLane(
  borrowerType: BorrowerType | null,
  requestedAmount: number,
  annualTurnover: number | null,
): ProcessingLane {
  if (borrowerType === 'INDIVIDUAL' && requestedAmount <= PERSONAL_FAST_CAP) {
    return ProcessingLane.PERSONAL_FAST;
  }
  if (borrowerType === 'SOLE_PROPRIETOR') {
    return ProcessingLane.SME;
  }
  if (borrowerType === 'CORPORATE' && annualTurnover !== null && annualTurnover < SME_TURNOVER_CAP) {
    return ProcessingLane.SME;
  }
  return ProcessingLane.CORPORATE;
}

async function main() {
  console.log('🔄 P2-2: Backfilling Processing Lane on CreditApplications...');

  const apps = await prisma.creditApplication.findMany({
    select: {
      id: true,
      requestedAmount: true,
      borrowerProfile: {
        select: { borrowerType: true, annualTurnover: true },
      },
    },
  });

  console.log(`Found ${apps.length} applications to process.`);

  let personalFast = 0;
  let sme = 0;
  let corporate = 0;

  for (const app of apps) {
    const lane = determineLane(
      app.borrowerProfile?.borrowerType ?? null,
      Number(app.requestedAmount),
      app.borrowerProfile?.annualTurnover ? Number(app.borrowerProfile.annualTurnover) : null,
    );

    await prisma.creditApplication.update({
      where: { id: app.id },
      data: { lane },
    });

    if (lane === ProcessingLane.PERSONAL_FAST) personalFast++;
    else if (lane === ProcessingLane.SME) sme++;
    else corporate++;
  }

  console.log(`✅ Backfill complete:`);
  console.log(`   PERSONAL_FAST: ${personalFast}`);
  console.log(`   SME:           ${sme}`);
  console.log(`   CORPORATE:     ${corporate}`);
  console.log(`   Total:         ${apps.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());