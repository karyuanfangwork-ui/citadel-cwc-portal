import { z } from 'zod';

// Enums
const financialStatementTypeEnum = z.enum(['BS', 'PL', 'CF']);
const financialPeriodEnum = z.enum(['ANNUAL', 'QUARTERLY']);
const financialStatusEnum = z.enum(['DRAFT', 'REVIEWED', 'APPROVED']);
const currencyCodeEnum = z.enum([
  'MYR', 'USD', 'SGD', 'GBP', 'EUR', 'JPY', 'CNY', 'THB', 'IDR', 'AUD', 'HKD',
]);
const ratioCategoryEnum = z.enum([
  'PROFITABILITY', 'LEVERAGE', 'LIQUIDITY', 'COVERAGE', 'ACTIVITY',
]);

// Decimal field helper
const decimalField = z.union([z.string(), z.number()]);

// ============================================================================
// Statement schemas
// ============================================================================

export const createStatementSchema = z.object({
  body: z.object({
    period: financialPeriodEnum,
    fiscalYearEnd: z.string(), // ISO date string
    statementType: financialStatementTypeEnum,
    currency: currencyCodeEnum.default('MYR'),
  }),
});

export const updateStatementSchema = z.object({
  body: z.object({
    period: financialPeriodEnum.optional(),
    fiscalYearEnd: z.string().optional(),
    statementType: financialStatementTypeEnum.optional(),
    currency: currencyCodeEnum.optional(),
    reviewedById: z.string().uuid().optional().nullable(),
    status: financialStatusEnum.optional(),
  }),
});

// ============================================================================
// Line item schemas
// ============================================================================

const lineItemSchema = z.object({
  lineKey: z.string().max(100),
  lineLabel: z.string().max(200),
  amount: decimalField,
  parentLineKey: z.string().max(100).optional().nullable(),
  displayOrder: z.number().int(),
});

export const upsertLineItemsSchema = z.object({
  body: z.object({
    items: z.array(lineItemSchema).min(1),
  }),
});

export const deleteLineItemsSchema = z.object({
  body: z.object({
    lineKeys: z.array(z.string().max(100)).min(1),
  }),
});

// ============================================================================
// Review schema
// ============================================================================

export const reviewStatementSchema = z.object({
  body: z.object({
    decision: z.enum(['approve', 'reject']),
    comment: z.string().optional(),
  }),
});

// ============================================================================
// List filters (query)
// ============================================================================

export const listStatementsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('20'),
    statementType: financialStatementTypeEnum.optional(),
    period: financialPeriodEnum.optional(),
    status: financialStatusEnum.optional(),
    fiscalYearEnd: z.string().optional(),
  }),
});

export const listRatiosQuerySchema = z.object({
  query: z.object({
    category: ratioCategoryEnum.optional(),
    ratioKey: z.string().max(100).optional(),
  }),
});

export const trendAnalysisQuerySchema = z.object({
  query: z.object({
    ratioKey: z.string().max(100).optional(),
    category: ratioCategoryEnum.optional(),
  }),
});

// ============================================================================
// Type exports
// ============================================================================

export type CreateStatementInput = z.infer<typeof createStatementSchema>['body'];
export type UpdateStatementInput = z.infer<typeof updateStatementSchema>['body'];
export type UpsertLineItemsInput = z.infer<typeof upsertLineItemsSchema>['body'];
export type ReviewStatementInput = z.infer<typeof reviewStatementSchema>['body'];