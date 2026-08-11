import '../config';
import prisma from '../utils/prisma';
import { runWithExecutionScope } from '../lib/execution-scope';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const SYSTEM_EMAIL = 'system:crm-contact-retention';

export const RETAINED_OWNER_EMAILS = [
  'thasha.shaharis@citadelgroup.com.my',
  'rohani.munir@citadelgroup.com.my',
  'cristel.erguiza@citadelgroup.com.my',
] as const;

export function isRetainedOwner(email: string): boolean {
  return RETAINED_OWNER_EMAILS.includes(email as (typeof RETAINED_OWNER_EMAILS)[number]);
}

export async function runContactRetention(options: {
  tenantId: string;
  apply: boolean;
  expectedActive?: number;
  expectedCandidates?: number;
}) {
  return runWithExecutionScope({ kind: 'tenant', tenantId: options.tenantId }, async () => {
    const contacts = await prisma.crmContact.findMany({
      where: { tenantId: options.tenantId, deletedAt: null, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        account: { select: { name: true, owner: { select: { email: true } } } },
        _count: { select: { leads: true, opportunities: true, activities: true, notes: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const expectedActive = options.expectedActive ?? 22;
    const expectedCandidates = options.expectedCandidates ?? 22;
    const candidates = contacts.filter(contact => !isRetainedOwner(contact.account.owner.email));

    if (contacts.length !== expectedActive || candidates.length !== expectedCandidates) {
      throw new Error(`Guard failed: found ${contacts.length} active contacts and ${candidates.length} archive candidates; expected ${expectedActive} and ${expectedCandidates}`);
    }

    const plan = candidates.map(contact => ({
      id: contact.id,
      name: `${contact.firstName} ${contact.lastName}`.trim(),
      email: contact.email,
      account: contact.account.name,
      owner: contact.account.owner.email,
      downstream: contact._count,
    }));

    if (!options.apply) {
      return { mode: 'dry-run', activeContacts: contacts.length, retainedContacts: contacts.length - candidates.length, archiveCandidates: candidates.length, plan };
    }

    return prisma.$transaction(async tx => {
      for (const contact of candidates) {
        await tx.crmContact.update({
          where: { id: contact.id },
          data: { isActive: false, deletedAt: new Date() },
        });
        await tx.auditLog.create({
          data: {
            tenantId: options.tenantId,
            userEmail: SYSTEM_EMAIL,
            action: 'DELETE',
            resourceType: 'CrmContact',
            resourceId: contact.id,
            oldValues: { account: contact.account.name, owner: contact.account.owner.email },
            newValues: { deletedAt: 'now', reason: 'owner-allowlist-contact-retention' },
          },
        });
      }
      return { mode: 'apply', activeContacts: contacts.length, retainedContacts: contacts.length - candidates.length, archivedContacts: candidates.length };
    }, { timeout: 120000 });
  });
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const tenantArg = process.argv.find(arg => arg.startsWith('--tenant='));
  const tenantId = tenantArg?.split('=')[1] ?? DEFAULT_TENANT_ID;
  const expectedActive = Number(process.argv.find(arg => arg.startsWith('--expected-active='))?.split('=')[1] ?? 22);
  const expectedCandidates = Number(process.argv.find(arg => arg.startsWith('--expected-candidates='))?.split('=')[1] ?? 22);
  const result = await runContactRetention({ tenantId, apply: args.has('--apply'), expectedActive, expectedCandidates });
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
