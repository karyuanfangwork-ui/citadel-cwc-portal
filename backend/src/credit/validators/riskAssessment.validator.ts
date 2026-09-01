import { z } from 'zod';
import { LEGACY_RISK_CATEGORIES } from '../services/riskTaxonomy';

// CA-P3-004 — one declaration for the narrative category vocabulary.
const riskCategoryEnum = z.enum(LEGACY_RISK_CATEGORIES);

const likelihoodEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);
const impactEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);

// ---- Create ----
export const createRiskAssessmentSchema = z.object({
  body: z.object({
    riskCategory: riskCategoryEnum,
    description: z.string().min(1),
    likelihood: likelihoodEnum,
    impact: impactEnum,
    mitigation: z.string().optional(),
    rating: z.number().int().min(1).max(10).optional(),
  }),
});

// ---- Update ----
export const updateRiskAssessmentSchema = z.object({
  body: z.object({
    riskCategory: riskCategoryEnum.optional(),
    description: z.string().min(1).optional(),
    likelihood: likelihoodEnum.optional(),
    impact: impactEnum.optional(),
    mitigation: z.string().optional(),
    rating: z.number().int().min(1).max(10).optional(),
    expectedUpdatedAt: z.string().datetime().optional(),
  }),
});

// ---- Bulk Upsert ----
const bulkItemSchema = z.object({
  id: z.string().uuid().optional(),
  riskCategory: riskCategoryEnum,
  description: z.string().min(1),
  likelihood: likelihoodEnum,
  impact: impactEnum,
  mitigation: z.string().optional(),
  rating: z.number().int().min(1).max(10).optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
});

export const bulkUpsertRiskAssessmentSchema = z.object({
  body: z.array(bulkItemSchema).min(1),
});

export type CreateRiskAssessmentInput = z.infer<typeof createRiskAssessmentSchema>['body'];
export type UpdateRiskAssessmentInput = z.infer<typeof updateRiskAssessmentSchema>['body'];
export type BulkUpsertRiskAssessmentInput = z.infer<typeof bulkUpsertRiskAssessmentSchema>['body'];