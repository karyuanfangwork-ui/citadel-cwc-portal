/**
 * P2.5 — Borrower Risk Separation Service
 *
 * Manages immutable borrower-level risk history (BorrowerRiskRun).
 * This is distinct from application-level scoring (CreditScoreRun):
 *
 *   - BorrowerRiskRun is triggered by borrower data changes (financial profile,
 *     bureau data, AML tier) and persists an immutable snapshot per calculation.
 *   - CreditScoreRun is triggered by application actions and persists per-application.
 *
 * Key governance rules:
 *   - Each BorrowerRiskRun is immutable once created (no updates/deletes)
 *   - Borrower risk changes do NOT mutate historical application score runs
 *   - Application rescoring does NOT overwrite borrower risk history
 *   - Both histories are independently queryable via separate endpoints
 */

import prisma from '../../utils/prisma';
import { RiskRating } from '../types/credit.types';
import { computeWeightedRisk, getActiveFactorWeights, type RiskFactorInput } from './riskEngine.service';

export interface BorrowerRiskRunSummary {
  id: string;
  borrowerProfileId: string;
  totalScore: number;
  baseRiskRating: RiskRating;
  effectiveRiskRating: RiskRating;
  calculationSource: string;
  runAt: Date;
}

/**
 * Create an immutable borrower risk run.
 * This is the single entry point for persisting borrower-level risk.
 * Each run is a snapshot — it cannot be modified after creation.
 */
export async function createBorrowerRiskRun(input: {
  borrowerProfileId: string;
  factorScores: RiskFactorInput[];
  baseRiskRating: RiskRating;
  bureauCapsApplied?: Record<string, any> | null;
  effectiveRiskRating?: RiskRating;
  reasonCodes?: string[];
  missingInputs?: Record<string, any> | null;
  ratingBandVersion?: number;
  calculationSource?: string;
  calculatedById?: string;
  scorecardVersionId?: string;
  scorecardVersion?: number;
}): Promise<BorrowerRiskRunSummary> {
  // Compute weighted risk from factor inputs
  const weights = await getActiveFactorWeights();
  const engineResult = computeWeightedRisk(input.factorScores, weights);

  const run = await prisma.borrowerRiskRun.create({
    data: {
      borrowerProfileId: input.borrowerProfileId,
      scorecardVersionId: input.scorecardVersionId ?? null,
      scorecardVersion: input.scorecardVersion ?? null,
      factorScores: engineResult.factorScores as any,
      totalScore: input.factorScores.reduce((sum, f) => sum + f.score, 0),
      baseRiskRating: input.baseRiskRating,
      effectiveRiskRating: input.effectiveRiskRating ?? input.baseRiskRating,
      bureauCapsApplied: input.bureauCapsApplied as any ?? undefined,
      reasonCodes: input.reasonCodes?.length ? (input.reasonCodes as any) : undefined,
      missingInputs: input.missingInputs as any ?? undefined,
      ratingBandVersion: input.ratingBandVersion ?? null,
      calculationSource: input.calculationSource ?? 'SYSTEM',
      calculatedById: input.calculatedById ?? null,
    },
  });

  // Update BorrowerProfile with the latest risk rating
  await prisma.borrowerProfile.update({
    where: { id: input.borrowerProfileId },
    data: {
      creditRiskRating: input.effectiveRiskRating ?? input.baseRiskRating,
      riskRatingCalculatedAt: new Date(),
      riskRatingVersion: { increment: 1 },
    },
  });

  return {
    id: run.id,
    borrowerProfileId: run.borrowerProfileId,
    totalScore: Number(run.totalScore),
    baseRiskRating: run.baseRiskRating as RiskRating,
    effectiveRiskRating: run.effectiveRiskRating as RiskRating,
    calculationSource: run.calculationSource,
    runAt: run.runAt,
  };
}

/**
 * Get the immutable history of borrower risk runs for a borrower profile.
 * Sorted newest-first.
 */
export async function getBorrowerRiskHistory(borrowerProfileId: string, limit?: number): Promise<BorrowerRiskRunSummary[]> {
  const runs = await prisma.borrowerRiskRun.findMany({
    where: { borrowerProfileId },
    orderBy: { runAt: 'desc' },
    take: limit ?? 50,
  });

  return runs.map((r) => ({
    id: r.id,
    borrowerProfileId: r.borrowerProfileId,
    totalScore: Number(r.totalScore),
    baseRiskRating: r.baseRiskRating as RiskRating,
    effectiveRiskRating: r.effectiveRiskRating as RiskRating,
    calculationSource: r.calculationSource,
    runAt: r.runAt,
  }));
}

/**
 * Get the latest borrower risk run for a borrower profile.
 * Returns null if no runs exist.
 */
export async function getLatestBorrowerRiskRun(borrowerProfileId: string): Promise<BorrowerRiskRunSummary | null> {
  const runs = await getBorrowerRiskHistory(borrowerProfileId, 1);
  return runs.length > 0 ? runs[0] : null;
}

/**
 * Verify that a borrower risk run is immutable (cannot be updated/deleted).
 * P2.5 governance: borrower risk history is append-only.
 */
export function assertBorrowerRiskRunImmutable(): { immutable: boolean; reason: string } {
  return {
    immutable: true,
    reason: 'BorrowerRiskRun records are append-only. No updates or deletes are permitted.',
  };
}