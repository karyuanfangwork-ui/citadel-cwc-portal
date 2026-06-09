import prisma from '../../utils/prisma';
import { callAi } from './credit-ai.service';
import { evaluateRatioThreshold } from './financial.service';

export interface RedFlag {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  evidence: string;
  rationale: string;
}

export interface RedFlagResult {
  flags: RedFlag[];
  overallRisk: 'HIGH' | 'MEDIUM' | 'LOW';
  interactionId: string;
  model: string;
  costUsd: number;
}

export async function generateRedFlags(applicationId: string, userId: string): Promise<RedFlagResult> {
  const application = await prisma.creditApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      borrowerProfile: {
        select: {
          name: true,
          creditRiskRating: true,
          financialStatements: {
            orderBy: { fiscalYearEnd: 'desc' },
            take: 3,
            include: { ratios: true },
          },
        },
      },
      facilities: { select: { facilityType: true, amount: true } },
    },
  });

  const bp = application.borrowerProfile as any;

  // Build ratio summary for the prompt (no raw financials — just ratios)
  const stmts = bp?.financialStatements ?? [];
  const ratioSummary = stmts.map((stmt: any) => {
    const ratioMap: Record<string, { value: number; status: string }> = {};
    for (const ratio of stmt.ratios) {
      ratioMap[ratio.ratioKey] = {
        value: Number(ratio.value),
        status: evaluateRatioThreshold(ratio.ratioKey, Number(ratio.value)),
      };
    }
    return { period: stmt.fiscalYearEnd?.toISOString().slice(0, 10), ratios: ratioMap };
  });

  const deterministicWarnings = stmts
    .flatMap((stmt: any) =>
      stmt.ratios
        .filter((r: any) => evaluateRatioThreshold(r.ratioKey, Number(r.value)) === 'fail')
        .map((r: any) => `${r.ratioKey}: ${Number(r.value).toFixed(2)} (FAIL threshold)`)
    );

  const result = await callAi<{ flags: RedFlag[]; overallRisk: 'HIGH' | 'MEDIUM' | 'LOW' }>({
    feature: 'A5_RED_FLAG',
    entityType: 'CREDIT_APPLICATION',
    entityId: applicationId,
    userId,
    buildMessages: (template) => [
      { role: 'system', content: template },
      {
        role: 'user',
        content: JSON.stringify({
          applicationId,
          borrower: bp?.name,
          riskRating: bp?.creditRiskRating,
          facilities: application.facilities,
          ratioHistory: ratioSummary,
          deterministicFailFlags: deterministicWarnings,
          instruction: 'Identify red flags beyond the deterministic failures already listed. Focus on trends, inconsistencies, and contextual anomalies.',
        }),
      },
    ],
  });

  return {
    flags: result.output.flags,
    overallRisk: result.output.overallRisk,
    interactionId: result.interactionId,
    model: result.model,
    costUsd: result.costUsd,
  };
}