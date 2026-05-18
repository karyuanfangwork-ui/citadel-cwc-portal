import { z } from 'zod';

const decimalField = z.union([z.string(), z.number()]).optional().nullable();

export const createShareholderSchema = z.object({
  body: z.object({
    contactId: z.string().uuid().optional().nullable(),
    name: z.string().max(255),
    nricPassport: z.string().max(50).optional().nullable(),
    shareholdingPct: decimalField,
    shareClass: z.string().max(50).optional().nullable(),
    numberOfShares: z.number().int().optional().nullable(),
  }),
});

export const updateShareholderSchema = z.object({
  body: z.object({
    contactId: z.string().uuid().optional().nullable(),
    name: z.string().max(255).optional(),
    nricPassport: z.string().max(50).optional().nullable(),
    shareholdingPct: decimalField,
    shareClass: z.string().max(50).optional().nullable(),
    numberOfShares: z.number().int().optional().nullable(),
  }),
});

export type CreateShareholderInput = z.infer<typeof createShareholderSchema>['body'];
export type UpdateShareholderInput = z.infer<typeof updateShareholderSchema>['body'];