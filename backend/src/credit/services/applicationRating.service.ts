import prisma from '../../utils/prisma';
import { RiskRating } from '../types/credit.types';

/**
 * Returns the effective risk rating for an application — the rating of the
 * most recent CreditScoreRun, or 'NR' (Not Rated) if no score run exists.
 *
 * This is the single source of truth for approval-authority lookups. It
 * replaces direct reads of borrowerProfile.creditRiskRating, which can drift
 * from the actual scored rating on the application.
 */
export async function getApplicationEffectiveRating(
  applicationId: string,
): Promise<RiskRating | 'NR'> {
  const latest = await prisma.creditScoreRun.findFirst({
    where: { applicationId },
    orderBy: { runAt: 'desc' },
    select: { riskRating: true },
  });
  return (latest?.riskRating as RiskRating) ?? 'NR';
}

/**
 * Returns the latest score run's runAt timestamp (or null if no run exists).
 */
export async function getLatestScoreRunAt(
  applicationId: string,
): Promise<Date | null> {
  const latest = await prisma.creditScoreRun.findFirst({
    where: { applicationId },
    orderBy: { runAt: 'desc' },
    select: { runAt: true },
  });
  return latest?.runAt ?? null;
}

/**
 * Returns the most recent updatedAt timestamp across the material input
 * sources that drive scoring: financial statements, retail income,
 * qualitative assessment, bureau checklist, verified documents, and the
 * application itself (amount/tenor/product).
 *
 * Used by the committee submission gate to ensure the latest score run is
 * at least as fresh as the most recent material input change.
 */
export async function getLatestMaterialUpdate(
  applicationId: string,
): Promise<Date> {
  const timestamps: Date[] = [];

  // Application itself (amount/tenor/product + general updates)
  const app = await prisma.creditApplication.findUnique({
    where: { id: applicationId },
    select: { updatedAt: true, borrowerProfileId: true },
  });
  if (app?.updatedAt) timestamps.push(app.updatedAt);

  // Financial statements (linked via borrowerProfileId)
  if (app?.borrowerProfileId) {
    const latestFin = await prisma.financialStatement.findFirst({
      where: { borrowerProfileId: app.borrowerProfileId },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });
    if (latestFin?.updatedAt) timestamps.push(latestFin.updatedAt);
  }

  // Retail income
  const retail = await prisma.retailIncome.findUnique({
    where: { applicationId },
    select: { updatedAt: true },
  });
  if (retail?.updatedAt) timestamps.push(retail.updatedAt);

  // Qualitative assessment
  const qa = await prisma.qualitativeAssessment.findUnique({
    where: { applicationId },
    select: { assessedAt: true },
  });
  if (qa?.assessedAt) timestamps.push(qa.assessedAt);

  // Bureau checklist
  const bureau = await prisma.bureauChecklist.findUnique({
    where: { applicationId },
    select: { updatedAt: true },
  });
  if (bureau?.updatedAt) timestamps.push(bureau.updatedAt);

  // Verified documents
  const latestDoc = await prisma.creditDocument.findFirst({
    where: { applicationId, verificationStatus: 'VERIFIED', deletedAt: null },
    orderBy: { verifiedAt: 'desc' },
    select: { verifiedAt: true },
  });
  if (latestDoc?.verifiedAt) timestamps.push(latestDoc.verifiedAt);

  return timestamps.length > 0
    ? timestamps.reduce((max, t) => (t > max ? t : max))
    : new Date(0);
}