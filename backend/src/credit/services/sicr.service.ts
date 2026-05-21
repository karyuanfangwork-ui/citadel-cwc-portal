import prisma from '../../utils/prisma';
import { SicrTriggerType, AccountClassification } from '@prisma/client';

export interface SicrAssessmentInput {
  triggerType: SicrTriggerType;
  triggeringEvent?: string | null;
  hasHit?: boolean | null;
  rationale?: string | null;
  resultingClassification?: AccountClassification | null;
}

export async function listByApplication(applicationId: string) {
  return prisma.sicrAssessment.findMany({
    where: { applicationId },
    orderBy: { triggerType: 'asc' },
  });
}

export async function bulkUpsert(applicationId: string, items: SicrAssessmentInput[]) {
  for (const item of items) {
    await prisma.sicrAssessment.upsert({
      where: { applicationId_triggerType: { applicationId, triggerType: item.triggerType } },
      create: {
        applicationId,
        triggerType: item.triggerType,
        triggeringEvent: item.triggeringEvent ?? null,
        hasHit: item.hasHit ?? null,
        rationale: item.rationale ?? null,
        resultingClassification: item.resultingClassification ?? null,
      },
      update: {
        triggeringEvent: item.triggeringEvent ?? null,
        hasHit: item.hasHit ?? null,
        rationale: item.rationale ?? null,
        resultingClassification: item.resultingClassification ?? null,
      },
    });
  }
  return listByApplication(applicationId);
}
