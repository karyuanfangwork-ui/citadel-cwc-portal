import { z } from 'zod';

export const upsertCreditProfileSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    creditScore: z.number().int().min(0).max(999).nullable().optional(),
    scoreSource: z.enum(['CTOS', 'MANUAL']).nullable().optional(),
    scoreAsOf: z.string().datetime().nullable().optional(),
    riskGrade: z.string().max(10).nullable().optional(),
  }),
});

export const upsertIncomeSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    employmentType: z.string().max(30).nullable().optional(),
    employerName: z.string().max(255).nullable().optional(),
    monthlyGrossIncome: z.number().nonnegative(),
    epfMonthlyAmount: z.number().nonnegative().optional(),
    monthlyTaxDeduction: z.number().nonnegative().optional(),
    monthlySocsoDeduction: z.number().nonnegative().optional(),
    hirePurchaseCommitment: z.number().nonnegative().optional(),
    creditCardCommitment: z.number().nonnegative().optional(),
    existingLoanCommitment: z.number().nonnegative().optional(),
    otherCommitments: z.number().nonnegative().optional(),
  }),
});

export const createBureauReportSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    source: z.enum(['CTOS', 'CCRIS_BORROWER_UPLOAD']),
    reportDate: z.string().datetime().nullable().optional(),
    fileName: z.string().max(255).nullable().optional(),
    filePath: z.string().max(500).nullable().optional(),
    facilities: z.array(
      z.object({
        facilityType: z.string().max(50),
        lender: z.string().max(100).nullable().optional(),
        balance: z.number().nonnegative().nullable().optional(),
        installment: z.number().nonnegative().nullable().optional(),
        conductStatus: z.string().max(20).nullable().optional(),
      }),
    ).optional(),
  }),
});

export const kycSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({}).strict(),
});
