import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';

export interface WalletShareInput {
  facilityType: string;
  ourLimitAmount?: string | null;
  totalMarketAmount?: string | null;
  ourSharePct?: string | null;
  yoyChangePct?: string | null;
  notes?: string | null;
}

export async function listByApplication(applicationId: string) {
  return prisma.walletShare.findMany({
    where: { applicationId },
    orderBy: { facilityType: 'asc' },
  });
}

export async function bulkUpsert(applicationId: string, shares: WalletShareInput[]) {
  for (const s of shares) {
    await prisma.walletShare.upsert({
      where: { applicationId_facilityType: { applicationId, facilityType: s.facilityType } },
      create: {
        applicationId,
        facilityType: s.facilityType,
        ourLimitAmount: s.ourLimitAmount ? new Prisma.Decimal(s.ourLimitAmount) : null,
        totalMarketAmount: s.totalMarketAmount ? new Prisma.Decimal(s.totalMarketAmount) : null,
        ourSharePct: s.ourSharePct ? new Prisma.Decimal(s.ourSharePct) : null,
        yoyChangePct: s.yoyChangePct ? new Prisma.Decimal(s.yoyChangePct) : null,
        notes: s.notes ?? null,
      },
      update: {
        ourLimitAmount: s.ourLimitAmount ? new Prisma.Decimal(s.ourLimitAmount) : null,
        totalMarketAmount: s.totalMarketAmount ? new Prisma.Decimal(s.totalMarketAmount) : null,
        ourSharePct: s.ourSharePct ? new Prisma.Decimal(s.ourSharePct) : null,
        yoyChangePct: s.yoyChangePct ? new Prisma.Decimal(s.yoyChangePct) : null,
        notes: s.notes ?? null,
      },
    });
  }
  return listByApplication(applicationId);
}

export async function remove(id: string) {
  return prisma.walletShare.delete({ where: { id } });
}
