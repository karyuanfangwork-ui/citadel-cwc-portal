import { z } from 'zod';

// ============================================================================
// Risk Rating enum
// ============================================================================

const riskRatingEnum = z.enum([
  'AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D', 'NR',
]);

// ============================================================================
// Factor weight schema — 9 factor groups, each weight 0-100
// ============================================================================

const factorWeightSchema = z.number().min(0).max(100);

const factorWeightsSchema = z.object({
  financial_performance: factorWeightSchema,
  leverage: factorWeightSchema,
  liquidity: factorWeightSchema,
  cashflow: factorWeightSchema,
  management: factorWeightSchema,
  industry: factorWeightSchema,
  collateral: factorWeightSchema,
  relationship: factorWeightSchema,
  market_conditions: factorWeightSchema,
}).strict().refine((data) => {
  const total = Object.values(data).reduce((sum, val) => sum + val, 0);
  return Math.abs(total - 100) <= 0.01;
}, {
  message: 'Factor weights must sum to 100',
});

const creditProductTypeEnum = z.enum([
  'TERM_LOAN', 'REVOLVING_FACILITY', 'TRADE_FINANCE', 'OVERDRAFT',
  'PROJECT_FINANCE', 'SYNDICATED', 'BRIDGING', 'HIRE_PURCHASE',
]);

// ============================================================================
// Scorecard CRUD schemas
// ============================================================================

export const createScorecardSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    productType: creditProductTypeEnum.nullable().optional(),
  }),
});

export const updateScorecardSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().optional().nullable(),
  }).strict(),
});

export const listScorecardsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('20'),
    isActive: z.enum(['true', 'false']).optional(),
  }),
});

// ============================================================================
// Version management schemas
// ============================================================================

export const createVersionSchema = z.object({
  body: z.object({
    factorWeights: factorWeightsSchema,
    retailFactorWeights: factorWeightsSchema,
    changeReason: z.string().trim().min(5).max(1000),
  }),
});

export const activateScorecardVersionSchema = z.object({
  body: z.object({
    policyApprovalReference: z.string().trim().min(5).max(200),
    marketConditionsAcknowledged: z.literal(true),
  }),
});

// ============================================================================
// Scoring schemas
// ============================================================================

export const executeScoreSchema = z.object({
  body: z.object({
    scorecardId: z.string().uuid().optional(),
  }),
});

// ============================================================================
// Override schema
// ============================================================================

export const overrideScoreSchema = z.object({
  body: z.object({
    newRiskRating: riskRatingEnum,
    overrideReason: z.string().min(1),
    overrideApprovedById: z.string().uuid(),
  }),
});

// ============================================================================
// Type exports
// ============================================================================

export type CreateScorecardInput = z.infer<typeof createScorecardSchema>['body'];
export type UpdateScorecardInput = z.infer<typeof updateScorecardSchema>['body'];
export type CreateVersionInput = z.infer<typeof createVersionSchema>['body'];
export type ExecuteScoreInput = z.infer<typeof executeScoreSchema>['body'];
export type OverrideScoreInput = z.infer<typeof overrideScoreSchema>['body'];