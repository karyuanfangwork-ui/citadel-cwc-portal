import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';

export interface ProfitabilityLineInput {
  productCategory: string;
  netProfitYtd?: string | null;
  netProfitProjected?: string | null;
  feeIncomeYtd?: string | null;
  feeIncomeProjected?: string | null;
  displayOrder?: number;
}

export interface UpsertProfitabilityData {
  reportingPeriod?: string | null;
  notes?: string | null;
  lines?: ProfitabilityLineInput[];
}

export async function getByApplication(applicationId: string) {
  return prisma.accountProfitability.findUnique({
    where: { applicationId },
    include: { lines: { orderBy: { displayOrder: 'asc' } } },
  });
}

export async function upsert(applicationId: string, data: UpsertProfitabilityData) {
  const { lines, ...header } = data;

  const profitability = await prisma.accountProfitability.upsert({
    where: { applicationId },
    create: {
      applicationId,
      reportingPeriod: header.reportingPeriod ?? null,
      notes: header.notes ?? null,
    },
    update: {
      reportingPeriod: header.reportingPeriod ?? null,
      notes: header.notes ?? null,
    },
  });

  if (lines && lines.length > 0) {
    for (const line of lines) {
      await prisma.profitabilityLine.upsert({
        where: { profitabilityId_productCategory: { profitabilityId: profitability.id, productCategory: line.productCategory } },
        create: {
          profitabilityId: profitability.id,
          productCategory: line.productCategory,
          netProfitYtd: line.netProfitYtd ? new Prisma.Decimal(line.netProfitYtd) : null,
          netProfitProjected: line.netProfitProjected ? new Prisma.Decimal(line.netProfitProjected) : null,
          feeIncomeYtd: line.feeIncomeYtd ? new Prisma.Decimal(line.feeIncomeYtd) : null,
          feeIncomeProjected: line.feeIncomeProjected ? new Prisma.Decimal(line.feeIncomeProjected) : null,
          displayOrder: line.displayOrder ?? 0,
        },
        update: {
          netProfitYtd: line.netProfitYtd ? new Prisma.Decimal(line.netProfitYtd) : null,
          netProfitProjected: line.netProfitProjected ? new Prisma.Decimal(line.netProfitProjected) : null,
          feeIncomeYtd: line.feeIncomeYtd ? new Prisma.Decimal(line.feeIncomeYtd) : null,
          feeIncomeProjected: line.feeIncomeProjected ? new Prisma.Decimal(line.feeIncomeProjected) : null,
          displayOrder: line.displayOrder ?? 0,
        },
      });
    }
  }

  return getByApplication(applicationId);
}
