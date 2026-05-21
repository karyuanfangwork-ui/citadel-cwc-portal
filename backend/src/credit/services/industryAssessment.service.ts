import prisma from '../../utils/prisma';
import { AuditChainService } from './auditChain.service';

export interface UpsertIndustryData {
  sectorName?: string | null;
  subsectorName?: string | null;
  sectorOutlook?: string | null;
  subsectorOutlook?: string | null;
}

export async function getByApplication(applicationId: string) {
  return prisma.industryAssessment.findUnique({ where: { applicationId } });
}

export async function upsert(applicationId: string, data: UpsertIndustryData, actorId?: string) {
  const result = await prisma.$transaction(async (tx) => {
    const upserted = await tx.industryAssessment.upsert({
      where: { applicationId },
      create: { applicationId, ...data },
      update: data,
    });

    await AuditChainService.appendEvent(
      applicationId,
      'INDUSTRY_ASSESSMENT_UPSERTED',
      actorId ?? null,
      'upsert',
      undefined,
      'INDUSTRY_ASSESSMENT_UPSERTED',
      { sectorName: data.sectorName, subsectorName: data.subsectorName },
      tx,
    );

    return upserted;
  });

  return result;
}