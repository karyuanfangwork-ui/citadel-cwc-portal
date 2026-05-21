import { z } from 'zod';

const decimalField = z.union([z.string(), z.number()]).optional().nullable();
const dateField = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable()
  .transform(v => v ?? undefined);

const phase4ShareholderFields = {
  dateOfBirthOrIncorporation: dateField,
  nationality: z.string().max(100).optional().nullable(),
  businessRegNo: z.string().max(100).optional().nullable(),
};

export const createShareholderSchema = z.object({
  body: z.object({
    contactId: z.string().uuid().optional().nullable(),
    name: z.string().max(255),
    nricPassport: z.string().max(50).optional().nullable(),
    shareholdingPct: decimalField,
    shareClass: z.string().max(50).optional().nullable(),
    numberOfShares: z.number().int().optional().nullable(),
    ...phase4ShareholderFields,
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
    ...phase4ShareholderFields,
  }),
});

export type CreateShareholderInput = z.infer<typeof createShareholderSchema>['body'];
export type UpdateShareholderInput = z.infer<typeof updateShareholderSchema>['body'];