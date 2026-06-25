import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';

export type RiskFactorKey = 'APPLICANT' | 'INDUSTRY' | 'PRODUCT' | 'DOCUMENTATION' | 'BEHAVIOUR' | 'FRAUD';
export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'PROHIBITED';

export interface RiskFactorInput {
  factor: RiskFactorKey;
  score: number;        // 0-100, higher is riskier
  reasonCode?: string;
}

export interface RiskFactorResult {
  factor: RiskFactorKey;
  score: number;
  weight: number;
  weightedScore: number;
  reasonCode?: string;
}

export interface RiskEngineResult {
  factorScores: RiskFactorResult[];
  weightedScore: number;
  riskLevel: RiskLevel;
  reasonCodes: string[];
}

// Default factor weights (sum to 100) — used when no RiskFactorMatrix is configured
const DEFAULT_WEIGHTS: Record<RiskFactorKey, number> = {
  APPLICANT: 25,
  INDUSTRY: 15,
  PRODUCT: 15,
  DOCUMENTATION: 15,
  BEHAVIOUR: 15,
  FRAUD: 15,
};

// Risk level thresholds based on the weighted score (0-100, higher = riskier)
const RISK_LEVEL_THRESHOLDS = {
  HIGH: 50,
  MODERATE: 30,
};

/**
 * Get the active factor weights from the RiskFactorMatrix config table,
 * falling back to the hardcoded defaults when none are configured.
 */
export async function getActiveFactorWeights(): Promise<Record<string, number>> {
  const now = new Date();
  const matrices = await prisma.riskFactorMatrix.findMany({
    where: {
      isActive: true,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    select: { factor: true, weight: true },
  });

  if (matrices.length === 0) {
    return { ...DEFAULT_WEIGHTS };
  }

  const weights: Record<string, number> = {};
  for (const m of matrices) {
    weights[m.factor] = Number(m.weight);
  }
  return weights;
}

/**
 * Classify a weighted score (0-100, higher = riskier) into a risk level.
 */
export function classifyRiskLevel(weightedScore: number): RiskLevel {
  if (weightedScore >= RISK_LEVEL_THRESHOLDS.HIGH) return 'HIGH';
  if (weightedScore >= RISK_LEVEL_THRESHOLDS.MODERATE) return 'MODERATE';
  return 'LOW';
}

/**
 * Compute the weighted risk score from per-factor inputs.
 *
 * Each factor provides a 0-100 score (higher = riskier). The engine
 * multiplies by the configured weight and sums to produce a weighted
 * score. The risk level is derived from thresholds. Stricter-factor-wins
 * on reason codes: if any factor has a PROHIBITED-level reason code
 * (score >= 90), the overall level is PROHIBITED.
 */
export function computeWeightedRisk(
  inputs: RiskFactorInput[],
  weights: Record<string, number> = DEFAULT_WEIGHTS,
): RiskEngineResult {
  const factorScores: RiskFactorResult[] = [];
  const reasonCodes: string[] = [];
  let weightedScore = 0;
  let hasProhibited = false;

  for (const input of inputs) {
    const weight = weights[input.factor] ?? 0;
    const weightedContribution = (input.score * weight) / 100;
    weightedScore += weightedContribution;

    if (input.score >= 90) hasProhibited = true;
    if (input.reasonCode) reasonCodes.push(input.reasonCode);

    factorScores.push({
      factor: input.factor,
      score: input.score,
      weight,
      weightedScore: Math.round(weightedContribution * 100) / 100,
      reasonCode: input.reasonCode,
    });
  }

  weightedScore = Math.round(weightedScore * 100) / 100;
  const riskLevel: RiskLevel = hasProhibited ? 'PROHIBITED' : classifyRiskLevel(weightedScore);

  return { factorScores, weightedScore, riskLevel, reasonCodes };
}

/**
 * Persist a risk assessment for an application, storing the factor scores,
 * weighted score, risk level, and reason codes.
 */
export async function saveRiskAssessment(
  applicationId: string,
  riskCategory: string,
  result: RiskEngineResult,
  description?: string,
  mitigation?: string,
) {
  return prisma.riskAssessment.upsert({
    where: {
      applicationId_riskCategory: {
        applicationId,
        riskCategory: riskCategory as any,
      },
    },
    create: {
      applicationId,
      riskCategory: riskCategory as any,
      description,
      mitigation,
      factorScores: result.factorScores as any,
      weightedScore: new Prisma.Decimal(result.weightedScore),
      riskLevel: result.riskLevel,
      reasonCodes: result.reasonCodes.length > 0 ? (result.reasonCodes as any) : Prisma.JsonNull,
    },
    update: {
      description,
      mitigation,
      factorScores: result.factorScores as any,
      weightedScore: new Prisma.Decimal(result.weightedScore),
      riskLevel: result.riskLevel,
      reasonCodes: result.reasonCodes.length > 0 ? (result.reasonCodes as any) : Prisma.JsonNull,
    },
  });
}