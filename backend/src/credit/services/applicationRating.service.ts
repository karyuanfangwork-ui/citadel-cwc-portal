import prisma from '../../utils/prisma';
import { RiskRating } from '@prisma/client';

/**
 * Persist the canonical denormalised application-level risk rating.
 *
 * CreditScoreRun remains the immutable/provenance record. CreditApplication.riskRating
 * is a read-optimised source of truth for dashboards, authority lookups, and detail DTOs.
 */
export async function persistApplicationRiskRating(
  applicationId: string,
  riskRating: RiskRating,
  riskRatingUpdatedAt: Date = new Date(),
): Promise<void> {
  await prisma.creditApplication.update({
    where: { id: applicationId },
    data: {
      riskRating,
      riskRatingUpdatedAt,
    },
  });
}

/**
 * Backfill/sync the application-level rating from the latest CreditScoreRun.
 * Returns the resolved rating or null when the application has never been scored.
 */
export async function syncApplicationRiskRatingFromLatestScoreRun(
  applicationId: string,
): Promise<RiskRating | null> {
  const latest = await prisma.creditScoreRun.findFirst({
    where: { applicationId },
    orderBy: [{ runAt: 'desc' }, { createdAt: 'desc' }],
    select: { riskRating: true, runAt: true },
  });

  if (!latest) return null;

  await persistApplicationRiskRating(applicationId, latest.riskRating, latest.runAt);
  return latest.riskRating;
}

/**
 * Returns the effective risk rating for an application.
 *
 * Prefer the canonical denormalised CreditApplication.riskRating. For older records
 * that have score runs but have not been backfilled yet, fall back to the latest
 * score run, opportunistically sync the application field, and return that rating.
 */
export async function getApplicationEffectiveRating(
  applicationId: string,
): Promise<RiskRating | 'NR'> {
  const app = await prisma.creditApplication.findUnique({
    where: { id: applicationId },
    select: { riskRating: true },
  });

  if (app?.riskRating) return app.riskRating;

  const synced = await syncApplicationRiskRatingFromLatestScoreRun(applicationId);
  return synced ?? 'NR';
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
