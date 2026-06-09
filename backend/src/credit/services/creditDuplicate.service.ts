import prisma from '../../utils/prisma';

export interface DuplicateMatch {
  borrowerProfileId: string;
  borrowerName: string;
  matchFields: string[];
  confidence: number;
  existingApplicationCount: number;
}

export interface DuplicateCheckResult {
  checkedProfileId: string;
  matches: DuplicateMatch[];
  checkedAt: Date;
}

export async function findDuplicateBorrowers(borrowerProfileId: string): Promise<DuplicateCheckResult> {
  const target = await prisma.borrowerProfile.findUniqueOrThrow({
    where: { id: borrowerProfileId },
    include: {
      account: { select: { name: true, registrationNumber: true } },
      directors: { select: { nricPassportHmac: true } },
    },
  });

  const others = await prisma.borrowerProfile.findMany({
    where: { id: { not: borrowerProfileId }, isActive: true, deletedAt: null },
    include: {
      account: { select: { id: true, name: true, registrationNumber: true } },
      directors: { select: { nricPassportHmac: true } },
      applications: { select: { id: true } },
    },
  });

  const targetName = (target.name ?? target.account?.name ?? '').toLowerCase().trim();
  const targetRegNo = target.account?.registrationNumber?.replace(/\W/g, '').toUpperCase() ?? null;
  const targetDirectorHmacs = new Set(target.directors.map((d) => d.nricPassportHmac).filter(Boolean));

  const matches: DuplicateMatch[] = [];

  for (const other of others) {
    const matchFields: string[] = [];
    let confidence = 0;

    const otherName = (other.name ?? other.account?.name ?? '').toLowerCase().trim();
    if (targetName && otherName && targetName === otherName) {
      matchFields.push('name');
      confidence += 0.6;
    }

    const otherRegNo = other.account?.registrationNumber?.replace(/\W/g, '').toUpperCase() ?? null;
    if (targetRegNo && otherRegNo && targetRegNo === otherRegNo) {
      matchFields.push('registrationNumber');
      confidence += 0.9;
    }

    const otherDirectorHmacs = other.directors.map((d) => d.nricPassportHmac).filter(Boolean);
    const sharedDirectors = otherDirectorHmacs.filter((h) => h && targetDirectorHmacs.has(h));
    if (sharedDirectors.length > 0) {
      matchFields.push(`sharedDirectors(${sharedDirectors.length})`);
      confidence += 0.5 * sharedDirectors.length;
    }

    if (matchFields.length === 0) continue;
    confidence = Math.min(confidence, 1.0);

    // Persist match record (mirrors CrmDuplicateMatch pattern)
    await prisma.crmDuplicateMatch.upsert({
      where: { entityAId_entityBId: { entityAId: borrowerProfileId, entityBId: other.id } },
      update: { matchFields, confidence, status: 'OPEN' },
      create: {
        entityType: 'BORROWER',
        entityAId: borrowerProfileId,
        entityBId: other.id,
        matchFields,
        confidence,
        status: 'OPEN',
      },
    });

    matches.push({
      borrowerProfileId: other.id,
      borrowerName: other.name ?? other.account?.name ?? 'Unknown',
      matchFields,
      confidence,
      existingApplicationCount: other.applications.length,
    });
  }

  return { checkedProfileId: borrowerProfileId, matches, checkedAt: new Date() };
}

/** Convenience: look up duplicates starting from an application ID */
export async function findDuplicatesByApp(applicationId: string): Promise<DuplicateCheckResult> {
  const app = await prisma.creditApplication.findUniqueOrThrow({
    where: { id: applicationId },
    select: { borrowerProfileId: true },
  });
  return findDuplicateBorrowers(app.borrowerProfileId);
}