// backend/src/services/crm-duplicate.service.ts

import prisma from '../utils/prisma';

const MERGE_FIELD_ALLOWLIST: Record<string, Set<string>> = {
  LEAD: new Set([
    'title',
    'status',
    'source',
    'contactName',
    'contactEmail',
    'contactPhone',
    'companyName',
    'estimatedValue',
    'description',
    'followUpDate',
    'followUpNote',
    'customFields',
  ]),
  CONTACT: new Set([
    'firstName',
    'lastName',
    'email',
    'phone',
    'mobile',
    'jobTitle',
    'department',
    'description',
    'followUpDate',
    'followUpNote',
    'preferredLanguage',
    'marketingOptIn',
    'riskProfile',
    'customFields',
  ]),
};

// ── String similarity (Levenshtein-based, 0.0–1.0) ───────────────────────────

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

export function scoreSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return 1;
  const maxLen = Math.max(la.length, lb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(la, lb) / maxLen;
}

// ── Field comparison ─────────────────────────────────────────────────────────

interface MatchableFields {
  email?: string | null;
  phone?: string | null;
  contactName?: string | null;
  // For contacts
  firstName?: string | null;
  lastName?: string | null;
}

export function buildMatchFields(
  a: MatchableFields,
  b: MatchableFields,
): { confidence: number; matchFields: string[] } {
  const matchFields: string[] = [];
  let confidence = 0;

  // Email exact match — strongest signal
  if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) {
    matchFields.push('email');
    confidence = Math.max(confidence, 0.9);
  }

  // Phone exact match (strip non-digits for comparison)
  const phoneA = (a.phone ?? '').replace(/\D/g, '');
  const phoneB = (b.phone ?? '').replace(/\D/g, '');
  if (phoneA && phoneB && phoneA === phoneB) {
    matchFields.push('phone');
    confidence = Math.max(confidence, 0.7);
  }

  // Name similarity — use contactName for leads, firstName+lastName for contacts
  const nameA = a.contactName ?? [a.firstName, a.lastName].filter(Boolean).join(' ');
  const nameB = b.contactName ?? [b.firstName, b.lastName].filter(Boolean).join(' ');
  if (nameA && nameB) {
    const nameSim = scoreSimilarity(nameA, nameB);
    if (nameSim >= 0.85) {
      matchFields.push('name');
      confidence = Math.max(confidence, nameSim * 0.6); // name alone is weaker signal
    }
  }

  return { confidence, matchFields };
}

// ── Scan for duplicates for a newly created entity ───────────────────────────

export async function checkLeadDuplicates(leadId: string): Promise<void> {
  const lead = await prisma.crmLead.findUnique({ where: { id: leadId } });
  if (!lead) return;

  const candidates = await prisma.crmLead.findMany({
    where: {
      id: { not: leadId },
      deletedAt: null,
      OR: [
        ...(lead.contactEmail ? [{ contactEmail: lead.contactEmail }] : []),
        ...(lead.contactPhone ? [{ contactPhone: lead.contactPhone }] : []),
      ],
    },
    take: 20,
  });

  for (const candidate of candidates) {
    const { confidence, matchFields } = buildMatchFields(
      { email: lead.contactEmail, phone: lead.contactPhone, contactName: lead.contactName },
      { email: candidate.contactEmail, phone: candidate.contactPhone, contactName: candidate.contactName },
    );
    if (confidence < 0.5) continue;

    // Ensure consistent ordering so @@unique([entityAId, entityBId]) doesn't duplicate
    const [aId, bId] = [leadId, candidate.id].sort();

    await prisma.crmDuplicateMatch.upsert({
      where: { entityAId_entityBId: { entityAId: aId, entityBId: bId } },
      update: { confidence, matchFields, status: 'OPEN' },
      create: { entityType: 'LEAD', entityAId: aId, entityBId: bId, confidence, matchFields },
    });
  }
}

export async function checkContactDuplicates(contactId: string): Promise<void> {
  const contact = await prisma.crmContact.findUnique({ where: { id: contactId } });
  if (!contact) return;

  const candidates = await prisma.crmContact.findMany({
    where: {
      id: { not: contactId },
      deletedAt: null,
      OR: [
        ...(contact.email ? [{ email: contact.email }] : []),
        ...(contact.phone ? [{ phone: contact.phone }] : []),
        ...(contact.mobile ? [{ mobile: contact.mobile }] : []),
      ],
    },
    take: 20,
  });

  for (const candidate of candidates) {
    const { confidence, matchFields } = buildMatchFields(
      { email: contact.email, phone: contact.phone ?? contact.mobile, firstName: contact.firstName, lastName: contact.lastName },
      { email: candidate.email, phone: candidate.phone ?? candidate.mobile, firstName: candidate.firstName, lastName: candidate.lastName },
    );
    if (confidence < 0.5) continue;

    const [aId, bId] = [contactId, candidate.id].sort();

    await prisma.crmDuplicateMatch.upsert({
      where: { entityAId_entityBId: { entityAId: aId, entityBId: bId } },
      update: { confidence, matchFields, status: 'OPEN' },
      create: { entityType: 'CONTACT', entityAId: aId, entityBId: bId, confidence, matchFields },
    });
  }
}

// ── List duplicates ──────────────────────────────────────────────────────────

export async function listDuplicates(entityType?: string, status?: string) {
  return prisma.crmDuplicateMatch.findMany({
    where: {
      ...(entityType ? { entityType } : {}),
      ...(status ? { status } : { status: 'OPEN' }),
    },
    orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function getDuplicateMatch(matchId: string) {
  return prisma.crmDuplicateMatch.findUnique({ where: { id: matchId } });
}

export function sanitizeMergeFieldSelections(entityType: string, fieldSelections: Record<string, unknown>): Record<string, unknown> {
  const allowlist = MERGE_FIELD_ALLOWLIST[entityType.toUpperCase()];
  if (!allowlist) throw new Error('Unsupported duplicate entity type');

  const rejectedFields = Object.keys(fieldSelections).filter((field) => !allowlist.has(field));
  if (rejectedFields.length > 0) {
    throw new Error(`Unsupported merge field selections: ${rejectedFields.join(', ')}`);
  }

  return Object.fromEntries(Object.entries(fieldSelections).filter(([, value]) => value !== undefined));
}

// ── Merge: promote entityAId as master, re-point all refs from entityB ────────

export async function mergeDuplicates(
  matchId: string,
  masterEntityId: string,
  fieldSelections: Record<string, unknown>,
  resolvedByUserId: string,
): Promise<void> {
  const match = await prisma.crmDuplicateMatch.findUnique({ where: { id: matchId } });
  if (!match || match.status !== 'OPEN') throw new Error('Duplicate match not found or already resolved');
  if (![match.entityAId, match.entityBId].includes(masterEntityId)) {
    throw new Error('masterEntityId must belong to the duplicate match');
  }

  const losingId = match.entityAId === masterEntityId ? match.entityBId : match.entityAId;
  const safeFieldSelections = sanitizeMergeFieldSelections(match.entityType, fieldSelections);

  await prisma.$transaction(async (tx) => {
    if (match.entityType === 'LEAD') {
      // Re-point activities, notes, opportunities to master
      await tx.crmActivity.updateMany({ where: { leadId: losingId }, data: { leadId: masterEntityId } });
      await tx.crmNote.updateMany({ where: { leadId: losingId }, data: { leadId: masterEntityId } });
      // Apply field selections to master
      if (Object.keys(safeFieldSelections).length > 0) {
        await tx.crmLead.update({ where: { id: masterEntityId }, data: safeFieldSelections as any });
      }
      // Soft-delete loser
      await tx.crmLead.update({ where: { id: losingId }, data: { deletedAt: new Date() } });
    } else if (match.entityType === 'CONTACT') {
      await tx.crmActivity.updateMany({ where: { contactId: losingId }, data: { contactId: masterEntityId } });
      await tx.crmNote.updateMany({ where: { contactId: losingId }, data: { contactId: masterEntityId } });
      await tx.crmLead.updateMany({ where: { contactId: losingId }, data: { contactId: masterEntityId } });
      await tx.crmOpportunity.updateMany({ where: { contactId: losingId }, data: { contactId: masterEntityId } });
      if (Object.keys(safeFieldSelections).length > 0) {
        await tx.crmContact.update({ where: { id: masterEntityId }, data: safeFieldSelections as any });
      }
      await tx.crmContact.update({ where: { id: losingId }, data: { deletedAt: new Date() } });
    }

    // Mark match resolved
    await tx.crmDuplicateMatch.update({
      where: { id: matchId },
      data: { status: 'MERGED', resolvedBy: resolvedByUserId, resolvedAt: new Date() },
    });
  });
}

export async function dismissDuplicate(matchId: string, resolvedByUserId: string): Promise<void> {
  await prisma.crmDuplicateMatch.update({
    where: { id: matchId },
    data: { status: 'DISMISSED', resolvedBy: resolvedByUserId, resolvedAt: new Date() },
  });
}
