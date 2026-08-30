import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const LEGACY_MODEL_VERSIONS = ['AUTO', 'MANUAL', 'RESCORE', 'OVERRIDE'];
const BATCH_SIZE = 500;

export type BackfillMode = 'dry-run' | 'apply';

/**
 * Backfill is fail-closed: no flag means dry-run. Data writes require the
 * explicit --apply flag, and --dry-run/--apply cannot be combined.
 */
export function parseBackfillMode(argv: string[]): BackfillMode {
  const args = new Set(argv);
  const dryRun = args.has('--dry-run');
  const apply = args.has('--apply');

  if (dryRun && apply) {
    throw new Error('Use either --dry-run or --apply, not both');
  }

  return apply ? 'apply' : 'dry-run';
}

export async function backfillAssessmentProvenance(mode: BackfillMode): Promise<void> {
  let cursor: string | undefined;
  let examined = 0;
  let eligible = 0;
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

      eligible += 1;
      if (mode === 'dry-run') continue;

      await prisma.applicationAssessmentResult.update({
        where: { id: row.id },
        data: { modelVersion: run.scorecardVersionId, policyVersion: run.policyVersion },
      });
      updated += 1;
    }
  }

  console.log(`Assessment provenance backfill: mode=${mode} examined=${examined} eligible=${eligible} updated=${updated} unbackfillable=${unbackfillable}`);
}

if (require.main === module) {
  const mode = parseBackfillMode(process.argv.slice(2));
  backfillAssessmentProvenance(mode)
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
}
