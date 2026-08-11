import '../config';
import prisma from '../utils/prisma';
import { runWithExecutionScope } from '../lib/execution-scope';

export const DEFAULT_RETAINED_OWNER_EMAILS = [
  'rohani.munir@citadelgroup.com.my',
  'thasha.shaharis@citadelgroup.com.my',
  'cristel.erguiza@citadelgroup.com.my',
] as const;

const SCRIPT_ACTOR_EMAIL = 'crm-retention-script@system.local';

type LeadSnapshot = {
  id: string;
  title: string;
  status: string;
  ownerId: string;
  ownerEmail: string;
  contactEmail: string | null;
  deletedAt: Date | null;
};

type RawLead = Omit<LeadSnapshot, 'ownerEmail'> & { owner: { email: string } };

type RetentionDb = {
  user: { findMany(args: unknown): Promise<Array<{ id: string; email: string }>> };
  crmLead: {
    findMany(args: unknown): Promise<RawLead[]>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  $transaction<T>(callback: (tx: RetentionDb) => Promise<T>): Promise<T>;
  auditLog: { create(args: unknown): Promise<unknown> };
};

export type RetentionReport = {
  tenantId: string;
  allowlistedEmails: string[];
  resolvedOwnerIds: string[];
  totalRows: number;
  activeRows: number;
  alreadyDeletedRows: number;
  retainedActiveRows: number;
  retainedByOwner: Record<string, number>;
  candidateCount: number;
  candidateStatusCounts: Record<string, number>;
  candidates: Array<Pick<LeadSnapshot, 'id' | 'title' | 'status' | 'ownerEmail' | 'contactEmail'>>;
  applied: boolean;
  archivedCount: number;
};

export function normalizeEmails(emails: readonly string[]): string[] {
  return [...new Set(emails.map(email => email.trim().toLowerCase()).filter(Boolean))];
}

function countBy<T extends string>(values: T[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

export async function buildRetentionReport(
  db: RetentionDb,
  tenantId: string,
  retainedOwnerEmails: readonly string[] = DEFAULT_RETAINED_OWNER_EMAILS,
): Promise<{ report: RetentionReport; candidates: LeadSnapshot[] }> {
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

  const rawLeads = await db.crmLead.findMany({
    where: { tenantId },
    select: {
      id: true,
      title: true,
      status: true,
      ownerId: true,
      contactEmail: true,
      deletedAt: true,
      owner: { select: { email: true } },
    },
  });
  const leads: LeadSnapshot[] = rawLeads.map(({ owner, ...lead }) => ({ ...lead, ownerEmail: owner.email }));
  const retainedOwnerIds = new Set(users.map(user => user.id));
  const activeLeads = leads.filter(lead => lead.deletedAt === null);
  const candidates = activeLeads.filter(lead => !retainedOwnerIds.has(lead.ownerId));
  const retained = activeLeads.filter(lead => retainedOwnerIds.has(lead.ownerId));
  const retainedByOwner = retained.reduce<Record<string, number>>((counts, lead) => {
    counts[lead.ownerEmail] = (counts[lead.ownerEmail] ?? 0) + 1;
    return counts;
  }, {});

  return {
    report: {
      tenantId,
      allowlistedEmails,
      resolvedOwnerIds: users.map(user => user.id),
      totalRows: leads.length,
      activeRows: activeLeads.length,
      alreadyDeletedRows: leads.length - activeLeads.length,
      retainedActiveRows: retained.length,
      retainedByOwner,
      candidateCount: candidates.length,
      candidateStatusCounts: countBy(candidates.map(candidate => candidate.status)),
      candidates: candidates.map(({ id, title, status, ownerEmail, contactEmail }) => ({ id, title, status, ownerEmail, contactEmail })),
      applied: false,
      archivedCount: 0,
    },
    candidates,
  };
}

export async function applyRetention(
  db: RetentionDb,
  tenantId: string,
  candidates: LeadSnapshot[],
  expectedCandidates: number,
): Promise<number> {
  if (candidates.length !== expectedCandidates) {
    throw new Error(`RETENTION_EXPECTED_COUNT_MISMATCH: expected ${expectedCandidates}, found ${candidates.length}`);
  }
  if (candidates.length === 0) return 0;

  const archivedAt = new Date();
  return db.$transaction(async tx => {
    const result = await tx.crmLead.updateMany({
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
          resourceType: 'CrmLead',
          resourceId: candidate.id,
          oldValues: {
            title: candidate.title,
            status: candidate.status,
            ownerId: candidate.ownerId,
            ownerEmail: candidate.ownerEmail,
            deletedAt: null,
          },
          newValues: {
            deletedAt: archivedAt.toISOString(),
            reason: 'CRM lead retention allowlist archival',
            retainedOwnerEmails: DEFAULT_RETAINED_OWNER_EMAILS,
          },
        },
      });
    }
    return result.count;
  });
}

export async function runRetention(options: {
  db: RetentionDb;
  tenantId: string;
  retainedOwnerEmails?: readonly string[];
  apply?: boolean;
  expectedCandidates?: number;
}): Promise<RetentionReport> {
  const { report, candidates } = await buildRetentionReport(options.db, options.tenantId, options.retainedOwnerEmails);
  if (!options.apply) return report;
  if (options.expectedCandidates === undefined) throw new Error('RETENTION_EXPECTED_COUNT_REQUIRED');

  const archivedCount = await applyRetention(options.db, options.tenantId, candidates, options.expectedCandidates);
  return { ...report, applied: true, archivedCount };
}

function parseArgs(argv: string[]): { tenantId: string; apply: boolean; expectedCandidates?: number } {
  const tenantIndex = argv.indexOf('--tenant');
  const tenantId = tenantIndex >= 0 ? argv[tenantIndex + 1] : undefined;
  if (!tenantId || tenantId.startsWith('--')) throw new Error('Usage: retain-crm-leads.ts --tenant <tenant-id> [--dry-run] [--apply --expected-candidates <count>]');

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
    () => runRetention({ db: prisma as unknown as RetentionDb, ...options }),
  );
  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }).finally(async () => prisma.$disconnect());
}
