import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';

export interface RetailIncomeInput {
  employmentType: 'SALARIED' | 'SELF_EMPLOYED' | 'COMMISSION_BASED' | 'PENSIONER';
  employerName?: string;
  monthlyGrossIncome: number;
  epfMonthlyAmount?: number;
  monthlyTaxDeduction?: number;
  monthlySocsoDeduction?: number;
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

export interface NetDsrInput extends DsrInput {
  epfMonthlyAmount: number;
  monthlyTaxDeduction: number;
  monthlySocsoDeduction: number;
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

/**
 * P1-3 — Net-income DSR computation.
 * Net income = gross - EPF - tax - SOCSO
 * Net-DSR = total commitments / net income * 100
 * Thresholds (tighter than gross): pass ≤50%, warning ≤60%, fail >60%
 */
export function computeNetDsr(input: NetDsrInput): {
  netDsrPercent: number;
  grossDsrPercent: number;
  netIncome: number;
  dsrBasis: 'NET' | 'GROSS';
  dsrStatus: 'pass' | 'warning' | 'fail';
} {
  const totalCommitments =
    (input.hirePurchaseCommitment || 0) +
    (input.creditCardCommitment || 0) +
    (input.existingLoanCommitment || 0) +
    (input.otherCommitments || 0) +
    (input.proposedInstalment || 0);

  const grossDsrPercent = input.monthlyGrossIncome > 0
    ? (totalCommitments / input.monthlyGrossIncome) * 100
    : 0;

  const netIncome =
    input.monthlyGrossIncome -
    (input.epfMonthlyAmount || 0) -
    (input.monthlyTaxDeduction || 0) -
    (input.monthlySocsoDeduction || 0);

  // If net income is zero or negative, DSR is infinite → automatic fail
  const netDsrPercent = netIncome > 0
    ? (totalCommitments / netIncome) * 100
    : 9999;

  // Net-DSR has tighter thresholds than gross
  const dsrStatus: 'pass' | 'warning' | 'fail' = netDsrPercent <= 50
    ? 'pass'
    : netDsrPercent <= 60
      ? 'warning'
      : 'fail';

  const dsrBasis: 'NET' | 'GROSS' = netIncome > 0 ? 'NET' : 'GROSS';

  return { netDsrPercent, grossDsrPercent, netIncome, dsrBasis, dsrStatus };
}

export function getDsrStatus(dsrPercent: number): 'pass' | 'warning' | 'fail' {
  if (dsrPercent <= 60) return 'pass';
  if (dsrPercent <= 70) return 'warning';
  return 'fail';
}

/**
 * P1-3 — Net-DSR status with tighter thresholds (50/60).
 * Used for readiness checks where net-DSR is the binding constraint.
 */
export function getNetDsrStatus(netDsrPercent: number): 'pass' | 'warning' | 'fail' {
  if (netDsrPercent <= 50) return 'pass';
  if (netDsrPercent <= 60) return 'warning';
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

  // P1-3 — Compute net DSR
  const netDsrResult = computeNetDsr({
    monthlyGrossIncome: input.monthlyGrossIncome,
    hirePurchaseCommitment: input.hirePurchaseCommitment ?? 0,
    creditCardCommitment: input.creditCardCommitment ?? 0,
    existingLoanCommitment: input.existingLoanCommitment ?? 0,
    otherCommitments: input.otherCommitments ?? 0,
    proposedInstalment: input.proposedInstalment ?? 0,
    epfMonthlyAmount: input.epfMonthlyAmount ?? 0,
    monthlyTaxDeduction: input.monthlyTaxDeduction ?? 0,
    monthlySocsoDeduction: input.monthlySocsoDeduction ?? 0,
  });

  const data = {
    employmentType: input.employmentType,
    employerName: input.employerName ?? null,
    monthlyGrossIncome: new Prisma.Decimal(input.monthlyGrossIncome),
    epfMonthlyAmount: input.epfMonthlyAmount != null ? new Prisma.Decimal(input.epfMonthlyAmount) : null,
    monthlyTaxDeduction: input.monthlyTaxDeduction != null ? new Prisma.Decimal(input.monthlyTaxDeduction) : new Prisma.Decimal(0),
    monthlySocsoDeduction: input.monthlySocsoDeduction != null ? new Prisma.Decimal(input.monthlySocsoDeduction) : new Prisma.Decimal(0),
    hirePurchaseCommitment: new Prisma.Decimal(input.hirePurchaseCommitment ?? 0),
    creditCardCommitment: new Prisma.Decimal(input.creditCardCommitment ?? 0),
    existingLoanCommitment: new Prisma.Decimal(input.existingLoanCommitment ?? 0),
    otherCommitments: new Prisma.Decimal(input.otherCommitments ?? 0),
    proposedInstalment: input.proposedInstalment != null ? new Prisma.Decimal(input.proposedInstalment) : null,
    dsrPercent: new Prisma.Decimal(Math.round(dsr * 100) / 100),
    monthlyNetIncome: netDsrResult.netIncome > 0 ? new Prisma.Decimal(Math.round(netDsrResult.netIncome * 100) / 100) : null,
    netDsrPercent: new Prisma.Decimal(Math.round(netDsrResult.netDsrPercent * 100) / 100),
    dsrBasis: netDsrResult.dsrBasis,
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
