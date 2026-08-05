import prisma from '../../utils/prisma';
import { RiskCategory } from '@prisma/client';
import { AuditChainService } from './auditChain.service';

export interface RiskAssessmentInput {
  riskCategory: RiskCategory;
  description?: string | null;
  mitigation?: string | null;
  sortOrder?: number;
}

export async function listByApplication(applicationId: string) {
  return prisma.riskAssessment.findMany({
    where: { applicationId },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function bulkUpsert(applicationId: string, items: RiskAssessmentInput[], actorId?: string) {
  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      await tx.riskAssessment.upsert({
        where: { applicationId_riskCategory: { applicationId, riskCategory: item.riskCategory } },
        create: {
          applicationId,
          riskCategory: item.riskCategory,
          description: item.description ?? null,
          mitigation: item.mitigation ?? null,
          sortOrder: item.sortOrder ?? 0,
        },
        update: {
          description: item.description ?? null,
          mitigation: item.mitigation ?? null,
          sortOrder: item.sortOrder ?? undefined,
        },
      });
    }

    await AuditChainService.appendEvent(
      applicationId,
      'RISK_ASSESSMENT_UPSERTED',
      actorId ?? null,
      'bulk_upsert',
      undefined,
      'RISK_ASSESSMENT_UPSERTED',
      { itemCount: items.length, riskCategories: items.map(i => i.riskCategory) },
      tx,
    );
  });

  return listByApplication(applicationId);
}