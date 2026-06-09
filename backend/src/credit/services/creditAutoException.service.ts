import prisma from '../../utils/prisma';
import { callAi } from './credit-ai.service';

export interface PolicyException {
  policyRef: string;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation: string;
}

export interface AutoExceptionResult {
  exceptions: PolicyException[];
  interactionId: string;
  model: string;
  costUsd: number;
}

export async function detectPolicyExceptions(applicationId: string, userId: string): Promise<AutoExceptionResult> {
  const application = await prisma.creditApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      borrowerProfile: {
        select: {
          creditRiskRating: true,
          totalExposure: true,
          exposureLimit: true,
          borrowerType: true,
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
      scoreRuns: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { totalScore: true, riskRating: true },
      },
    },
  });

  const bp = application.borrowerProfile as any;
  const totalRequested = application.facilities.reduce(
    (sum: number, f: any) => sum + Number(f.amount ?? 0), 0
  );
  const projectedExposure = Number(bp?.totalExposure ?? 0) + totalRequested;

  const detectedRuleBreaches: string[] = [];
  if (bp?.exposureLimit && projectedExposure > Number(bp.exposureLimit)) {
    detectedRuleBreaches.push(`Projected exposure ${projectedExposure.toLocaleString()} exceeds borrower limit ${Number(bp.exposureLimit).toLocaleString()}`);
  }
  if (bp?.creditRiskRating === 'WATCH' || bp?.creditRiskRating === 'SUBSTANDARD') {
    detectedRuleBreaches.push(`New facility proposed for borrower with risk rating: ${bp.creditRiskRating}`);
  }

  const result = await callAi<{ exceptions: PolicyException[] }>({
    feature: 'A15_EXCEPTION',
    entityType: 'CREDIT_APPLICATION',
    entityId: applicationId,
    userId,
    buildMessages: (template) => [
      { role: 'system', content: template },
      {
        role: 'user',
        content: JSON.stringify({
          borrowerType: bp?.borrowerType,
          riskRating: bp?.creditRiskRating,
          totalExposure: bp?.totalExposure,
          exposureLimit: bp?.exposureLimit,
          projectedExposure,
          facilities: application.facilities,
          scorecard: application.scoreRuns[0] ?? null,
          deterministicBreaches: detectedRuleBreaches,
          instruction: 'Explain each policy exception in plain language for the credit officer. Include the relevant policy reference (e.g. "Credit Policy §4.2"), what the exception is, and what approvals or mitigants would typically be required.',
        }),
      },
    ],
  });

  return {
    exceptions: result.output.exceptions,
    interactionId: result.interactionId,
    model: result.model,
    costUsd: result.costUsd,
  };
}