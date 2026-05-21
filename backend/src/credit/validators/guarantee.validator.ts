import { z } from 'zod';

const decimalString = z.string().regex(/^\d+(\.\d+)?$/).or(z.number());

const phase4GuaranteeFields = {
  contingentLiabilities: decimalString.optional().nullable(),
  estimatedNetWorth: decimalString.optional().nullable(),
  guarantorRiskRatingSnapshot: z.string().max(20).optional().nullable(),
  remarks: z.string().optional().nullable(),
};

export const createGuaranteeSchema = z.object({
  body: z.object({
    facilityId: z.string().uuid(),
    guarantorProfileId: z.string().uuid(),
    guaranteeType: z.enum(['PERSONAL', 'CORPORATE']),
    amount: decimalString,
    isLimited: z.boolean().optional(),
    ...phase4GuaranteeFields,
  }),
});

export const updateGuaranteeSchema = z.object({
  body: z.object({
    guaranteeType: z.enum(['PERSONAL', 'CORPORATE']).optional(),
    amount: decimalString.optional(),
    isLimited: z.boolean().optional(),
    ...phase4GuaranteeFields,
  }),
});