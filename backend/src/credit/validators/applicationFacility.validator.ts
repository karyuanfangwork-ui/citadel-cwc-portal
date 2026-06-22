import { z } from 'zod';
import { FACILITY_TYPES } from '../services/applicationFacility.service';

const facilityTypeEnum = z.enum(FACILITY_TYPES);

const decimalString = z.string().regex(/^\d+(\.\d+)?$/).or(z.number());

const positiveDecimalString = decimalString.refine((v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}, { message: 'Amount must be greater than 0' });

const phase2Fields = {
  pricingLabel: z.string().max(100).optional().nullable(),
  existingLimit: decimalString.optional().nullable(),
  proposedChange: decimalString.optional().nullable(),
  newLimit: decimalString.optional().nullable(),
  outstandingBalance: decimalString.optional().nullable(),
  undisbursedLimit: decimalString.optional().nullable(),
  approvingLevel: z.string().max(100).optional().nullable(),
  requestItemId: z.string().uuid().optional().nullable(),
};

// Application Details Enhancement — structuring fields
const structuringFields = {
  repaymentType: z.enum(['EMI', 'BULLET', 'INTEREST_ONLY', 'LUMP_SUM', 'CUSTOM']).optional().nullable(),
  repaymentFrequency: z.enum(['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'LUMP_SUM']).optional().nullable(),
  sourceOfRepayment: z.string().max(2000).optional().nullable(),
  securityRequirement: z.string().max(2000).optional().nullable(),
  recommendedAmount: decimalString.optional().nullable(),
};

export const createApplicationFacilitySchema = z.object({
  body: z.object({
    facilityType: facilityTypeEnum,
    amount: positiveDecimalString,
    tenorMonths: z.number().int().min(1).max(360).optional().nullable(),
    ratePct: decimalString.optional().nullable(),
    purpose: z.string().max(2000).optional().nullable(),
    approvedAmount: decimalString.optional().nullable(),
    approvedTenor: z.number().int().min(0).optional().nullable(),
    approvedRate: decimalString.optional().nullable(),
    ...phase2Fields,
    ...structuringFields,
  }),
});

export const updateApplicationFacilitySchema = z.object({
  body: z.object({
    facilityType: facilityTypeEnum.optional(),
    amount: positiveDecimalString.optional(),
    tenorMonths: z.number().int().min(1).max(360).optional().nullable(),
    ratePct: decimalString.optional().nullable(),
    purpose: z.string().max(2000).optional().nullable(),
    approvedAmount: decimalString.optional().nullable(),
    approvedTenor: z.number().int().min(0).optional().nullable(),
    approvedRate: decimalString.optional().nullable(),
    ...phase2Fields,
    ...structuringFields,
  }),
});

export type CreateApplicationFacilityInput = z.infer<typeof createApplicationFacilitySchema>['body'];
export type UpdateApplicationFacilityInput = z.infer<typeof updateApplicationFacilitySchema>['body'];