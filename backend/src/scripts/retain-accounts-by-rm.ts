import '../config';
import prisma from '../utils/prisma';
import { runWithExecutionScope } from '../lib/execution-scope';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const SYSTEM_EMAIL = 'system:crm-account-rm-retention';

export const RETAINED_ACCOUNT_OWNER_EMAILS = [
  'thasha.shaharis@citadelgroup.com.my',
  'rohani.munir@citadelgroup.com.my',
  'cristel.erguiza@citadelgroup.com.my',
] as const;

export function isRetainedAccountOwner(email: string): boolean {
  return RETAINED_ACCOUNT_OWNER_EMAILS.includes(email as (typeof RETAINED_ACCOUNT_OWNER_EMAILS)[number]);
}

export async function runAccountRetention(options: {
  tenantId: string;
  apply: boolean;
  expectedVisible?: number;
  expectedCandidates?: number;
}) {
  return runWithExecutionScope({ kind: 'tenant', tenantId: options.tenantId }, async () => {
    const accounts = await prisma.crmAccount.findMany({
      where: { tenantId: options.tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        isActive: true,
        owner: { select: { email: true } },
        _count: { select: { contacts: true, leads: true, opportunities: true, activities: true, notes: true } },
      },
      orderBy: { name: 'asc' },
    });
    const expectedVisible = options.expectedVisible ?? 33;
    const expectedCandidates = options.expectedCandidates ?? 22;
    const candidates = accounts.filter(account => !isRetainedAccountOwner(account.owner.email));

    if (accounts.length !== expectedVisible || candidates.length !== expectedCandidates) {
      throw new Error(`Guard failed: found ${accounts.length} visible accounts and ${candidates.length} archive candidates; expected ${expectedVisible} and ${expectedCandidates}`);
    }

    const plan = candidates.map(account => ({
      id: account.id,
      name: account.name,
      owner: account.owner.email,
      isActive: account.isActive,
      downstream: account._count,
    }));

    if (!options.apply) {
      return { mode: 'dry-run', visibleAccounts: accounts.length, retainedAccounts: accounts.length - candidates.length, archiveCandidates: candidates.length, plan };
    }

    return prisma.$transaction(async tx => {
      for (const account of candidates) {
        await tx.crmAccount.update({
          where: { id: account.id },
          data: { isActive: false, deletedAt: new Date() },
        });
        await tx.auditLog.create({
          data: {
            tenantId: options.tenantId,
            userEmail: SYSTEM_EMAIL,
            action: 'DELETE',
            resourceType: 'CrmAccount',
            resourceId: account.id,
            oldValues: { name: account.name, owner: account.owner.email, isActive: account.isActive },
            newValues: { deletedAt: 'now', reason: 'rm-allowlist-account-retention' },
          },
        });
      }
      return { mode: 'apply', visibleAccounts: accounts.length, retainedAccounts: accounts.length - candidates.length, archivedAccounts: candidates.length };
    }, { timeout: 120000 });
  });
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const tenantArg = process.argv.find(arg => arg.startsWith('--tenant='));
  const tenantId = tenantArg?.split('=')[1] ?? DEFAULT_TENANT_ID;
  const expectedVisible = Number(process.argv.find(arg => arg.startsWith('--expected-visible='))?.split('=')[1] ?? 33);
  const expectedCandidates = Number(process.argv.find(arg => arg.startsWith('--expected-candidates='))?.split('=')[1] ?? 22);
  const result = await runAccountRetention({ tenantId, apply: args.has('--apply'), expectedVisible, expectedCandidates });
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
