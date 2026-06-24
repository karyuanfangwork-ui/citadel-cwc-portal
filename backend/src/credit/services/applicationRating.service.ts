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