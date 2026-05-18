import { z } from 'zod';

const creditProductTypeEnum = z.enum([
  'TERM_LOAN',
  'REVOLVING_FACILITY',
  'TRADE_FINANCE',
  'OVERDRAFT',
  'PROJECT_FINANCE',
  'SYNDICATED',
  'BRIDGING',
  'HIRE_PURCHASE',
]);

const currencyCodeEnum = z.enum([
  'MYR', 'USD', 'SGD', 'EUR', 'GBP', 'JPY', 'CNY', 'THB', 'IDR',
]);

// ApplicationState values — used at runtime for transition logic, not in zod schemas
// (kept for reference; the service imports ApplicationState directly from @prisma/client)

// Allow decimal-like strings or numbers, normalise to string for Prisma Decimal
const decimalField = z.union([z.string(), z.number()]);

export const createCreditApplicationSchema = z.object({
  body: z.object({
    borrowerProfileId: z.string().uuid(),
    productType: creditProductTypeEnum,
    purpose: z.string().max(2000).optional().nullable(),
    requestedAmount: decimalField,
    requestedTenor: z.number().int().min(1).optional().nullable(),
    currency: currencyCodeEnum.default('MYR'),
    assignedRmId: z.string().uuid().optional().nullable(),
    assignedAnalystId: z.string().uuid().optional().nullable(),
  }),
});

export const updateCreditApplicationSchema = z.object({
  body: z.object({
    productType: creditProductTypeEnum.optional(),
    purpose: z.string().max(2000).optional().nullable(),
    requestedAmount: decimalField.optional(),
    requestedTenor: z.number().int().min(1).optional().nullable(),
    currency: currencyCodeEnum.optional(),
    assignedRmId: z.string().uuid().optional().nullable(),
    assignedAnalystId: z.string().uuid().optional().nullable(),
  }),
});

export const transitionApplicationSchema = z.object({
  body: z.object({
    action: z.string().min(1),
    reason: z.string().max(5000).optional().nullable(),
  }),
});

export type CreateCreditApplicationInput = z.infer<typeof createCreditApplicationSchema>['body'];
export type UpdateCreditApplicationInput = z.infer<typeof updateCreditApplicationSchema>['body'];
export type TransitionApplicationInput = z.infer<typeof transitionApplicationSchema>['body'];