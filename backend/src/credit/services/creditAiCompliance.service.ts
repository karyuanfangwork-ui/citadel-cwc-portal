import prisma from '../../utils/prisma';
import { callAi } from './credit-ai.service';

export interface ComplianceConcern {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  field: string;
  issue: string;
  recommendation: string;
}

export interface ComplianceCheckResult {
  concerns: ComplianceConcern[];
  interactionId: string;
  model: string;
  costUsd: number;
}

export async function runAiComplianceCheck(applicationId: string, userId: string): Promise<ComplianceCheckResult> {
  const application = await prisma.creditApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      borrowerProfile: {
        select: {
          borrowerType: true,
          amlRiskTier: true,
          isSanctionedEntity: true,
        },
      },
      documents: {
        select: { classification: true, verificationStatus: true },
        where: { deletedAt: null },
      },
      bureauChecks: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { hasHits: true, findings: true, runDate: true },
      },
      conditions: {
        select: { conditionType: true, status: true, description: true },
      },
    },
  });

  const docSummary = application.documents.map((d) => ({
    type: d.classification,
    status: d.verificationStatus ?? 'PENDING',
  }));

  const result = await callAi<{ concerns: ComplianceConcern[] }>({
    feature: 'A13_COMPLIANCE',
    entityType: 'CREDIT_APPLICATION',
    entityId: applicationId,
    userId,
    buildMessages: (template) => [
      { role: 'system', content: template },
      {
        role: 'user',
        content: JSON.stringify({
          borrowerType: application.borrowerProfile?.borrowerType,
          amlRiskTier: application.borrowerProfile?.amlRiskTier,
          isSanctioned: application.borrowerProfile?.isSanctionedEntity,
          documents: docSummary,
          bureauHasHits: application.bureauChecks[0]?.hasHits ?? null,
          openConditions: application.conditions.filter((c: any) => c.status === 'PENDING').length,
          instruction: 'Do NOT repeat deterministic failures (expired docs are handled separately). Focus on soft compliance concerns: logical inconsistencies, missing supporting narratives, incomplete risk declarations, or fields that seem implausible given context.',
        }),
      },
    ],
  });

  return {
    concerns: result.output.concerns,
    interactionId: result.interactionId,
    model: result.model,
    costUsd: result.costUsd,
  };
}