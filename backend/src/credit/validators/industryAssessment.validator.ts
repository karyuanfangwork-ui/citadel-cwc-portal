import { z } from 'zod';

const outlookEnum = z.enum(['POSITIVE', 'STABLE', 'NEGATIVE']);

// ---- Create ----
export const createIndustryAssessmentSchema = z.object({
  body: z.object({
    sectorName: z.string().min(1),
    subsectorName: z.string().optional(),
    outlook: outlookEnum,
    outlookRationale: z.string().optional(),
    riskScore: z.number().int().min(1).max(10).optional(),
  }),
});

// ---- Update ----
export const updateIndustryAssessmentSchema = z.object({
  body: z.object({
    sectorName: z.string().min(1).optional(),
    subsectorName: z.string().optional(),
    outlook: outlookEnum.optional(),
    outlookRationale: z.string().optional(),
    riskScore: z.number().int().min(1).max(10).optional(),
  }),
});

// ---- Bulk Upsert ----
const bulkItemSchema = z.object({
  id: z.string().uuid().optional(),
  sectorName: z.string().min(1),
  subsectorName: z.string().optional(),
  outlook: outlookEnum,
  outlookRationale: z.string().optional(),
  riskScore: z.number().int().min(1).max(10).optional(),
});

export const bulkUpsertIndustryAssessmentSchema = z.object({
  body: z.array(bulkItemSchema).min(1),
});

export type CreateIndustryAssessmentInput = z.infer<typeof createIndustryAssessmentSchema>['body'];
export type UpdateIndustryAssessmentInput = z.infer<typeof updateIndustryAssessmentSchema>['body'];
export type BulkUpsertIndustryAssessmentInput = z.infer<typeof bulkUpsertIndustryAssessmentSchema>['body'];