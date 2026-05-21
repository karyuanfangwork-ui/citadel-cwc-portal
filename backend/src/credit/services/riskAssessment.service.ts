import prisma from '../../utils/prisma';
import { RiskCategory } from '@prisma/client';

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

export async function bulkUpsert(applicationId: string, items: RiskAssessmentInput[]) {
  for (const item of items) {
    await prisma.riskAssessment.upsert({
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
  return listByApplication(applicationId);
}
