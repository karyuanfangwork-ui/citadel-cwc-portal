import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';

export interface RetailIncomeInput {
  employmentType: 'SALARIED' | 'SELF_EMPLOYED' | 'COMMISSION_BASED' | 'PENSIONER';
  employerName?: string;
  monthlyGrossIncome: number;
  epfMonthlyAmount?: number;
  hirePurchaseCommitment?: number;
  creditCardCommitment?: number;
  existingLoanCommitment?: number;
  otherCommitments?: number;
  proposedInstalment?: number;
}

export interface DsrInput {
  monthlyGrossIncome: number;
  hirePurchaseCommitment: number;
  creditCardCommitment: number;
  existingLoanCommitment: number;
  otherCommitments: number;
  proposedInstalment: number;
}

export function computeDsr(input: DsrInput): number {
  if (input.monthlyGrossIncome <= 0) return 0;
  const total =
    (input.hirePurchaseCommitment || 0) +
    (input.creditCardCommitment || 0) +
    (input.existingLoanCommitment || 0) +
    (input.otherCommitments || 0) +
    (input.proposedInstalment || 0);
  return (total / input.monthlyGrossIncome) * 100;
}

export function getDsrStatus(dsrPercent: number): 'pass' | 'warning' | 'fail' {
  if (dsrPercent <= 60) return 'pass';
  if (dsrPercent <= 70) return 'warning';
  return 'fail';
}

export async function upsertRetailIncome(applicationId: string, input: RetailIncomeInput) {
  const dsr = computeDsr({
    monthlyGrossIncome: input.monthlyGrossIncome,
    hirePurchaseCommitment: input.hirePurchaseCommitment ?? 0,
    creditCardCommitment: input.creditCardCommitment ?? 0,
    existingLoanCommitment: input.existingLoanCommitment ?? 0,
    otherCommitments: input.otherCommitments ?? 0,
    proposedInstalment: input.proposedInstalment ?? 0,
  });

  const data = {
    employmentType: input.employmentType,
    employerName: input.employerName ?? null,
    monthlyGrossIncome: new Prisma.Decimal(input.monthlyGrossIncome),
    epfMonthlyAmount: input.epfMonthlyAmount != null ? new Prisma.Decimal(input.epfMonthlyAmount) : null,
    hirePurchaseCommitment: new Prisma.Decimal(input.hirePurchaseCommitment ?? 0),
    creditCardCommitment: new Prisma.Decimal(input.creditCardCommitment ?? 0),
    existingLoanCommitment: new Prisma.Decimal(input.existingLoanCommitment ?? 0),
    otherCommitments: new Prisma.Decimal(input.otherCommitments ?? 0),
    proposedInstalment: input.proposedInstalment != null ? new Prisma.Decimal(input.proposedInstalment) : null,
    dsrPercent: new Prisma.Decimal(Math.round(dsr * 100) / 100),
  };

  return prisma.retailIncome.upsert({
    where: { applicationId },
    create: { applicationId, ...data },
    update: data,
  });
}

export async function getRetailIncome(applicationId: string) {
  return prisma.retailIncome.findUnique({ where: { applicationId } });
}

export async function verifyFinancials(applicationId: string, verified: boolean) {
  return prisma.retailIncome.update({
    where: { applicationId },
    data: {
      financialsVerified: verified,
      financialsVerifiedAt: verified ? new Date() : null,
    },
  });
}
