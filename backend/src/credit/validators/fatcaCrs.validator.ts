import { z } from 'zod';

const dateField = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));
const optionalDateField = dateField.optional().nullable().transform(v => v ?? undefined);

const crsResidencySchema = z.object({
  country: z.string().min(1).max(100),
  tin: z.string().max(100).optional().nullable(),
});

export const upsertFatcaCrsSchema = z.object({
  body: z.object({
    declarationDate: dateField,
    isUsPerson: z.boolean(),
    usTin: z.string().max(50).optional().nullable(),
    entityClassification: z.enum(['INDIVIDUAL', 'ACTIVE_NFE', 'PASSIVE_NFE', 'FINANCIAL_INSTITUTION']),
    crsResidencies: z.array(crsResidencySchema).default([]),
    expiryDate: optionalDateField,
  }),
});

export type UpsertFatcaCrsInput = z.infer<typeof upsertFatcaCrsSchema>['body'];
