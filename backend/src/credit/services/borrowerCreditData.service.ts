import { Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import { computeNetDsr } from './retailIncome.service';
import { logBorrowerActivity } from './borrowerActivity.service';

export interface IncomeInput {
  employmentType?: string | null;
  employerName?: string | null;
  monthlyGrossIncome: number;
  epfMonthlyAmount?: number;
  monthlyTaxDeduction?: number;
  monthlySocsoDeduction?: number;
  hirePurchaseCommitment?: number;
  creditCardCommitment?: number;
  existingLoanCommitment?: number;
  otherCommitments?: number;
}

export interface CreditProfileInput {
  creditScore?: number | null;
  scoreSource?: string | null;
  scoreAsOf?: string | Date | null;
  riskGrade?: string | null;
}

export interface BureauFacilityInput {
  facilityType: string;
  lender?: string | null;
  balance?: number | null;
  installment?: number | null;
  conductStatus?: string | null;
}

export interface BureauReportInput {
  source: string;
  reportDate?: string | null;
  fileName?: string | null;
  filePath?: string | null;
  facilities?: BureauFacilityInput[];
}

const toDecimal = (value?: number | string | null) => {
  if (value === null || value === undefined || value === '') return null;
  return new Prisma.Decimal(value);
};

export function scoreBandFor(score: number): string {
  if (score >= 750) return 'Excellent';
  if (score >= 680) return 'Good';
  if (score >= 600) return 'Fair';
  return 'Poor';
}

export function computeIncomeDsr(input: IncomeInput) {
  const result = computeNetDsr({
    monthlyGrossIncome: input.monthlyGrossIncome,
    hirePurchaseCommitment: input.hirePurchaseCommitment ?? 0,
    creditCardCommitment: input.creditCardCommitment ?? 0,
    existingLoanCommitment: input.existingLoanCommitment ?? 0,
    otherCommitments: input.otherCommitments ?? 0,
    proposedInstalment: 0,
    epfMonthlyAmount: input.epfMonthlyAmount ?? 0,
    monthlyTaxDeduction: input.monthlyTaxDeduction ?? 0,
    monthlySocsoDeduction: input.monthlySocsoDeduction ?? 0,
  });

  return {
    dsrPercent: result.grossDsrPercent,
    netDsrPercent: result.netDsrPercent,
    netIncome: result.netIncome,
    dsrBasis: result.dsrBasis,
  };
}

export function bureauFreshness(uploadedAt: Date | null, now: Date = new Date()) {
  if (!uploadedAt) {
    return { days: null as number | null, stale: true };
  }

  const days = Math.floor((now.getTime() - uploadedAt.getTime()) / 86_400_000);
  return { days, stale: days > 90 };
}

export async function upsertCreditProfile(borrowerId: string, data: CreditProfileInput) {
  const scoreBand = data.creditScore != null ? scoreBandFor(data.creditScore) : undefined;
  const scoreAsOf = data.scoreAsOf ? new Date(data.scoreAsOf) : null;

  const profile = await prisma.borrowerCreditProfile.upsert({
    where: { borrowerId },
    create: {
      borrowerId,
      creditScore: data.creditScore ?? null,
      scoreBand: scoreBand ?? null,
      scoreSource: data.scoreSource ?? null,
      scoreAsOf,
      riskGrade: data.riskGrade ?? null,
    },
    update: {
      creditScore: data.creditScore ?? null,
      scoreBand: scoreBand ?? null,
      scoreSource: data.scoreSource ?? null,
      scoreAsOf,
      riskGrade: data.riskGrade ?? null,
    },
  });

  await logBorrowerActivity(
    borrowerId,
    'SCORE_RECORDED',
    'Credit profile updated',
    data.creditScore != null ? `Score recorded as ${data.creditScore}` : 'Credit profile details updated',
  );

  return profile;
}

export async function upsertIncome(borrowerId: string, input: IncomeInput) {
  const dsr = computeIncomeDsr(input);

  const income = await prisma.borrowerIncome.upsert({
    where: { borrowerId },
    create: {
      borrowerId,
      employmentType: input.employmentType ?? null,
      employerName: input.employerName ?? null,
      monthlyGrossIncome: toDecimal(input.monthlyGrossIncome) ?? new Prisma.Decimal(0),
      epfMonthlyAmount: toDecimal(input.epfMonthlyAmount),
      monthlyTaxDeduction: toDecimal(input.monthlyTaxDeduction) ?? new Prisma.Decimal(0),
      monthlySocsoDeduction: toDecimal(input.monthlySocsoDeduction) ?? new Prisma.Decimal(0),
      hirePurchaseCommitment: toDecimal(input.hirePurchaseCommitment) ?? new Prisma.Decimal(0),
      creditCardCommitment: toDecimal(input.creditCardCommitment) ?? new Prisma.Decimal(0),
      existingLoanCommitment: toDecimal(input.existingLoanCommitment) ?? new Prisma.Decimal(0),
      otherCommitments: toDecimal(input.otherCommitments) ?? new Prisma.Decimal(0),
      monthlyNetIncome: toDecimal(dsr.netIncome),
    },
    update: {
      employmentType: input.employmentType ?? null,
      employerName: input.employerName ?? null,
      monthlyGrossIncome: toDecimal(input.monthlyGrossIncome) ?? new Prisma.Decimal(0),
      epfMonthlyAmount: toDecimal(input.epfMonthlyAmount),
      monthlyTaxDeduction: toDecimal(input.monthlyTaxDeduction) ?? new Prisma.Decimal(0),
      monthlySocsoDeduction: toDecimal(input.monthlySocsoDeduction) ?? new Prisma.Decimal(0),
      hirePurchaseCommitment: toDecimal(input.hirePurchaseCommitment) ?? new Prisma.Decimal(0),
      creditCardCommitment: toDecimal(input.creditCardCommitment) ?? new Prisma.Decimal(0),
      existingLoanCommitment: toDecimal(input.existingLoanCommitment) ?? new Prisma.Decimal(0),
      otherCommitments: toDecimal(input.otherCommitments) ?? new Prisma.Decimal(0),
      monthlyNetIncome: toDecimal(dsr.netIncome),
    },
  });

  await prisma.borrowerCreditProfile.upsert({
    where: { borrowerId },
    create: {
      borrowerId,
      dsrPercent: toDecimal(dsr.dsrPercent),
      netDsrPercent: toDecimal(dsr.netDsrPercent),
      dsrBasis: dsr.dsrBasis,
    },
    update: {
      dsrPercent: toDecimal(dsr.dsrPercent),
      netDsrPercent: toDecimal(dsr.netDsrPercent),
      dsrBasis: dsr.dsrBasis,
    },
  });

  await logBorrowerActivity(
    borrowerId,
    'INCOME_UPDATED',
    'Income profile updated',
    `Monthly gross income set to ${input.monthlyGrossIncome}`,
  );

  return { ...income, dsrPercent: dsr.dsrPercent, netDsrPercent: dsr.netDsrPercent };
}

export async function createBureauReport(borrowerId: string, data: BureauReportInput, actorId?: string) {
  const report = await prisma.borrowerBureauReport.create({
    data: {
      borrowerId,
      source: data.source,
      reportDate: data.reportDate ? new Date(data.reportDate) : null,
      fileName: data.fileName ?? null,
      filePath: data.filePath ?? null,
      uploadedById: actorId ?? null,
      facilities: data.facilities?.length
        ? {
            create: data.facilities.map((facility) => ({
              facilityType: facility.facilityType,
              lender: facility.lender ?? null,
              balance: toDecimal(facility.balance),
              installment: toDecimal(facility.installment),
              conductStatus: facility.conductStatus ?? null,
            })),
          }
        : undefined,
    },
    include: { facilities: true },
  });

  await logBorrowerActivity(
    borrowerId,
    'BUREAU_UPLOADED',
    `Bureau report uploaded (${data.source})`,
    data.fileName ?? undefined,
    actorId,
  );

  return report;
}
