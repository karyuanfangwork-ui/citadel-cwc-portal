import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';

export interface UpsertExposureSummaryData {
  thisAppSecured?: string | number | null;
  thisAppUnsecured?: string | number | null;
  otherAppSecured?: string | number | null;
  otherAppUnsecured?: string | number | null;
  customerTotalSecured?: string | number | null;
  customerTotalUnsecured?: string | number | null;
  relatedCounterpartySecured?: string | number | null;
  relatedCounterpartyUnsecured?: string | number | null;
  groupTotalSecured?: string | number | null;
  groupTotalUnsecured?: string | number | null;
}

const toDecimal = (v: string | number | null | undefined) =>
  v != null ? new Prisma.Decimal(v) : null;

class ExposureSummaryService {
  async getByApplication(applicationId: string) {
    return prisma.exposureSummary.findUnique({ where: { applicationId } });
  }

  async upsert(applicationId: string, data: UpsertExposureSummaryData) {
    const payload = {
      thisAppSecured: toDecimal(data.thisAppSecured),
      thisAppUnsecured: toDecimal(data.thisAppUnsecured),
      otherAppSecured: toDecimal(data.otherAppSecured),
      otherAppUnsecured: toDecimal(data.otherAppUnsecured),
      customerTotalSecured: toDecimal(data.customerTotalSecured),
      customerTotalUnsecured: toDecimal(data.customerTotalUnsecured),
      relatedCounterpartySecured: toDecimal(data.relatedCounterpartySecured),
      relatedCounterpartyUnsecured: toDecimal(data.relatedCounterpartyUnsecured),
      groupTotalSecured: toDecimal(data.groupTotalSecured),
      groupTotalUnsecured: toDecimal(data.groupTotalUnsecured),
    };

    return prisma.exposureSummary.upsert({
      where: { applicationId },
      update: payload,
      create: { applicationId, ...payload },
    });
  }
}

export const exposureSummaryService = new ExposureSummaryService();
