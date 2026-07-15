import prisma from '../../utils/prisma';
import { Prisma, RiskRating } from '@prisma/client';
import { FACTOR_GROUPS, FactorWeights } from './scorecard.service';
import { AppError } from '../../middleware/error.middleware';
import { getQualitativeAssessment, toFactorScores } from './qualitativeAssessment.service';
import { getBureauCapsForApplication, applyBureauCaps, isBureauCheckFresh } from './bureauCheck.service';
import { getRetailIncome } from './retailIncome.service';
import { AuditChainService } from './auditChain.service';
import { ratingToOrdinal } from './approvalMatrix.service';
import { resolveMissingFactorScore, getMissingDataPolicies, MissingInputRecord } from './missingDataPolicy.service';
import { mapScoreToRatingFromBands } from './ratingBand.service';
import { persistApplicationRiskRating } from './applicationRating.service';
import { getNumberPolicy } from './policyParameter.service';
import { scoreFactorDefinitionService, type GovernanceWarning } from './scoreFactorDefinition.service';

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
  bureauFresh: boolean;
  staleBureauProviders: string[];
  governanceWarnings: GovernanceWarning[];
}

interface RatioThreshold {
  good: number;
  bad: number;
}

export interface FinancialPerformanceThresholds {
  ros: RatioThreshold;
  roa: RatioThreshold;
  roe: RatioThreshold;
}

export interface LeverageThresholds {
  debtToEquity: RatioThreshold;
  debtToAssets: RatioThreshold;
}

export interface LiquidityThresholds {
  currentRatio: RatioThreshold;
  quickRatio: RatioThreshold;
}

export interface CashflowThresholds {
  dscr: RatioThreshold;
  interestCoverage: RatioThreshold;
}

export interface RetailDsrThresholds {
  passMax: number;
  warnMax: number;
  hardFailAt: number;
  passScoreFloor: number;
  warnScoreFloor: number;
}

export interface ScoringThresholds {
  financialPerformance: FinancialPerformanceThresholds;
  leverage: LeverageThresholds;
  liquidity: LiquidityThresholds;
  cashflow: CashflowThresholds;
  retailDsr: RetailDsrThresholds;
}

const DEFAULT_SCORING_THRESHOLDS: ScoringThresholds = {
  financialPerformance: {
    ros: { good: 0.15, bad: 0 },
    roa: { good: 0.10, bad: 0 },
    roe: { good: 0.15, bad: 0 },
  },
  leverage: {
    debtToEquity: { good: 1.0, bad: 3.0 },
    debtToAssets: { good: 0.4, bad: 0.8 },
  },
  liquidity: {
    currentRatio: { good: 2.0, bad: 1.0 },
    quickRatio: { good: 1.5, bad: 0.5 },
  },
  cashflow: {
    dscr: { good: 2.0, bad: 1.0 },
    interestCoverage: { good: 5.0, bad: 1.5 },
  },
  retailDsr: {
    passMax: 60,
    warnMax: 70,
    hardFailAt: 80,
    passScoreFloor: 80,
    warnScoreFloor: 20,
  },
};

export async function getScoringThresholds(): Promise<ScoringThresholds> {
  const d = DEFAULT_SCORING_THRESHOLDS;
  const [
    rosGood, rosBad, roaGood, roaBad, roeGood, roeBad,
    debtToEquityGood, debtToEquityBad, debtToAssetsGood, debtToAssetsBad,
    currentRatioGood, currentRatioBad, quickRatioGood, quickRatioBad,
    dscrGood, dscrBad, interestCoverageGood, interestCoverageBad,
    passMax, warnMax, hardFailAt, passScoreFloor, warnScoreFloor,
  ] = await Promise.all([
    getNumberPolicy('scoring.financial_performance.ros.good', d.financialPerformance.ros.good),
    getNumberPolicy('scoring.financial_performance.ros.bad', d.financialPerformance.ros.bad),
    getNumberPolicy('scoring.financial_performance.roa.good', d.financialPerformance.roa.good),
    getNumberPolicy('scoring.financial_performance.roa.bad', d.financialPerformance.roa.bad),
    getNumberPolicy('scoring.financial_performance.roe.good', d.financialPerformance.roe.good),
    getNumberPolicy('scoring.financial_performance.roe.bad', d.financialPerformance.roe.bad),
    getNumberPolicy('scoring.leverage.debt_to_equity.good', d.leverage.debtToEquity.good),
    getNumberPolicy('scoring.leverage.debt_to_equity.bad', d.leverage.debtToEquity.bad),
    getNumberPolicy('scoring.leverage.debt_to_assets.good', d.leverage.debtToAssets.good),
    getNumberPolicy('scoring.leverage.debt_to_assets.bad', d.leverage.debtToAssets.bad),
    getNumberPolicy('scoring.liquidity.current_ratio.good', d.liquidity.currentRatio.good),
    getNumberPolicy('scoring.liquidity.current_ratio.bad', d.liquidity.currentRatio.bad),
    getNumberPolicy('scoring.liquidity.quick_ratio.good', d.liquidity.quickRatio.good),
    getNumberPolicy('scoring.liquidity.quick_ratio.bad', d.liquidity.quickRatio.bad),
    getNumberPolicy('scoring.cashflow.dscr.good', d.cashflow.dscr.good),
    getNumberPolicy('scoring.cashflow.dscr.bad', d.cashflow.dscr.bad),
    getNumberPolicy('scoring.cashflow.interest_coverage.good', d.cashflow.interestCoverage.good),
    getNumberPolicy('scoring.cashflow.interest_coverage.bad', d.cashflow.interestCoverage.bad),
    getNumberPolicy('scoring.retail_dsr.pass_max', d.retailDsr.passMax),
    getNumberPolicy('scoring.retail_dsr.warn_max', d.retailDsr.warnMax),
    getNumberPolicy('scoring.retail_dsr.hard_fail_at', d.retailDsr.hardFailAt),
    getNumberPolicy('scoring.retail_dsr.pass_score_floor', d.retailDsr.passScoreFloor),
    getNumberPolicy('scoring.retail_dsr.warn_score_floor', d.retailDsr.warnScoreFloor),
  ]);

  return {
    financialPerformance: {
      ros: { good: rosGood, bad: rosBad },
      roa: { good: roaGood, bad: roaBad },
      roe: { good: roeGood, bad: roeBad },
    },
    leverage: {
      debtToEquity: { good: debtToEquityGood, bad: debtToEquityBad },
      debtToAssets: { good: debtToAssetsGood, bad: debtToAssetsBad },
    },
    liquidity: {
      currentRatio: { good: currentRatioGood, bad: currentRatioBad },
      quickRatio: { good: quickRatioGood, bad: quickRatioBad },
    },
    cashflow: {
      dscr: { good: dscrGood, bad: dscrBad },
      interestCoverage: { good: interestCoverageGood, bad: interestCoverageBad },
    },
    retailDsr: { passMax, warnMax, hardFailAt, passScoreFloor, warnScoreFloor },
  };
}

// ---------------------------------------------------------------------------
// Risk Rating mapping (totalScore → RiskRating)
//
// P2.1: The static fallback is DEPRECATED. mapScoreToRatingFromBands() is now
// the canonical path. This function is kept ONLY as a safety net for unseeded
// databases during migration. It will be removed in P2.4.
// ---------------------------------------------------------------------------

/** @deprecated Use mapScoreToRatingFromBands() instead. Static fallback for unseeded DBs. */
export function mapTotalScoreToRiskRating(totalScore: number): RiskRating {
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

/**
 * Resolve the DSR percentage to use for retail cashflow scoring.
 *
 * Honours `dsrBasis`: when the retail-income computation was able to derive
 * a NET DSR (positive net income) the basis is 'NET' and the tighter net
 * figure should drive scoring. Otherwise fall back to the gross DSR. This
 * mirrors submissionReadiness.service.ts which already treats net/gross DSR
 * consistently.
 */
export function resolveRetailDsr(ri: {
  dsrPercent: number | null;
  netDsrPercent: number | null;
  dsrBasis?: string | null;
}): number | null {
  if (ri.dsrBasis === 'NET' && ri.netDsrPercent != null && Number(ri.netDsrPercent) > 0) {
    return Number(ri.netDsrPercent);
  }
  return ri.dsrPercent != null ? Number(ri.dsrPercent) : null;
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
export function computeFinancialPerformanceScore(
  ratioMap: Record<string, number>,
  thresholds: FinancialPerformanceThresholds = DEFAULT_SCORING_THRESHOLDS.financialPerformance,
): number {
  const ros = ratioMap['ros'] ?? null;
  const roa = ratioMap['roa'] ?? null;
  const roe = ratioMap['roe'] ?? null;

  const scores: number[] = [];
  if (ros !== null) scores.push(scoreHigherIsBetter(ros, thresholds.ros.good, thresholds.ros.bad));
  if (roa !== null) scores.push(scoreHigherIsBetter(roa, thresholds.roa.good, thresholds.roa.bad));
  if (roe !== null) scores.push(scoreHigherIsBetter(roe, thresholds.roe.good, thresholds.roe.bad));

  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 50;
}

export function computeLeverageScore(
  ratioMap: Record<string, number>,
  thresholds: LeverageThresholds = DEFAULT_SCORING_THRESHOLDS.leverage,
): number {
  const debtToEquity = ratioMap['debt_to_equity'] ?? null;
  const debtToAssets = ratioMap['debt_to_assets'] ?? null;

  const scores: number[] = [];
  if (debtToEquity !== null) scores.push(scoreLowerIsBetter(debtToEquity, thresholds.debtToEquity.good, thresholds.debtToEquity.bad));
  if (debtToAssets !== null) scores.push(scoreLowerIsBetter(debtToAssets, thresholds.debtToAssets.good, thresholds.debtToAssets.bad));

  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 50;
}

export function computeLiquidityScore(
  ratioMap: Record<string, number>,
  thresholds: LiquidityThresholds = DEFAULT_SCORING_THRESHOLDS.liquidity,
): number {
  const currentRatio = ratioMap['current_ratio'] ?? null;
  const quickRatio = ratioMap['quick_ratio'] ?? null;

  const scores: number[] = [];
  if (currentRatio !== null) scores.push(scoreHigherIsBetter(currentRatio, thresholds.currentRatio.good, thresholds.currentRatio.bad));
  if (quickRatio !== null) scores.push(scoreHigherIsBetter(quickRatio, thresholds.quickRatio.good, thresholds.quickRatio.bad));

  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 50;
}

export function computeCashflowScore(
  ratioMap: Record<string, number>,
  thresholds: CashflowThresholds = DEFAULT_SCORING_THRESHOLDS.cashflow,
): number {
  const dscr = ratioMap['dscr'] ?? null;
  const interestCoverage = ratioMap['interest_coverage'] ?? null;

  const scores: number[] = [];
  if (dscr !== null) scores.push(scoreHigherIsBetter(dscr, thresholds.dscr.good, thresholds.dscr.bad));
  if (interestCoverage !== null) scores.push(scoreHigherIsBetter(interestCoverage, thresholds.interestCoverage.good, thresholds.interestCoverage.bad));

  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 50;
}

/**
 * Convert a DSR percentage to a 0-100 cashflow score.
 * DSR 0% → 100, DSR 60% → 80, DSR 70% → 20, DSR ≥80% → 0
 * Uses a two-segment linear scale: 0-60% maps to 80-100, 60-70% maps to 20-80, >70% clamps at 0.
 */
export function computeDsrCashflowScore(
  dsrPercent: number,
  thresholds: RetailDsrThresholds = DEFAULT_SCORING_THRESHOLDS.retailDsr,
): number {
  if (dsrPercent <= 0) return 100;
  if (dsrPercent <= thresholds.passMax) {
    return 100 - (dsrPercent / thresholds.passMax) * (100 - thresholds.passScoreFloor);
  }
  if (dsrPercent <= thresholds.warnMax) {
    return thresholds.passScoreFloor -
      ((dsrPercent - thresholds.passMax) / (thresholds.warnMax - thresholds.passMax)) *
        (thresholds.passScoreFloor - thresholds.warnScoreFloor);
  }
  return Math.max(0, thresholds.warnScoreFloor -
    ((dsrPercent - thresholds.warnMax) / (thresholds.hardFailAt - thresholds.warnMax)) *
      thresholds.warnScoreFloor);
}

// Qualitative factors — no longer use PLACEHOLDER_SCORE; missing-data policy drives the score

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
  async executeScore(
    applicationId: string,
    scorecardId?: string,
    opts: { actorId?: string | null; source?: 'AUTO' | 'MANUAL' | 'RESCORE' } = {},
  ): Promise<ScoreResult> {
    // Step 1a: Get the application first (needed for product-type scorecard selection)
    const application = await prisma.creditApplication.findUnique({
      where: { id: applicationId },
      select: {
        borrowerProfileId: true,
        productType: true,
        borrowerProfile: { select: { borrowerType: true } },
      },
    });
    if (!application) {
      throw new Error('Credit application not found');
    }

    // Step 1b: Find active scorecard version
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
      // Phase 5 — prefer product-specific scorecard. If the application has a
      // productType, try to find an active scorecard version for that product
      // first. Fall back to the generic (productType = null) scorecard set.
      const productType = application.productType as string | null;

      // Try product-specific active versions first
      let activeVersions: any[] = [];
      if (productType) {
        activeVersions = await prisma.creditScorecardVersion.findMany({
          where: {
            isActive: true,
            effectiveFrom: { lte: now },
            scorecard: { productType: productType as any },
          },
          orderBy: { version: 'desc' },
          include: { scorecard: { select: { id: true, name: true, productType: true } } },
        });
      }

      // Fall back to generic (no product type filter) if no product-specific scorecard
      if (activeVersions.length === 0) {
        activeVersions = await prisma.creditScorecardVersion.findMany({
          where: {
            isActive: true,
            effectiveFrom: { lte: now },
          },
          orderBy: { version: 'desc' },
          include: { scorecard: { select: { id: true, name: true, productType: true } } },
        });
      }

      if (activeVersions.length === 0) {
        throw new AppError('No active scorecard version is valid for today\'s date. Please activate a scorecard version with the correct effective date range.', 409);
      }
      const distinctScorecards = new Set(activeVersions.map((v) => v.scorecardId));
      if (distinctScorecards.size > 1) {
        throw new AppError('Multiple scorecards have an active version. Specify a scorecardId, or deactivate the others so exactly one scorecard is active.', 409);
      }
      scorecardVersion = activeVersions[0];
    }

    // Step 2: Application already fetched in step 1a

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

    // Step 5: Compute factor scores (retail borrowers use alternate weight set if configured)
    const isRetail = application.borrowerProfile?.borrowerType === 'INDIVIDUAL' ||
                     application.borrowerProfile?.borrowerType === 'SOLE_PROPRIETOR';
    const factorWeights: FactorWeights = (isRetail && (scorecardVersion as any).retailFactorWeights)
      ? (scorecardVersion.retailFactorWeights as any)
      : (scorecardVersion.factorWeights as any);

    // Step 5a: For retail borrowers, fetch DSR for cashflow scoring.
    // Honour dsrBasis (NET vs GROSS) so scoring uses the same DSR figure the
    // readiness checks and CA memo present to the user.
    let dsrPercent: number | null = null;
    if (isRetail) {
      const retailIncome = await getRetailIncome(applicationId);
      if (retailIncome) {
        dsrPercent = resolveRetailDsr({
          dsrPercent: retailIncome.dsrPercent != null ? Number(retailIncome.dsrPercent) : null,
          netDsrPercent: retailIncome.netDsrPercent != null ? Number(retailIncome.netDsrPercent) : null,
          dsrBasis: (retailIncome as any).dsrBasis ?? 'GROSS',
        });
      }
    }

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

    const scoringThresholds = await getScoringThresholds();

    const factorScores: FactorScores = {
      financial_performance: {
        weight: factorWeights.financial_performance,
        score: computeFinancialPerformanceScore(ratioMap, scoringThresholds.financialPerformance),
        weightedScore: 0,
      },
      leverage: {
        weight: factorWeights.leverage,
        score: computeLeverageScore(ratioMap, scoringThresholds.leverage),
        weightedScore: 0,
      },
      liquidity: {
        weight: factorWeights.liquidity,
        score: computeLiquidityScore(ratioMap, scoringThresholds.liquidity),
        weightedScore: 0,
      },
      cashflow: {
        weight: factorWeights.cashflow,
        score: (isRetail && dsrPercent !== null)
          ? computeDsrCashflowScore(dsrPercent, scoringThresholds.retailDsr)
          : computeCashflowScore(ratioMap, scoringThresholds.cashflow),
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
        score: 50, // will be replaced by missing-data policy below
        weightedScore: 0,
      },
    };

    // Step 5b: Apply missing-data policy to factors that had no source data.
    // Factors with all sub-fields missing get a policy-based score instead of
    // the blanket 50. Collect missingInputs records for the audit trail.
    // Also collect governance warnings for factors using placeholder data.
    const missingInputs: MissingInputRecord[] = [];
    const governanceWarnings: GovernanceWarning[] = [];
    const missingDataPolicies = await getMissingDataPolicies();

    // Step 5c: Validate factor weights against governed definitions.
    // Emit governance warnings for EXTERNAL factors with weight > 0 (no real data source)
    // and for factors without an active definition.
    const factorValidation = await scoreFactorDefinitionService.validateFactorWeights(factorWeights as any);
    governanceWarnings.push(...factorValidation.warnings);

    // Detect which financial-ratio-based factors had missing data (all sub-fields null)
    const hasAnyRatio = Object.keys(ratioMap).length > 0;
    if (!hasAnyRatio) {
      // No ratios at all — financial_performance, leverage, liquidity, cashflow all missing
      for (const f of ['financial_performance', 'leverage', 'liquidity', 'cashflow'] as (keyof FactorScores)[]) {
        const { score, record } = resolveMissingFactorScore(f, 'all_ratios', missingDataPolicies);
        factorScores[f].score = score;
        missingInputs.push(record);
      }
    }

    // Qualitative factors: if no QA was submitted, all 4 got the default 50
    if (!qa) {
      for (const f of ['management', 'industry', 'collateral', 'relationship'] as (keyof FactorScores)[]) {
        const { score, record } = resolveMissingFactorScore(f, 'qualitative_assessment', missingDataPolicies);
        factorScores[f].score = score;
        missingInputs.push(record);
      }
    }

    // Retail cashflow: if retail borrower but no DSR data
    if (isRetail && dsrPercent === null) {
      const { score, record } = resolveMissingFactorScore('cashflow', 'dsr_percent', missingDataPolicies);
      factorScores.cashflow.score = score;
      missingInputs.push(record);
    }

    // market_conditions: EXTERNAL source with no real data provider — apply missing-data policy
    // and emit a governance warning (P2.1: no more silent placeholder scores)
    {
      const { score, record } = resolveMissingFactorScore('market_conditions', 'no_external_data_source', missingDataPolicies);
      factorScores.market_conditions.score = score;
      missingInputs.push(record);
      governanceWarnings.push({
        field: 'market_conditions',
        message: `market_conditions uses ${record.policy} policy (score: ${score}) because no external data source is configured. Weight: ${factorWeights.market_conditions}.`,
        severity: 'warning',
      });
    }

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
    // Phase 5 — prefer configurable RatingBandConfig; fall back to hardcoded
    // thresholds when no bands are active (unseeded DB behavior unchanged).
    const bandRating = await mapScoreToRatingFromBands(totalScore);
    const baseRiskRating = bandRating ?? mapTotalScoreToRiskRating(totalScore);

    // Step 8b: Apply bureau rating caps
    const bureauCaps = await getBureauCapsForApplication(applicationId);
    const { effectiveRating: riskRating, capsApplied: bureauCapsApplied } = applyBureauCaps(baseRiskRating, bureauCaps);

    // Step 8c: Evaluate bureau data freshness (90-day window). Caps only ever
    // worsen the rating, so stale data is not unsafe — but the run should flag
    // it so officers know the score rests on out-of-date bureau information.
    const { fresh: bureauFresh, staleProviders: staleBureauProviders } = await isBureauCheckFresh(applicationId);

    // Step 9: Create CreditScoreRun record (with provenance + input snapshot)
    const inputSnapshot = {
      factorScores,
      totalScore,
      dsrPercent,
      bureauCapsApplied,
      bureauFresh,
      staleBureauProviders,
      missingInputs,
      capturedAt: new Date().toISOString(),
    };

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
        calculatedById: opts.actorId ?? null,
        calculationSource: opts.source ?? 'MANUAL',
        inputSnapshot: inputSnapshot as any,
        missingInputs: missingInputs.length > 0 ? (missingInputs as any) : Prisma.JsonNull,
        scoreRunWarnings: governanceWarnings.length > 0 ? (governanceWarnings as any) : Prisma.JsonNull,
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

    await persistApplicationRiskRating(applicationId, riskRating, scoreRun.runAt);

    // Step 9b: Append SCORE_RUN_CREATED to the tamper-evident audit chain
    await AuditChainService.appendEvent(
      applicationId,
      'SCORE_RUN_CREATED',
      opts.actorId ?? null,
      'score',
      null,
      riskRating,
      {
        scoreRunId: scoreRun.id,
        scorecardVersionId: scorecardVersion.id,
        totalScore,
        riskRating,
        bureauCapsApplied,
        bureauFresh,
      },
    );

    // Step 10: Return results
    return {
      scoreRun,
      factorScores,
      totalScore,
      riskRating,
      baseRiskRating,
      bureauCapsApplied,
      bureauFresh,
      staleBureauProviders,
      governanceWarnings,
    };
  }

  /**
   * Override a score run's risk rating.
   * Segregation of duties: the approver (overrideApprovedById) must be a
   * different user from the requester. The override is recorded on the
   * application's audit chain.
   */
  async overrideScore(
    scoreRunId: string,
    data: {
      newRiskRating: RiskRating;
      overrideReason: string;
      overrideApprovedById: string;
      requestedById: string;
    }
  ) {
    const existing = await prisma.creditScoreRun.findUnique({
      where: { id: scoreRunId },
    });

    if (!existing) {
      throw new Error('Score run not found');
    }

    // Segregation of duties — the approver cannot be the requester.
    if (data.overrideApprovedById === data.requestedById) {
      throw new AppError(
        'Score override requires approval by a different officer from the requester.',
        403,
        { code: 'SCORE_OVERRIDE_SOD_VIOLATION' },
      );
    }

    // Material overrides (≥2 notches) must go through the dual-approval flow
    // (ScoreOverrideApproval), not the direct override path. This prevents a
    // single approver from making large rating jumps without a second approver.
    const notchDelta = Math.abs(
      ratingToOrdinal(existing.riskRating) - ratingToOrdinal(data.newRiskRating),
    );
    if (notchDelta >= 2) {
      throw new AppError(
        'Material overrides (>=2 notches) require the dual-approval flow.',
        409,
        { code: 'SCORE_OVERRIDE_MATERIAL_APPROVAL_REQUIRED' },
      );
    }

    const updated = await prisma.creditScoreRun.update({
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

    await persistApplicationRiskRating(
      existing.applicationId,
      data.newRiskRating,
      updated.overrideApprovedAt ?? new Date(),
    );

    await AuditChainService.appendEvent(
      existing.applicationId,
      'SCORE_RUN_OVERRIDDEN',
      data.requestedById,
      'override',
      existing.riskRating,
      data.newRiskRating,
      {
        scoreRunId,
        overrideReason: data.overrideReason,
        overrideApprovedById: data.overrideApprovedById,
      },
    );

    return updated;
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