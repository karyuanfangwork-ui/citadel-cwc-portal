import { z } from 'zod';

const decimalField = z.union([z.string(), z.number()]);

export const createUboSchema = z.object({
  body: z.object({
    name: z.string().max(255),
    nricPassport: z.string().max(50).optional().nullable(),
    ownershipPct: decimalField,
    isPep: z.boolean().default(false),
    sourceOfWealth: z.string().max(255).optional().nullable(),
    countryOfResidence: z.string().max(100).optional().nullable(),
  }),
});

export const updateUboSchema = z.object({
  body: z.object({
    name: z.string().max(255).optional(),
    nricPassport: z.string().max(50).optional().nullable(),
    ownershipPct: decimalField.optional(),
    isPep: z.boolean().optional(),
    sourceOfWealth: z.string().max(255).optional().nullable(),
    countryOfResidence: z.string().max(100).optional().nullable(),
  }),
});

export type CreateUboInput = z.infer<typeof createUboSchema>['body'];
export type UpdateUboInput = z.infer<typeof updateUboSchema>['body'];