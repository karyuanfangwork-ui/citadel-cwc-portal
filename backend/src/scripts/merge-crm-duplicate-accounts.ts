import '../config';
import prisma from '../utils/prisma';
import { runWithExecutionScope } from '../lib/execution-scope';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const COHORT_START = new Date('2026-06-16T06:15:00.000Z');
const COHORT_END = new Date('2026-06-16T06:17:00.000Z');
const SYSTEM_EMAIL = 'system:crm-duplicate-merge';

export type MergeOptions = {
  tenantId: string;
  apply: boolean;
  expectedAccounts?: number;
  expectedGroups?: number;
};

type AccountRow = Awaited<ReturnType<typeof loadAccounts>>[number];
type ContactRow = Awaited<ReturnType<typeof loadContacts>>[number];

export function identityKey(value: { email: string | null; phone: string | null; firstName: string; lastName: string }): string {
  const normalize = (input: string) => input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (value.email?.trim()) return `email:${normalize(value.email)}`;
  if (value.phone?.trim()) return `phone:${normalize(value.phone)}`;
  return `name:${normalize(`${value.firstName}${value.lastName}`)}`;
}

function accountScore(account: AccountRow): number {
  return Object.values(account._count).reduce((total, count) => total + count, 0);
}

async function loadAccounts(client: typeof prisma, tenantId: string) {
  return client.crmAccount.findMany({
    where: { tenantId, deletedAt: null, createdAt: { gte: COHORT_START, lt: COHORT_END } },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      owner: { select: { email: true } },
      _count: { select: { contacts: true, leads: true, opportunities: true, activities: true, notes: true, linkedRequests: true, trustProducts: true, contactAccountRoles: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

async function loadContacts(client: typeof prisma, accountIds: string[]) {
  return client.crmContact.findMany({
    where: { accountId: { in: accountIds }, deletedAt: null },
    select: {
      id: true,
      accountId: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      _count: { select: { leads: true, opportunities: true, activities: true, notes: true, beneficiaries: true, trustProducts: true, directors: true, shareholders: true, contactRoles: true } },
      kycRecord: { select: { id: true } },
      borrowerProfile: { select: { id: true } },
    },
  });
}

export function buildGroups(accounts: AccountRow[]) {
  const groups = new Map<string, AccountRow[]>();
  for (const account of accounts) {
    const key = account.name.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), account]);
  }
  return [...groups.values()].filter(group => group.length > 1);
}

export function chooseCanonical(group: AccountRow[]): AccountRow {
  return [...group].sort((a, b) => accountScore(b) - accountScore(a) || b.createdAt.getTime() - a.createdAt.getTime())[0];
}

function contactSpecialCount(contact: ContactRow): number {
  return Object.values(contact._count).reduce((total, count) => total + count, 0) + (contact.kycRecord ? 1 : 0) + (contact.borrowerProfile ? 1 : 0);
}

async function mergeContact(client: any, tenantId: string, duplicate: ContactRow, canonical: ContactRow): Promise<void> {
  if (contactSpecialCount(duplicate) > 0 && contactSpecialCount(canonical) > 0) {
    throw new Error(`Contact merge conflict: ${duplicate.id} and ${canonical.id} both have downstream records`);
  }

  await client.crmLead.updateMany({ where: { contactId: duplicate.id }, data: { contactId: canonical.id } });
  await client.crmOpportunity.updateMany({ where: { contactId: duplicate.id }, data: { contactId: canonical.id } });
  await client.crmActivity.updateMany({ where: { contactId: duplicate.id }, data: { contactId: canonical.id } });
  await client.crmNote.updateMany({ where: { contactId: duplicate.id }, data: { contactId: canonical.id } });

  if (contactSpecialCount(duplicate) > 0) {
    await client.crmBeneficiary.updateMany({ where: { contactId: duplicate.id }, data: { contactId: canonical.id } });
    await client.crmTrustProduct.updateMany({ where: { contactId: duplicate.id }, data: { contactId: canonical.id } });
    await client.director.updateMany({ where: { contactId: duplicate.id }, data: { contactId: canonical.id } });
    await client.shareholder.updateMany({ where: { contactId: duplicate.id }, data: { contactId: canonical.id } });
    await client.crmKycRecord.updateMany({ where: { contactId: duplicate.id }, data: { contactId: canonical.id } });
    await client.borrowerProfile.updateMany({ where: { contactId: duplicate.id }, data: { contactId: canonical.id } });
  }

  await client.crmContactAccountRole.deleteMany({ where: { contactId: duplicate.id } });
  await client.crmContact.update({ where: { id: duplicate.id }, data: { isActive: false, deletedAt: new Date() } });
  await client.auditLog.create({
    data: {
      tenantId,
      userEmail: SYSTEM_EMAIL,
      action: 'MERGE_ARCHIVE',
      resourceType: 'CrmContact',
      resourceId: duplicate.id,
      oldValues: { canonicalContactId: canonical.id, accountId: duplicate.accountId },
      newValues: { deletedAt: 'now', reason: 'duplicate-account-merge' },
    },
  });
}

async function mergeGroup(client: any, tenantId: string, group: AccountRow[]): Promise<{ canonicalId: string; archivedAccountIds: string[]; archivedContactIds: string[] }> {
  const canonical = chooseCanonical(group);
  const duplicates = group.filter(account => account.id !== canonical.id);
  const allIds = group.map(account => account.id);
  const contacts = await loadContacts(client, allIds);
  const canonicalContacts = contacts.filter(contact => contact.accountId === canonical.id);
  const duplicateContacts = contacts.filter(contact => contact.accountId !== canonical.id);
  const contactByIdentity = new Map(canonicalContacts.map(contact => [identityKey(contact), contact]));
  const archivedContactIds: string[] = [];

  for (const contact of duplicateContacts) {
    const existing = contactByIdentity.get(identityKey(contact));
    if (existing) {
      await mergeContact(client, tenantId, contact, existing);
      archivedContactIds.push(contact.id);
    } else {
      await client.crmContact.update({ where: { id: contact.id }, data: { accountId: canonical.id } });
      contactByIdentity.set(identityKey(contact), contact);
    }
  }

  for (const duplicate of duplicates) {
    await client.crmContactAccountRole.updateMany({ where: { accountId: duplicate.id }, data: { accountId: canonical.id } });
    await client.crmLead.updateMany({ where: { accountId: duplicate.id }, data: { accountId: canonical.id } });
    await client.crmOpportunity.updateMany({ where: { accountId: duplicate.id }, data: { accountId: canonical.id } });
    await client.crmActivity.updateMany({ where: { accountId: duplicate.id }, data: { accountId: canonical.id } });
    await client.crmNote.updateMany({ where: { accountId: duplicate.id }, data: { accountId: canonical.id } });
    await client.crmAccountRequest.updateMany({ where: { accountId: duplicate.id }, data: { accountId: canonical.id } });
    await client.crmTrustProduct.updateMany({ where: { accountId: duplicate.id }, data: { accountId: canonical.id } });
    await client.borrowerProfile.updateMany({ where: { accountId: duplicate.id }, data: { accountId: canonical.id } });
    await client.crmAccount.updateMany({ where: { parentAccountId: duplicate.id }, data: { parentAccountId: canonical.id } });
    await client.crmAccount.update({ where: { id: duplicate.id }, data: { isActive: false, deletedAt: new Date() } });
    await client.auditLog.create({
      data: {
        tenantId,
        userEmail: SYSTEM_EMAIL,
        action: 'MERGE_ARCHIVE',
        resourceType: 'CrmAccount',
        resourceId: duplicate.id,
        oldValues: { canonicalAccountId: canonical.id, name: duplicate.name },
        newValues: { deletedAt: 'now', reason: 'duplicate-account-merge' },
      },
    });
  }

  return { canonicalId: canonical.id, archivedAccountIds: duplicates.map(account => account.id), archivedContactIds };
}

export async function runMerge(options: MergeOptions): Promise<unknown> {
  return runWithExecutionScope({ kind: 'tenant', tenantId: options.tenantId }, async () => {
    const accounts = await loadAccounts(prisma, options.tenantId);
    const groups = buildGroups(accounts);
    const expectedAccounts = options.expectedAccounts ?? 24;
    const expectedGroups = options.expectedGroups ?? 12;

    if (accounts.length !== expectedAccounts || groups.length !== expectedGroups || groups.some(group => group.length !== 2)) {
      throw new Error(`Guard failed: found ${accounts.length} cohort accounts and ${groups.length} duplicate groups; expected ${expectedAccounts} accounts and ${expectedGroups} pairs`);
    }

    const plan = groups.map(group => {
      const canonical = chooseCanonical(group);
      return { name: group[0].name, canonicalId: canonical.id, canonicalCreatedAt: canonical.createdAt, archiveIds: group.filter(account => account.id !== canonical.id).map(account => account.id) };
    });

    if (!options.apply) return { mode: 'dry-run', cohortAccounts: accounts.length, duplicateGroups: groups.length, plan };

    return prisma.$transaction(async tx => {
      const results = [];
      for (const group of groups) results.push(await mergeGroup(tx, options.tenantId, group));
      return { mode: 'apply', cohortAccounts: accounts.length, duplicateGroups: groups.length, results };
    }, { timeout: 120000 });
  });
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const tenantArg = process.argv.find(arg => arg.startsWith('--tenant='));
  const tenantId = tenantArg?.split('=')[1] ?? DEFAULT_TENANT_ID;
  const result = await runMerge({ tenantId, apply: args.has('--apply'), expectedAccounts: Number(process.argv.find(arg => arg.startsWith('--expected-accounts='))?.split('=')[1] ?? 24), expectedGroups: Number(process.argv.find(arg => arg.startsWith('--expected-groups='))?.split('=')[1] ?? 12) });
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
