import prisma from '../../utils/prisma';

export interface UpsertIndustryData {
  sectorName?: string | null;
  subsectorName?: string | null;
  sectorOutlook?: string | null;
  subsectorOutlook?: string | null;
}

export async function getByApplication(applicationId: string) {
  return prisma.industryAssessment.findUnique({ where: { applicationId } });
}

export async function upsert(applicationId: string, data: UpsertIndustryData) {
  return prisma.industryAssessment.upsert({
    where: { applicationId },
    create: { applicationId, ...data },
    update: data,
  });
}
