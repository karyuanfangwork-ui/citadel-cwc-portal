import prisma from '../../utils/prisma';
import { EsgGuidingPrinciple, EsgCategory } from '@prisma/client';

export interface UpsertEsgData {
  assignedGp?: EsgGuidingPrinciple | null;
  assignedCategory?: EsgCategory | null;
  justification?: string | null;
  mitigatingFactors?: string | null;
}

export async function getByApplication(applicationId: string) {
  return prisma.esgAssessment.findUnique({ where: { applicationId } });
}

export async function upsert(applicationId: string, data: UpsertEsgData) {
  return prisma.esgAssessment.upsert({
    where: { applicationId },
    create: { applicationId, ...data },
    update: data,
  });
}
