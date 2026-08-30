import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const LEGACY_MODEL_VERSIONS = ['AUTO', 'MANUAL', 'RESCORE', 'OVERRIDE'];
const BATCH_SIZE = 500;

async function main(): Promise<void> {
  let cursor: string | undefined;
  let examined = 0;
  let updated = 0;
  let unbackfillable = 0;

  while (true) {
    const rows = await prisma.applicationAssessmentResult.findMany({
      where: {
        OR: [
          { modelVersion: { in: LEGACY_MODEL_VERSIONS } },
          { modelVersion: null },
          { policyVersion: null },
        ],
      },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, scoreRunId: true },
    });

    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;
    examined += rows.length;

    for (const row of rows) {
      if (!row.scoreRunId) {
        unbackfillable += 1;
        continue;
      }

      const run = await prisma.creditScoreRun.findUnique({
        where: { id: row.scoreRunId },
        select: { scorecardVersionId: true, policyVersion: true },
      });
      if (!run) {
        unbackfillable += 1;
        continue;
      }

      await prisma.applicationAssessmentResult.update({
        where: { id: row.id },
        data: { modelVersion: run.scorecardVersionId, policyVersion: run.policyVersion },
      });
      updated += 1;
    }
  }

  console.log(`Assessment provenance backfill: examined=${examined} updated=${updated} unbackfillable=${unbackfillable}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
