// ============================================================================
// FORECAST CATEGORY TYPES
// ============================================================================

export type ForecastCategory = 'PIPELINE' | 'BEST_CASE' | 'COMMIT' | 'OMITTED';

export const FORECAST_CATEGORIES: ForecastCategory[] = ['PIPELINE', 'BEST_CASE', 'COMMIT', 'OMITTED'];

export interface ForecastCategoryBreakdown {
  totalValue: number;
  weightedValue: number;
  dealCount: number;
}

export type ForecastByCategoryResult = Record<ForecastCategory, ForecastCategoryBreakdown>;

export interface ForecastAccuracyResult {
  commitTotal: number;
  actualWonTotal: number;
  accuracyPct: number;
  period: { from: Date; to: Date };
}

// ============================================================================
// CATEGORY GROUPING (pure function — easy to test)
// ============================================================================

interface OpportunityForForecast {
  id: string;
  value: bigint | number;
  probability: number;
  forecastCategory: string;
}

export function groupForecastByCategory(opps: OpportunityForForecast[]): ForecastByCategoryResult {
  const result: ForecastByCategoryResult = {
    PIPELINE:  { totalValue: 0, weightedValue: 0, dealCount: 0 },
    BEST_CASE: { totalValue: 0, weightedValue: 0, dealCount: 0 },
    COMMIT:    { totalValue: 0, weightedValue: 0, dealCount: 0 },
    OMITTED:  { totalValue: 0, weightedValue: 0, dealCount: 0 },
  };

  for (const opp of opps) {
    // Normalise aliases
    let cat: ForecastCategory = opp.forecastCategory as ForecastCategory;
    if (cat === 'BEST_CASE') cat = 'BEST_CASE'; // both accepted

    if (!result[cat]) cat = 'PIPELINE'; // fallback

    const val = Number(opp.value);
    result[cat].totalValue += val;
    result[cat].weightedValue += Math.round((val * opp.probability) / 100);
    result[cat].dealCount += 1;
  }

  return result;
}

// ============================================================================
// FORECAST ACCURACY (pure function — easy to test)
// ============================================================================

export function getForecastAccuracy(
  commitTotal: number,
  actualWonTotal: number,
  period?: { from: Date; to: Date }
): ForecastAccuracyResult {
  let accuracyPct = 0;
  if (commitTotal > 0 && actualWonTotal > 0) {
    accuracyPct = Math.min(100, Math.round((actualWonTotal / commitTotal) * 100));
  } else if (commitTotal === 0 && actualWonTotal === 0) {
    accuracyPct = 0;
  }

  return {
    commitTotal,
    actualWonTotal,
    accuracyPct,
    period: period ?? { from: new Date(), to: new Date() },
  };
}

// ============================================================================
// DB-BOUND FORECAST REPORTS
// ============================================================================

import prisma from '../utils/prisma';

type VisibleOwnerIds = string[] | null;

function ownerScope(visibleOwnerIds: VisibleOwnerIds) {
  return visibleOwnerIds === null ? {} : { ownerId: { in: visibleOwnerIds } };
}

/**
 * Fetch opportunities grouped by forecastCategory for a pipeline,
 * returning both stage and category breakdowns.
 */
export async function getPipelineForecastWithCategories(pipelineId: string, visibleOwnerIds: VisibleOwnerIds = null) {
  const scopedOpportunityWhere = { deletedAt: null, ...ownerScope(visibleOwnerIds) };
  // Stage-level breakdown (existing logic, now also includes forecastCategory)
  const stages = await prisma.crmPipelineStage.findMany({
    where: { pipelineId },
    orderBy: { displayOrder: 'asc' },
    include: {
      opportunities: {
        where: scopedOpportunityWhere,
        select: {
          id: true,
          value: true,
          probability: true,
          forecastCategory: true,
          expectedCloseDate: true,
        },
      },
    },
  });

  const allOpps = stages.flatMap((s) => s.opportunities);
  const categoryBreakdown = groupForecastByCategory(allOpps as any);

  const stageReports = stages.map((stage) => {
    const deals = stage.opportunities;
    const totalValue = deals.reduce((sum, o) => sum + Number(o.value), 0);
    const probabilityPct = stage.probability || 0;
    const weightedValue = (totalValue * probabilityPct) / 100;

    return {
      stageId: stage.id,
      stageName: stage.name,
      probability: probabilityPct,
      dealCount: deals.length,
      totalValue,
      weightedValue: Math.round(weightedValue),
      categories: groupForecastByCategory(deals as any),
    };
  });

  const totalPipelineValue = stageReports.reduce((sum, s) => sum + s.totalValue, 0);
  const weightedPipelineValue = stageReports.reduce((sum, s) => sum + s.weightedValue, 0);

  // Overdue count
  const overdueCount = await prisma.crmOpportunity.count({
    where: {
      pipelineId,
      ...ownerScope(visibleOwnerIds),
      expectedCloseDate: { lt: new Date() },
      wonAt: null,
      lostAt: null,
      deletedAt: null,
      stage: { isWonStage: false, isLostStage: false },
    },
  });

  const overdueValue = await prisma.crmOpportunity.aggregate({
    _sum: { value: true },
    where: {
      pipelineId,
      ...ownerScope(visibleOwnerIds),
      expectedCloseDate: { lt: new Date() },
      wonAt: null,
      lostAt: null,
      deletedAt: null,
      stage: { isWonStage: false, isLostStage: false },
    },
  });

  return {
    stages: stageReports,
    categoryBreakdown,
    totalPipelineValue,
    weightedPipelineValue,
    overdueDeals: overdueCount,
    overdueValue: Number(overdueValue._sum?.value ?? 0),
  };
}

/**
 * Forecast accuracy: compare past period's COMMIT total vs actual won revenue.
 */
export async function getForecastAccuracyReport(period: { from: Date; to: Date }, visibleOwnerIds: VisibleOwnerIds = null) {
  // COMMIT total for the period
  const commitOpps = await prisma.crmOpportunity.findMany({
    where: {
      forecastCategory: 'COMMIT',
      createdAt: { gte: period.from, lte: period.to },
      deletedAt: null,
      ...ownerScope(visibleOwnerIds),
    },
    select: { value: true },
  });
  const commitTotal = commitOpps.reduce((sum, o) => sum + Number(o.value), 0);

  // Actual won revenue in that period
  const wonOpps = await prisma.crmOpportunity.findMany({
    where: {
      wonAt: { gte: period.from, lte: period.to },
      deletedAt: null,
      ...ownerScope(visibleOwnerIds),
    },
    select: { value: true },
  });
  const actualWonTotal = wonOpps.reduce((sum, o) => sum + Number(o.value), 0);

  return getForecastAccuracy(commitTotal, actualWonTotal, period);
}
