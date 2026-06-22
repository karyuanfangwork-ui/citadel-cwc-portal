import prisma from '../../utils/prisma';
import { Prisma, RiskRating } from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { FACTOR_GROUPS, FactorWeights } from './scorecard.service';
import {
  mapTotalScoreToRiskRating,
  computeFinancialPerformanceScore,
  computeLeverageScore,
  computeLiquidityScore,
  computeCashflowScore,
  computeDsrCashflowScore,
} from './scoring.service';
import { applyBureauCaps, BureauCapInput } from './bureauCheck.service';
import { logBorrowerActivity } from './borrowerActivity.service';

const NEUTRAL_SCORE = 50;

// ── Types ────────────────────────────────────────────────────────────────────

export interface BorrowerScoreInputs {
  ratioMap: Record<string, number>;
  isRetail: boolean;
  dsrPercent: number | null;
  creditScore: number | null;
  facilityConductStatuses: string[];
  hasFinancialStatement: boolean;
  hasIncome: boolean;
}

export interface ReasonCode {
  code: string;
  label: string;
}

export interface BorrowerScoreResult {
  borrowerRiskRun: any;
  totalScore: number;
  baseRiskRating: RiskRating;
  effectiveRiskRating: RiskRating;
  bureauCapsApplied: string[];
  reasonCodes: ReasonCode[];
  missingInputs: string[];
}

export interface FactorScoreDetail {
  weight: number;
  score: number;
  weightedScore: number;
}
export type BorrowerFactorScores = Record<(typeof FACTOR_GROUPS)[number], FactorScoreDetail>;

// ── Pure: bureau caps from borrower-level conduct data ────────────────────────
//
// No live bureau API exists. Inputs come from manually-uploaded BorrowerBureauReport
// facilities (conductStatus) and the manually-entered BorrowerCreditProfile.creditScore.

export function deriveBorrowerBureauCaps(
  creditScore: number | null,
  facilityConductStatuses: string[],
): BureauCapInput[] {
  const caps: BureauCapInput[] = [];

  if (creditScore !== null && creditScore !== undefined) {
    if (creditScore < 300) caps.push({ reason: 'borrower_score_lt_300', maxRating: 'B' });
    else if (creditScore < 500) caps.push({ reason: 'borrower_score_lt_500', maxRating: 'BB' });
  }

  const statuses = facilityConductStatuses.map((s) => s.toUpperCase());
  if (statuses.includes('IMPAIRED')) caps.push({ reason: 'facility_impaired', maxRating: 'C' });
  if (statuses.includes('CCRIS_RR') || statuses.includes('NON_CCRIS_RR')) {
    caps.push({ reason: 'facility_rescheduled', maxRating: 'B' });
  }
  if (statuses.includes('WATCHLIST')) caps.push({ reason: 'facility_watchlist', maxRating: 'BB' });

  return caps;
}

// ── Pure: missing-input detection ─────────────────────────────────────────────

export function deriveMissingInputs(inputs: BorrowerScoreInputs): string[] {
  const missing: string[] = [];
  if (inputs.isRetail) {
    if (!inputs.hasIncome || inputs.dsrPercent === null) missing.push('borrower_income');
  } else if (!inputs.hasFinancialStatement) {
    missing.push('financial_statement');
  }
  if (inputs.creditScore === null || inputs.creditScore === undefined) missing.push('bureau_score');
  return missing;
}

// ── Pure: reason codes ─────────────────────────────────────────────────────────

const CAP_LABELS: Record<string, string> = {
  borrower_score_lt_300: 'Bureau score below 300 — rating capped',
  borrower_score_lt_500: 'Bureau score below 500 — rating capped',
  facility_impaired: 'Impaired facility on bureau report — rating capped',
  facility_rescheduled: 'Rescheduled/restructured facility — rating capped',
  facility_watchlist: 'Watchlist facility — rating capped',
};

export function deriveReasonCodes(
  inputs: BorrowerScoreInputs,
  _baseRating: RiskRating,
  capsApplied: string[],
): ReasonCode[] {
  const codes: ReasonCode[] = [];

  for (const cap of capsApplied) {
    codes.push({ code: cap, label: CAP_LABELS[cap] ?? cap });
  }

  if (inputs.isRetail && inputs.dsrPercent !== null && inputs.dsrPercent > 70) {
    codes.push({ code: 'high_dsr', label: `High DSR (${inputs.dsrPercent.toFixed(1)}%)` });
  }

  return codes;
}

// ── Pure: total score combiner ─────────────────────────────────────────────────

export function computeBorrowerTotalScore(
  inputs: BorrowerScoreInputs,
  weights: FactorWeights,
): { totalScore: number; factorScores: BorrowerFactorScores } {
  const cashflowScore =
    inputs.isRetail && inputs.dsrPercent !== null
      ? computeDsrCashflowScore(inputs.dsrPercent)
      : computeCashflowScore(inputs.ratioMap);

  const rawScores: Record<(typeof FACTOR_GROUPS)[number], number> = {
    financial_performance: computeFinancialPerformanceScore(inputs.ratioMap),
    leverage: computeLeverageScore(inputs.ratioMap),
    liquidity: computeLiquidityScore(inputs.ratioMap),
    cashflow: cashflowScore,
    // Qualitative factors are application-level only; neutral at borrower level.
    management: NEUTRAL_SCORE,
    industry: NEUTRAL_SCORE,
    collateral: NEUTRAL_SCORE,
    relationship: NEUTRAL_SCORE,
    market_conditions: NEUTRAL_SCORE,
  };

  const factorScores = {} as BorrowerFactorScores;
  let totalScore = 0;
  for (const key of FACTOR_GROUPS) {
    const weight = (weights as any)[key] ?? 0;
    const score = rawScores[key];
    const weightedScore = (score * weight) / 100;
    factorScores[key] = { weight, score, weightedScore };
    totalScore += weightedScore;
  }
  totalScore = Math.round(totalScore * 100) / 100;
  return { totalScore, factorScores };
}

// ── DB orchestration ──────────────────────────────────────────────────────────

async function getActiveScorecardVersion() {
  const now = new Date();
  return prisma.creditScorecardVersion.findFirst({
    where: { isActive: true, effectiveFrom: { lte: now } },
    orderBy: { version: 'desc' },
  });
}

export async function executeBorrowerScore(
  borrowerId: string,
  calculatedById?: string,
): Promise<BorrowerScoreResult> {
  const profile = await prisma.borrowerProfile.findUnique({ where: { id: borrowerId } });
  if (!profile) throw new AppError('Borrower profile not found', 404);

  const scorecardVersion = await getActiveScorecardVersion();
  if (!scorecardVersion) {
    throw new AppError('No active scorecard version is valid for today\'s date.', 409);
  }

  const isRetail =
    profile.borrowerType === 'INDIVIDUAL' || profile.borrowerType === 'SOLE_PROPRIETOR';

  const [latestStatement, income, creditProfile, latestBureau] = await Promise.all([
    prisma.financialStatement.findFirst({
      where: { borrowerProfileId: borrowerId, status: 'APPROVED', deletedAt: null },
      orderBy: { fiscalYearEnd: 'desc' },
      include: { ratios: true },
    }),
    prisma.borrowerIncome.findUnique({ where: { borrowerId } }),
    prisma.borrowerCreditProfile.findUnique({ where: { borrowerId } }),
    prisma.borrowerBureauReport.findFirst({
      where: { borrowerId },
      orderBy: { uploadedAt: 'desc' },
      include: { facilities: true },
    }),
  ]);

  const ratioMap: Record<string, number> = {};
  if (latestStatement) {
    for (const ratio of latestStatement.ratios) ratioMap[ratio.ratioKey] = Number(ratio.value);
  }

  const dsrPercent = creditProfile?.dsrPercent != null ? Number(creditProfile.dsrPercent) : null;
  const creditScore = creditProfile?.creditScore ?? null;
  const facilityConductStatuses = (latestBureau?.facilities ?? [])
    .map((f) => f.conductStatus)
    .filter((s): s is string => Boolean(s));

  const inputs: BorrowerScoreInputs = {
    ratioMap,
    isRetail,
    dsrPercent,
    creditScore,
    facilityConductStatuses,
    hasFinancialStatement: Boolean(latestStatement),
    hasIncome: Boolean(income),
  };

  const retailWeights = (scorecardVersion as any).retailFactorWeights;
  const weights: FactorWeights =
    isRetail && retailWeights ? retailWeights : (scorecardVersion.factorWeights as any);

  const { totalScore, factorScores } = computeBorrowerTotalScore(inputs, weights);
  const baseRiskRating = mapTotalScoreToRiskRating(totalScore);
  const caps = deriveBorrowerBureauCaps(creditScore, facilityConductStatuses);
  const { effectiveRating, capsApplied } = applyBureauCaps(baseRiskRating, caps);
  const reasonCodes = deriveReasonCodes(inputs, baseRiskRating, capsApplied);
  const missingInputs = deriveMissingInputs(inputs);

  const borrowerRiskRun = await prisma.borrowerRiskRun.create({
    data: {
      borrowerProfileId: borrowerId,
      scorecardVersionId: scorecardVersion.id,
      scorecardVersion: scorecardVersion.version,
      factorScores: factorScores as any,
      totalScore: new Prisma.Decimal(totalScore),
      baseRiskRating,
      effectiveRiskRating: effectiveRating,
      bureauCapsApplied: capsApplied.length > 0 ? capsApplied : Prisma.JsonNull,
      reasonCodes: reasonCodes.length > 0 ? (reasonCodes as any) : Prisma.JsonNull,
      missingInputs: missingInputs.length > 0 ? missingInputs : Prisma.JsonNull,
      calculationSource: 'SYSTEM',
      calculatedById: calculatedById ?? null,
      runAt: new Date(),
    },
  });

  // Denormalize latest rating onto the borrower for fast list/summary reads.
  await prisma.borrowerProfile.update({
    where: { id: borrowerId },
    data: {
      creditRiskRating: effectiveRating,
      riskRatingCalculatedAt: borrowerRiskRun.runAt,
      riskRatingVersion: scorecardVersion.version,
    },
  });

  // Governance log (borrower-level audit trail).
  await logBorrowerActivity(
    borrowerId,
    'RISK_RATING_CALCULATED',
    `Preliminary risk rating: ${effectiveRating}`,
    `Score ${totalScore}; base ${baseRiskRating}${capsApplied.length ? `; caps: ${capsApplied.join(', ')}` : ''}`,
    calculatedById,
  );

  return {
    borrowerRiskRun,
    totalScore,
    baseRiskRating,
    effectiveRiskRating: effectiveRating,
    bureauCapsApplied: capsApplied,
    reasonCodes,
    missingInputs,
  };
}

export async function getLatestBorrowerRiskRun(borrowerId: string) {
  return prisma.borrowerRiskRun.findFirst({
    where: { borrowerProfileId: borrowerId },
    orderBy: { runAt: 'desc' },
  });
}

export async function getBorrowerRiskHistory(borrowerId: string) {
  return prisma.borrowerRiskRun.findMany({
    where: { borrowerProfileId: borrowerId },
    orderBy: { runAt: 'desc' },
    take: 50,
  });
}