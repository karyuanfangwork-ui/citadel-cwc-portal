import '../config';
import prisma from '../utils/prisma';
import { runWithExecutionScope } from '../lib/execution-scope';
import { DEFAULT_RETAINED_OWNER_EMAILS, normalizeEmails } from './retain-crm-leads';

const SCRIPT_ACTOR_EMAIL = 'crm-retention-script@system.local';

type OpportunitySnapshot = {
  id: string;
  name: string;
  ownerId: string;
  ownerEmail: string;
  stageName: string;
  value: unknown;
  deletedAt: Date | null;
};

type RawOpportunity = Omit<OpportunitySnapshot, 'ownerEmail' | 'stageName'> & {
  owner: { email: string };
  stage: { name: string };
};

type RetentionDb = {
  user: { findMany(args: unknown): Promise<Array<{ id: string; email: string }>> };
  crmOpportunity: {
    findMany(args: unknown): Promise<RawOpportunity[]>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  $transaction<T>(callback: (tx: RetentionDb) => Promise<T>): Promise<T>;
  auditLog: { create(args: unknown): Promise<unknown> };
};

export type OpportunityRetentionReport = {
  tenantId: string;
  allowlistedEmails: string[];
  resolvedOwnerIds: string[];
  totalRows: number;
  activeRows: number;
  alreadyDeletedRows: number;
  retainedActiveRows: number;
  retainedByOwner: Record<string, number>;
  candidateCount: number;
  candidateStageCounts: Record<string, number>;
  candidates: Array<Pick<OpportunitySnapshot, 'id' | 'name' | 'ownerEmail' | 'stageName'>>;
  applied: boolean;
  archivedCount: number;
};

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

export async function buildOpportunityRetentionReport(
  db: RetentionDb,
  tenantId: string,
  retainedOwnerEmails: readonly string[] = DEFAULT_RETAINED_OWNER_EMAILS,
): Promise<{ report: OpportunityRetentionReport; candidates: OpportunitySnapshot[] }> {
  const allowlistedEmails = normalizeEmails(retainedOwnerEmails);
  if (allowlistedEmails.length === 0) throw new Error('RETENTION_ALLOWLIST_REQUIRED');

  const users = await db.user.findMany({
    where: { tenantId, email: { in: allowlistedEmails } },
    select: { id: true, email: true },
  });
  const usersByEmail = new Map(users.map(user => [user.email.trim().toLowerCase(), user]));
  const missingEmails = allowlistedEmails.filter(email => !usersByEmail.has(email));
  if (missingEmails.length > 0) {
    throw new Error(`RETENTION_OWNER_NOT_FOUND: ${missingEmails.join(', ')}`);
  }

  const rawOpportunities = await db.crmOpportunity.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      value: true,
      deletedAt: true,
      owner: { select: { email: true } },
      stage: { select: { name: true } },
    },
  });
  const opportunities: OpportunitySnapshot[] = rawOpportunities.map(({ owner, stage, ...opportunity }) => ({
    ...opportunity,
    ownerEmail: owner.email,
    stageName: stage.name,
  }));
  const retainedOwnerIds = new Set(users.map(user => user.id));
  const activeOpportunities = opportunities.filter(opportunity => opportunity.deletedAt === null);
  const candidates = activeOpportunities.filter(opportunity => !retainedOwnerIds.has(opportunity.ownerId));
  const retained = activeOpportunities.filter(opportunity => retainedOwnerIds.has(opportunity.ownerId));
  const retainedByOwner = retained.reduce<Record<string, number>>((counts, opportunity) => {
    counts[opportunity.ownerEmail] = (counts[opportunity.ownerEmail] ?? 0) + 1;
    return counts;
  }, {});

  return {
    report: {
      tenantId,
      allowlistedEmails,
      resolvedOwnerIds: users.map(user => user.id),
      totalRows: opportunities.length,
      activeRows: activeOpportunities.length,
      alreadyDeletedRows: opportunities.length - activeOpportunities.length,
      retainedActiveRows: retained.length,
      retainedByOwner,
      candidateCount: candidates.length,
      candidateStageCounts: countBy(candidates.map(candidate => candidate.stageName)),
      candidates: candidates.map(({ id, name, ownerEmail, stageName }) => ({ id, name, ownerEmail, stageName })),
      applied: false,
      archivedCount: 0,
    },
    candidates,
  };
}

export async function applyOpportunityRetention(
  db: RetentionDb,
  tenantId: string,
  candidates: OpportunitySnapshot[],
  expectedCandidates: number,
): Promise<number> {
  if (candidates.length !== expectedCandidates) {
    throw new Error(`RETENTION_EXPECTED_COUNT_MISMATCH: expected ${expectedCandidates}, found ${candidates.length}`);
  }
  if (candidates.length === 0) return 0;

  const archivedAt = new Date();
  return db.$transaction(async tx => {
    const result = await tx.crmOpportunity.updateMany({
      where: { tenantId, id: { in: candidates.map(candidate => candidate.id) }, deletedAt: null },
      data: { deletedAt: archivedAt },
    });
    if (result.count !== candidates.length) {
      throw new Error(`RETENTION_CONCURRENT_CHANGE: expected ${candidates.length}, archived ${result.count}`);
    }

    for (const candidate of candidates) {
      await tx.auditLog.create({
        data: {
          tenantId,
          userId: null,
          userEmail: SCRIPT_ACTOR_EMAIL,
          action: 'DELETE',
          resourceType: 'CrmOpportunity',
          resourceId: candidate.id,
          oldValues: {
            name: candidate.name,
            ownerId: candidate.ownerId,
            ownerEmail: candidate.ownerEmail,
            stageName: candidate.stageName,
            value: candidate.value,
            deletedAt: null,
          },
          newValues: {
            deletedAt: archivedAt.toISOString(),
            reason: 'CRM opportunity retention allowlist archival',
            retainedOwnerEmails: DEFAULT_RETAINED_OWNER_EMAILS,
          },
        },
      });
    }
    return result.count;
  });
}

export async function runOpportunityRetention(options: {
  db: RetentionDb;
  tenantId: string;
  retainedOwnerEmails?: readonly string[];
  apply?: boolean;
  expectedCandidates?: number;
}): Promise<OpportunityRetentionReport> {
  const { report, candidates } = await buildOpportunityRetentionReport(options.db, options.tenantId, options.retainedOwnerEmails);
  if (!options.apply) return report;
  if (options.expectedCandidates === undefined) throw new Error('RETENTION_EXPECTED_COUNT_REQUIRED');

  const archivedCount = await applyOpportunityRetention(options.db, options.tenantId, candidates, options.expectedCandidates);
  return { ...report, applied: true, archivedCount };
}

function parseArgs(argv: string[]): { tenantId: string; apply: boolean; expectedCandidates?: number } {
  const tenantIndex = argv.indexOf('--tenant');
  const tenantId = tenantIndex >= 0 ? argv[tenantIndex + 1] : undefined;
  if (!tenantId || tenantId.startsWith('--')) throw new Error('Usage: retain-crm-opportunities.ts --tenant <tenant-id> [--dry-run] [--apply --expected-candidates <count>]');

  const apply = argv.includes('--apply');
  const expectedIndex = argv.indexOf('--expected-candidates');
  const expectedValue = expectedIndex >= 0 ? Number(argv[expectedIndex + 1]) : undefined;
  if (apply && (expectedValue === undefined || !Number.isInteger(expectedValue) || expectedValue < 0)) {
    throw new Error('When using --apply, --expected-candidates must be a non-negative integer');
  }
  if (apply && argv.includes('--dry-run')) throw new Error('Use either --dry-run or --apply, not both');
  return { tenantId, apply, expectedCandidates: expectedValue };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const report = await runWithExecutionScope(
    { kind: 'tenant', tenantId: options.tenantId },
    () => runOpportunityRetention({ db: prisma as unknown as RetentionDb, ...options }),
  );
  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }).finally(async () => prisma.$disconnect());
}