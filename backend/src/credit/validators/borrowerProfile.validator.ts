import { z } from 'zod';

const borrowerTypeEnum = z.enum(['INDIVIDUAL', 'CORPORATE', 'JOINT']);
const riskRatingEnum = z.enum(['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D', 'NR']);
const amlRiskTierEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'PROHIBITED']);

// Allow decimal-like strings or numbers, normalise to string for Prisma Decimal
const decimalField = z.union([z.string(), z.number()]).optional().nullable();

export const createBorrowerProfileSchema = z.object({
  body: z.object({
    borrowerType: borrowerTypeEnum.default('CORPORATE'),
    accountId: z.string().uuid().optional().nullable(),
    contactId: z.string().uuid().optional().nullable(),
    creditRiskRating: riskRatingEnum.optional().nullable(),
    amlRiskTier: amlRiskTierEnum.optional().nullable(),
    exposureLimit: decimalField,
    totalExposure: decimalField,
    isSanctionedEntity: z.boolean().default(false),
    sourceOfWealth: z.string().max(255).optional().nullable(),
    purposeOfAccount: z.string().max(255).optional().nullable(),
    occupation: z.string().max(100).optional().nullable(),
    employer: z.string().max(255).optional().nullable(),
    annualIncome: decimalField,
    netWorth: decimalField,
  }),
});

export const updateBorrowerProfileSchema = z.object({
  body: z.object({
    borrowerType: borrowerTypeEnum.optional(),
    accountId: z.string().uuid().optional().nullable(),
    contactId: z.string().uuid().optional().nullable(),
    creditRiskRating: riskRatingEnum.optional().nullable(),
    amlRiskTier: amlRiskTierEnum.optional().nullable(),
    exposureLimit: decimalField,
    totalExposure: decimalField,
    isSanctionedEntity: z.boolean().optional(),
    sourceOfWealth: z.string().max(255).optional().nullable(),
    purposeOfAccount: z.string().max(255).optional().nullable(),
    occupation: z.string().max(100).optional().nullable(),
    employer: z.string().max(255).optional().nullable(),
    annualIncome: decimalField,
    netWorth: decimalField,
    isActive: z.boolean().optional(),
  }),
});

export type CreateBorrowerProfileInput = z.infer<typeof createBorrowerProfileSchema>['body'];
export type UpdateBorrowerProfileInput = z.infer<typeof updateBorrowerProfileSchema>['body'];