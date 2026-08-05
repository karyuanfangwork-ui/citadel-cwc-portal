import prisma from '../../utils/prisma';
import { callAi } from './credit-ai.service';

export interface RiskNarrativeResult {
  narrative: string;
  keyRisks: string[];
  keyStrengths: string[];
  citedFields: string[];
  interactionId: string;
  model: string;
  costUsd: number;
}

export async function generateRiskNarrative(applicationId: string, userId: string): Promise<RiskNarrativeResult> {
  const application = await prisma.creditApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      borrowerProfile: {
        select: {
          name: true,
          creditRiskRating: true,
          borrowerType: true,
          totalExposure: true,
          financialStatements: {
            orderBy: { fiscalYearEnd: 'desc' },
            take: 3,
            include: { ratios: { select: { ratioKey: true, value: true } } },
          },
        },
      },
      facilities: {
        select: {
          facilityType: true,
          amount: true,
          tenorMonths: true,
          purpose: true,
        },
      },
      qualitativeAssessment: {
        select: {
          managementScore: true,
          relationshipScore: true,
          industryScore: true,
          collateralScore: true,
        },
      },
      scoreRuns: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { totalScore: true, riskRating: true },
      },
      collateralApplicationLinks: {
        include: { collateral: { select: { collateralType: true, marketValue: true } } },
        take: 5,
      },
    },
  });

  const bp = application.borrowerProfile as any;
  const latestRatios = bp?.financialStatements?.[0]?.ratios ?? [];
  const ratioSummary: Record<string, number> = {};
  for (const r of latestRatios) {
    ratioSummary[r.ratioKey] = Number(r.value);
  }

  const result = await callAi<{
    narrative: string;
    keyRisks: string[];
    keyStrengths: string[];
    citedFields: string[];
  }>({
    feature: 'A4_RISK_NARRATIVE',
    entityType: 'CREDIT_APPLICATION',
    entityId: applicationId,
    userId,
    buildMessages: (template) => [
      { role: 'system', content: template },
      {
        role: 'user',
        content: JSON.stringify({
          borrower: bp?.name,
          borrowerType: bp?.borrowerType,
          riskRating: bp?.creditRiskRating,
          totalExposure: bp?.totalExposure,
          facilities: application.facilities,
          latestRatios: ratioSummary,
          qualitativeAssessment: application.qualitativeAssessment,
          scorecard: application.scoreRuns[0] ?? null,
          collaterals: application.collateralApplicationLinks.map((l: any) => l.collateral),
          instruction: 'Write 2–4 paragraphs suitable for the Risk section of a credit approval memorandum. Be factual, cite specific ratios or amounts where relevant, and maintain formal credit officer tone.',
        }),
      },
    ],
    maxTokens: 1200,
  });

  return {
    narrative: result.output.narrative,
    keyRisks: result.output.keyRisks,
    keyStrengths: result.output.keyStrengths,
    citedFields: result.output.citedFields,
    interactionId: result.interactionId,
    model: result.model,
    costUsd: result.costUsd,
  };
}