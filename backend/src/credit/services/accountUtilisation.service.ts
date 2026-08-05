import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';

export interface AccountUtilisationInput {
  accountNo: string;
  facilityType: string;
  snapshotMonth: string; // ISO date string, first day of month
  withdrawalAmount?: string | null;
  depositAmount?: string | null;
  monthEndBalance?: string | null;
  returnedChequesCount?: number | null;
  approvedLimit?: string | null;
  outstandingAmount?: string | null;
  overdueAmount?: string | null;
  instalmentsInArrears?: number | null;
}

export async function listByApplication(applicationId: string) {
  return prisma.accountUtilisationSnapshot.findMany({
    where: { applicationId },
    orderBy: [{ accountNo: 'asc' }, { snapshotMonth: 'asc' }],
  });
}

export async function upsert(applicationId: string, data: AccountUtilisationInput) {
  const snapshotMonth = new Date(data.snapshotMonth);
  return prisma.accountUtilisationSnapshot.upsert({
    where: { applicationId_accountNo_snapshotMonth: { applicationId, accountNo: data.accountNo, snapshotMonth } },
    create: {
      applicationId,
      accountNo: data.accountNo,
      facilityType: data.facilityType,
      snapshotMonth,
      withdrawalAmount: data.withdrawalAmount ? new Prisma.Decimal(data.withdrawalAmount) : null,
      depositAmount: data.depositAmount ? new Prisma.Decimal(data.depositAmount) : null,
      monthEndBalance: data.monthEndBalance ? new Prisma.Decimal(data.monthEndBalance) : null,
      returnedChequesCount: data.returnedChequesCount ?? null,
      approvedLimit: data.approvedLimit ? new Prisma.Decimal(data.approvedLimit) : null,
      outstandingAmount: data.outstandingAmount ? new Prisma.Decimal(data.outstandingAmount) : null,
      overdueAmount: data.overdueAmount ? new Prisma.Decimal(data.overdueAmount) : null,
      instalmentsInArrears: data.instalmentsInArrears ?? null,
    },
    update: {
      facilityType: data.facilityType,
      withdrawalAmount: data.withdrawalAmount ? new Prisma.Decimal(data.withdrawalAmount) : null,
      depositAmount: data.depositAmount ? new Prisma.Decimal(data.depositAmount) : null,
      monthEndBalance: data.monthEndBalance ? new Prisma.Decimal(data.monthEndBalance) : null,
      returnedChequesCount: data.returnedChequesCount ?? null,
      approvedLimit: data.approvedLimit ? new Prisma.Decimal(data.approvedLimit) : null,
      outstandingAmount: data.outstandingAmount ? new Prisma.Decimal(data.outstandingAmount) : null,
      overdueAmount: data.overdueAmount ? new Prisma.Decimal(data.overdueAmount) : null,
      instalmentsInArrears: data.instalmentsInArrears ?? null,
    },
  });
}

export async function remove(id: string) {
  return prisma.accountUtilisationSnapshot.delete({ where: { id } });
}
