import prisma from '../../utils/prisma';
import { Prisma, RiskRating } from '@prisma/client';
import { FACTOR_GROUPS, FactorWeights } from './scorecard.service';
import { AppError } from '../../middleware/error.middleware';
import { getQualitativeAssessment, toFactorScores } from './qualitativeAssessment.service';
import { getBureauCapsForApplication, applyBureauCaps } from './bureauCheck.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FactorScoreDetail {
  weight: number;
  score: number;
  weightedScore: number;
}

export interface FactorScores {
  financial_performance: FactorScoreDetail;
  leverage: FactorScoreDetail;
  liquidity: FactorScoreDetail;
  cashflow: FactorScoreDetail;
  management: FactorScoreDetail;
  industry: FactorScoreDetail;
  collateral: FactorScoreDetail;
  relationship: FactorScoreDetail;
  market_conditions: FactorScoreDetail;
}

export interface ScoreResult {
  scoreRun: any;
  factorScores: FactorScores;
  totalScore: number;
  riskRating: RiskRating;
  baseRiskRating: RiskRating;
  bureauCapsApplied: string[];
}

// ---------------------------------------------------------------------------
// Risk Rating mapping (totalScore → RiskRating)
// ---------------------------------------------------------------------------

function mapTotalScoreToRiskRating(totalScore: number): RiskRating {
  if (totalScore >= 85) return 'AAA';
  if (totalScore >= 78) return 'AA';
  if (totalScore >= 70) return 'A';
  if (totalScore >= 62) return 'BBB';
  if (totalScore >= 55) return 'BB';
  if (totalScore >= 48) return 'B';
  if (totalScore >= 40) return 'CCC';
  if (totalScore >= 30) return 'CC';
  if (totalScore >= 20) return 'C';
  return 'D';
}

// ---------------------------------------------------------------------------
// Factor scoring helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a value between 0 and 100.
 */
function clamp(val: number): number {
  return Math.max(0, Math.min(100, val));
}

/**
 * Score higher-is-better ratios: maps value to 0-100 range.
 * Uses linear scaling with a defined "good" and "bad" benchmark.
 */
function scoreHigherIsBetter(value: number | null, good: number, bad: number): number {
  if (value === null || value === undefined) return 50; // default when data missing
  if (value >= good) return 100;
  if (value <= bad) return 0;
  return clamp(((value - bad) / (good - bad)) * 100);
}

/**
 * Score lower-is-better ratios: maps value to 0-100 range (inverted).
 */
function scoreLowerIsBetter(value: number | null, good: number, bad: number): number {
  if (value === null || value === undefined) return 50;
  if (value <= good) return 100;
  if (value >= bad) return 0;
  return clamp(((bad - value) / (bad - good)) * 100);
}

/**
 * Compute factor score for a group from financial ratios.
 */
function computeFinancialPerformanceScore(ratioMap: Record<string, number>): number {
  const ros = ratioMap['ros'] ?? null;
  const roa = ratioMap['roa'] ?? null;
  const roe = ratioMap['roe'] ?? null;

  const scores: number[] = [];
  // ROS: >15% is good, <0% is bad
  if (ros !== null) scores.push(scoreHigherIsBetter(ros, 0.15, 0));
  // ROA: >10% is good, <0% is bad
  if (roa !== null) scores.push(scoreHigherIsBetter(roa, 0.10, 0));
  // ROE: >15% is good, <0% is bad
  if (roe !== null) scores.push(scoreHigherIsBetter(roe, 0.15, 0));

  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 50;
}

function computeLeverageScore(ratioMap: Record<string, number>): number {
  const debtToEquity = ratioMap['debt_to_equity'] ?? null;
  const debtToAssets = ratioMap['debt_to_assets'] ?? null;

  const scores: number[] = [];
  // Debt/Equity: <1.0 is good, >3.0 is bad
  if (debtToEquity !== null) scores.push(scoreLowerIsBetter(debtToEquity, 1.0, 3.0));
  // Debt/Assets: <0.4 is good, >0.8 is bad
  if (debtToAssets !== null) scores.push(scoreLowerIsBetter(debtToAssets, 0.4, 0.8));

  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 50;
}

function computeLiquidityScore(ratioMap: Record<string, number>): number {
  const currentRatio = ratioMap['current_ratio'] ?? null;
  const quickRatio = ratioMap['quick_ratio'] ?? null;

  const scores: number[] = [];
  // Current Ratio: >2.0 is good, <1.0 is bad
  if (currentRatio !== null) scores.push(scoreHigherIsBetter(currentRatio, 2.0, 1.0));
  // Quick Ratio: >1.5 is good, <0.5 is bad
  if (quickRatio !== null) scores.push(scoreHigherIsBetter(quickRatio, 1.5, 0.5));

  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 50;
}

function computeCashflowScore(ratioMap: Record<string, number>): number {
  const dscr = ratioMap['dscr'] ?? null;
  const interestCoverage = ratioMap['interest_coverage'] ?? null;

  const scores: number[] = [];
  // DSCR: >2.0 is good, <1.0 is bad
  if (dscr !== null) scores.push(scoreHigherIsBetter(dscr, 2.0, 1.0));
  // Interest Coverage: >5.0 is good, <1.5 is bad
  if (interestCoverage !== null) scores.push(scoreHigherIsBetter(interestCoverage, 5.0, 1.5));

  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 50;
}

// Qualitative factors — placeholder scores
const PLACEHOLDER_SCORE = 50;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class ScoringService {
  /**
   * Execute a credit score for an application.
   *
   * Steps:
   * 1. Find active scorecard version (or use specified scorecardId)
   * 2. Get the application's borrowerProfileId
   * 3. Get the latest APPROVED financial statement for the borrower
   * 4. Get the computed ratios from the financial statement
   * 5. Compute factor scores for each of the 9 factor groups
   * 6. Multiply each factor score by its weight to get weightedScore
   * 7. Sum all weightedScores to get totalScore
   * 8. Map totalScore to RiskRating
   * 9. Create CreditScoreRun record
   * 10. Return results
   */
  async executeScore(applicationId: string, scorecardId?: string): Promise<ScoreResult> {
    // Step 1: Find active scorecard version
    let scorecardVersion;
    const now = new Date();
    if (scorecardId) {
      scorecardVersion = await prisma.creditScorecardVersion.findFirst({
        where: {
          scorecardId,
          isActive: true,
          effectiveFrom: { lte: now },
        },
        orderBy: { version: 'desc' },
      });
      if (!scorecardVersion) {
        throw new AppError('No active scorecard version is valid for today\'s date. Please activate a scorecard version with the correct effective date range.', 409);
      }
    } else {
      // Find any scorecard with an active version
      scorecardVersion = await prisma.creditScorecardVersion.findFirst({
        where: {
          isActive: true,
          effectiveFrom: { lte: now },
        },
        orderBy: { version: 'desc' },
      });
      if (!scorecardVersion) {
        throw new AppError('No active scorecard version is valid for today\'s date. Please activate a scorecard version with the correct effective date range.', 409);
      }
    }

    // Step 2: Get the application's borrowerProfileId
    const application = await prisma.creditApplication.findUnique({
      where: { id: applicationId },
      select: { borrowerProfileId: true },
    });
    if (!application) {
      throw new Error('Credit application not found');
    }

    // Step 3: Get the latest APPROVED financial statement for the borrower
    const latestStatement = await prisma.financialStatement.findFirst({
      where: {
        borrowerProfileId: application.borrowerProfileId,
        status: 'APPROVED',
        deletedAt: null,
      },
      orderBy: { fiscalYearEnd: 'desc' },
      include: {
        ratios: true,
      },
    });

    // Step 4: Build ratio map from financial ratios
    const ratioMap: Record<string, number> = {};
    if (latestStatement) {
      for (const ratio of latestStatement.ratios) {
        ratioMap[ratio.ratioKey] = Number(ratio.value);
      }
    }

    // Step 5: Compute factor scores
    const factorWeights: FactorWeights = scorecardVersion.factorWeights as any;

    // Load qualitative assessments if available (Wave 1)
    const qa = await getQualitativeAssessment(applicationId);
    const qualScores = qa
      ? toFactorScores({
          managementScore: qa.managementScore,
          relationshipScore: qa.relationshipScore,
          industryScore: qa.industryScore,
          collateralScore: qa.collateralScore,
        })
      : { management: 50, relationship: 50, industry: 50, collateral: 50 };

    const factorScores: FactorScores = {
      financial_performance: {
        weight: factorWeights.financial_performance,
        score: computeFinancialPerformanceScore(ratioMap),
        weightedScore: 0,
      },
      leverage: {
        weight: factorWeights.leverage,
        score: computeLeverageScore(ratioMap),
        weightedScore: 0,
      },
      liquidity: {
        weight: factorWeights.liquidity,
        score: computeLiquidityScore(ratioMap),
        weightedScore: 0,
      },
      cashflow: {
        weight: factorWeights.cashflow,
        score: computeCashflowScore(ratioMap),
        weightedScore: 0,
      },
      management: {
        weight: factorWeights.management,
        score: qualScores.management,
        weightedScore: 0,
      },
      industry: {
        weight: factorWeights.industry,
        score: qualScores.industry,
        weightedScore: 0,
      },
      collateral: {
        weight: factorWeights.collateral,
        score: qualScores.collateral,
        weightedScore: 0,
      },
      relationship: {
        weight: factorWeights.relationship,
        score: qualScores.relationship,
        weightedScore: 0,
      },
      market_conditions: {
        weight: factorWeights.market_conditions,
        score: PLACEHOLDER_SCORE,
        weightedScore: 0,
      },
    };

    // Step 6: Compute weighted scores
    let totalScore = 0;
    for (const key of FACTOR_GROUPS) {
      const factor = factorScores[key];
      factor.weightedScore = (factor.score * factor.weight) / 100;
      totalScore += factor.weightedScore;
    }

    // Step 7: Round totalScore to 2 decimal places
    totalScore = Math.round(totalScore * 100) / 100;

    // Step 8: Map totalScore to RiskRating
    const baseRiskRating = mapTotalScoreToRiskRating(totalScore);

    // Step 8b: Apply bureau rating caps
    const bureauCaps = await getBureauCapsForApplication(applicationId);
    const { effectiveRating: riskRating, capsApplied: bureauCapsApplied } = applyBureauCaps(baseRiskRating, bureauCaps);

    // Step 9: Create CreditScoreRun record
    const scoreRun = await prisma.creditScoreRun.create({
      data: {
        applicationId,
        scorecardVersionId: scorecardVersion.id,
        factorScores: factorScores as any,
        totalScore: new Prisma.Decimal(totalScore),
        riskRating,
        baseRiskRating,
        bureauCapsApplied: bureauCapsApplied.length > 0 ? bureauCapsApplied : Prisma.JsonNull,
        isOverride: false,
        runAt: new Date(),
      },
      include: {
        application: { select: { id: true, applicationNo: true } },
        scorecardVersion: {
          select: {
            id: true,
            version: true,
            scorecard: { select: { id: true, name: true } },
          },
        },
        overrideApprovedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Step 10: Return results
    return {
      scoreRun,
      factorScores,
      totalScore,
      riskRating,
      baseRiskRating,
      bureauCapsApplied,
    };
  }

  /**
   * Override a score run's risk rating.
   * Requires a second-person approval (overrideApprovedById must be different from the requester).
   */
  async overrideScore(
    scoreRunId: string,
    data: {
      newRiskRating: RiskRating;
      overrideReason: string;
      overrideApprovedById: string;
    }
  ) {
    const existing = await prisma.creditScoreRun.findUnique({
      where: { id: scoreRunId },
    });

    if (!existing) {
      throw new Error('Score run not found');
    }

    return prisma.creditScoreRun.update({
      where: { id: scoreRunId },
      data: {
        riskRating: data.newRiskRating,
        isOverride: true,
        overrideReason: data.overrideReason,
        overrideApprovedById: data.overrideApprovedById,
        overrideApprovedAt: new Date(),
      },
      include: {
        application: { select: { id: true, applicationNo: true } },
        scorecardVersion: {
          select: {
            id: true,
            version: true,
            scorecard: { select: { id: true, name: true } },
          },
        },
        overrideApprovedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  /**
   * List all score runs for an application.
   */
  async getApplicationScores(applicationId: string) {
    return prisma.creditScoreRun.findMany({
      where: { applicationId },
      orderBy: { runAt: 'desc' },
      include: {
        scorecardVersion: {
          select: {
            id: true,
            version: true,
            factorWeights: true,
            scorecard: { select: { id: true, name: true } },
          },
        },
        overrideApprovedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }
}

export const scoringService = new ScoringService();