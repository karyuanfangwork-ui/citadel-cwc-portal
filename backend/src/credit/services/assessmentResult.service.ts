import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';
import { recommendDecision, DecisionInput } from './decisionEngine.service';

/**
 * Freeze an ApplicationAssessmentResult at committee submission.
 *
 * Captures the latest score run, decision recommendation, reason codes,
 * missing inputs, and config versions into an immutable record. Later input
 * changes do not mutate a frozen record — a new assessment requires a new
 * record (which supersedes the prior one).
 */
export async function freezeAssessmentResult(
  applicationId: string,
  actorId: string,
): Promise<{ id: string; status: string; version: number }> {
  // Get the latest score run
  const latestRun = await prisma.creditScoreRun.findFirst({
    where: { applicationId },
    orderBy: { runAt: 'desc' },
    select: {
      id: true,
      riskRating: true,
      baseRiskRating: true,
      totalScore: true,
      missingInputs: true,
      bureauCapsApplied: true,
      inputSnapshot: true,
      ratingBandVersion: true,
      calculationSource: true,
    },
  });

  if (!latestRun) {
    throw new Error('Cannot freeze assessment — no score run exists for this application.');
  }

  // Determine AML/fraud flags from the bureau checklist (simplified — checks
  // for adverse findings or AML screening blocks)
  const bureauChecklist = await prisma.bureauChecklist.findUnique({
    where: { applicationId },
    select: { noAdverseRecord: true, amlScreeningDone: true },
  });
  const amlBlocked = bureauChecklist
    ? !bureauChecklist.noAdverseRecord && bureauChecklist.amlScreeningDone
    : false;
  const fraudFlags: string[] = [];
  if (bureauChecklist && !bureauChecklist.noAdverseRecord) {
    fraudFlags.push('ADVERSE_FINDING');
  }

  // Build the decision recommendation
  const decisionInput: DecisionInput = {
    score: Number(latestRun.totalScore),
    rating: (latestRun.riskRating as string) ?? 'NR',
    amlBlocked,
    fraudFlags,
    missingInputs: latestRun.missingInputs as any[],
  };
  const recommendation = recommendDecision(decisionInput);

  // Determine risk category from the rating
  const rating = (latestRun.riskRating as string) ?? 'NR';
  const riskCategory = deriveRiskCategory(rating);

  // LOS-009 / GAP-P1-06 — supersede and create must commit or roll back together.
  const result = await prisma.$transaction(async (tx) => {
    const priorResults = await tx.applicationAssessmentResult.findMany({
      where: { applicationId, status: 'FROZEN' },
      select: { id: true, version: true },
    });
    const nextVersion = priorResults.length > 0
      ? Math.max(...priorResults.map((r) => r.version)) + 1
      : 1;

    if (priorResults.length > 0) {
      await tx.applicationAssessmentResult.updateMany({
        where: { id: { in: priorResults.map((r) => r.id) } },
        data: { status: 'SUPERSEDED' },
      });
    }

    return tx.applicationAssessmentResult.create({
      data: {
        applicationId,
        scoreRunId: latestRun.id,
        finalRiskRating: latestRun.riskRating as string,
        riskCategory,
        decisionRecommendation: recommendation.recommendation,
        reasonCodes: recommendation.reasonCodes.length > 0
          ? (recommendation.reasonCodes as any)
          : Prisma.JsonNull,
        missingInputs: latestRun.missingInputs ?? Prisma.JsonNull,
        modelVersion: latestRun.calculationSource ?? 'MANUAL',
        policyVersion: null,
        ratingBandVersion: latestRun.ratingBandVersion,
        totalScore: latestRun.totalScore,
        status: 'FROZEN',
        version: nextVersion,
        createdById: actorId,
      },
    });
  });

  return { id: result.id, status: result.status, version: result.version };
}

/**
 * Derive a risk category from the risk rating.
 */
function deriveRiskCategory(rating: string): string {
  if (['AAA', 'AA', 'A'].includes(rating)) return 'LOW';
  if (['BBB', 'BB', 'B'].includes(rating)) return 'MODERATE';
  if (['CCC', 'CC', 'C'].includes(rating)) return 'HIGH';
  if (rating === 'D') return 'PROHIBITED';
  return 'MODERATE';
}

/**
 * Get the latest (non-superseded) assessment result for an application.
 */
export async function getLatestAssessmentResult(applicationId: string) {
  return prisma.applicationAssessmentResult.findFirst({
    where: { applicationId, status: 'FROZEN' },
    orderBy: { version: 'desc' },
    include: {
      scoreRun: { select: { id: true, riskRating: true, totalScore: true, runAt: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
}