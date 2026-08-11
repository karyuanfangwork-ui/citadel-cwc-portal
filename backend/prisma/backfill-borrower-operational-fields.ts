#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';
import {
  chooseUnambiguousOwner,
  formatBorrowerNumber,
  mapBorrowerLifecycle,
  mapBorrowerSegment,
} from '../src/credit/utils/borrowerOperational';

const prisma = new PrismaClient();
const WRITE_FLAG = '--write';
const DRY_RUN_FLAG = '--dry-run';
const TERMINAL_STATES = ['REJECTED', 'CLOSED', 'WITHDRAWN'];

type BackfillRow = {
  id: string;
  borrowerType: string;
  isActive: boolean;
  borrowerNumber: string | null;
  segment: string | null;
  lifecycleStatus: string | null;
  relationshipOwnerId: string | null;
  proposedBorrowerNumber: string;
  proposedSegment: ReturnType<typeof mapBorrowerSegment>;
  proposedLifecycleStatus: ReturnType<typeof mapBorrowerLifecycle>;
  proposedRelationshipOwnerId: string | null;
};

function parseBorrowerSequence(value: string | null): number | null {
  const match = value?.match(/^BRW-(\d{6})$/);
  return match ? Number(match[1]) : null;
}

async function findProposedOwnerId(borrowerId: string): Promise<string | null> {
  const applications = await prisma.creditApplication.findMany({
    where: {
      borrowerProfileId: borrowerId,
      state: { notIn: TERMINAL_STATES as never[] },
      assignedRmId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    select: { assignedRmId: true },
  });
  const candidate = chooseUnambiguousOwner(applications.map((application) => application.assignedRmId));
  if (!candidate) return null;

  const activeOwner = await prisma.user.findFirst({
    where: { id: candidate, isActive: true },
    select: { id: true },
  });
  return activeOwner?.id ?? null;
}

async function buildBackfillRows(): Promise<BackfillRow[]> {
  const borrowers = await prisma.borrowerProfile.findMany({
    // Include soft-deleted rows as well: the contract migration makes these
    // columns non-null for the whole table, and their identifiers must remain
    // stable if a record is later restored or audited.
    where: {},
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      borrowerType: true,
      isActive: true,
      borrowerNumber: true,
      segment: true,
      lifecycleStatus: true,
      relationshipOwnerId: true,
    },
  });

  const existingNumbers = new Set<string>();
  let nextSequence = 1;
  for (const borrower of borrowers) {
    if (borrower.borrowerNumber) {
      if (existingNumbers.has(borrower.borrowerNumber)) {
        throw new Error(`Duplicate borrower number detected: ${borrower.borrowerNumber}`);
      }
      existingNumbers.add(borrower.borrowerNumber);
      const sequence = parseBorrowerSequence(borrower.borrowerNumber);
      if (sequence) nextSequence = Math.max(nextSequence, sequence + 1);
    }
  }

  const rows: BackfillRow[] = [];
  for (const borrower of borrowers) {
    let proposedBorrowerNumber = borrower.borrowerNumber;
    if (!proposedBorrowerNumber) {
      proposedBorrowerNumber = formatBorrowerNumber(nextSequence++);
      existingNumbers.add(proposedBorrowerNumber);
    }

    rows.push({
      id: borrower.id,
      borrowerType: borrower.borrowerType,
      isActive: borrower.isActive,
      borrowerNumber: borrower.borrowerNumber,
      segment: borrower.segment,
      lifecycleStatus: borrower.lifecycleStatus,
      relationshipOwnerId: borrower.relationshipOwnerId,
      proposedBorrowerNumber,
      proposedSegment: mapBorrowerSegment(borrower.borrowerType),
      proposedLifecycleStatus: mapBorrowerLifecycle(borrower.isActive),
      proposedRelationshipOwnerId: borrower.relationshipOwnerId ?? await findProposedOwnerId(borrower.id),
    });
  }
  return rows;
}

function printReport(rows: BackfillRow[]): void {
  const unresolvedOwners = rows.filter((row) => !row.proposedRelationshipOwnerId).length;
  const corporateReviewCount = rows.filter((row) => row.borrowerType === 'CORPORATE').length;
  console.log(`Borrowers examined: ${rows.length}`);
  console.log(`Borrower numbers to assign: ${rows.filter((row) => !row.borrowerNumber).length}`);
  console.log(`Owner unresolved/left null: ${unresolvedOwners}`);
  console.log(`Corporate segment review records: ${corporateReviewCount}`);
  console.log('reclassification_review_csv');
  console.log('borrowerId,borrowerType,proposedSegment,reason');
  for (const row of rows.filter((candidate) => candidate.borrowerType === 'CORPORATE')) {
    console.log(`${row.id},${row.borrowerType},${row.proposedSegment},legal type does not prove SME segment`);
  }
}

async function apply(rows: BackfillRow[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      await tx.borrowerProfile.update({
        where: { id: row.id },
        data: {
          borrowerNumber: row.proposedBorrowerNumber,
          segment: row.proposedSegment,
          lifecycleStatus: row.proposedLifecycleStatus,
          relationshipOwnerId: row.proposedRelationshipOwnerId,
        },
      });
    }
    const maxSequence = rows.reduce((max, row) => Math.max(max, parseBorrowerSequence(row.proposedBorrowerNumber) ?? 0), 0);
    await tx.$executeRawUnsafe(`SELECT setval('borrower_number_seq', ${Math.max(maxSequence, 1)}, true)`);
  });
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  if (!args.has(WRITE_FLAG) && !args.has(DRY_RUN_FLAG)) {
    throw new Error('Specify exactly one mode: --dry-run or --write');
  }
  if (args.has(WRITE_FLAG) && args.has(DRY_RUN_FLAG)) {
    throw new Error('Specify exactly one mode: --dry-run or --write');
  }

  try {
    const rows = await buildBackfillRows();
    printReport(rows);
    if (args.has(WRITE_FLAG)) {
      await apply(rows);
      console.log('Backfill applied transactionally.');
    } else {
      console.log('Dry run only; no borrower rows were changed.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

export { buildBackfillRows, formatBorrowerNumber, parseBorrowerSequence };
