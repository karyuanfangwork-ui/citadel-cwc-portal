import { z } from 'zod';

const decimalString = z.string().regex(/^\d+(\.\d+)?$/).or(z.number());

export const createGuaranteeSchema = z.object({
  body: z.object({
    facilityId: z.string().uuid(),
    guarantorProfileId: z.string().uuid(),
    guaranteeType: z.enum(['PERSONAL', 'CORPORATE']),
    amount: decimalString,
    isLimited: z.boolean().optional(),
  }),
});

export const updateGuaranteeSchema = z.object({
  body: z.object({
    guaranteeType: z.enum(['PERSONAL', 'CORPORATE']).optional(),
    amount: decimalString.optional(),
    isLimited: z.boolean().optional(),
  }),
});