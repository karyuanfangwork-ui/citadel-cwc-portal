import { z } from 'zod';

const decimalString = z.string().regex(/^\d+(\.\d+)?$/).or(z.number());

// ---------------------------------------------------------------------------
// FacilityHealth
// ---------------------------------------------------------------------------

export const createFacilityHealthSchema = z.object({
  body: z.object({
    healthStatus: z.enum(['HEALTHY', 'WATCH', 'AT_RISK', 'DEFAULT']).optional(),
    lastReviewDate: z.coerce.date().optional().nullable(),
    nextReviewDate: z.coerce.date().optional().nullable(),
    reviewFrequency: z.enum(['QUARTERLY', 'SEMI_ANNUALLY', 'ANNUALLY']).optional(),
    notes: z.string().max(5000).optional().nullable(),
    updatedById: z.string().uuid().optional().nullable(),
  }),
});

export const updateFacilityHealthSchema = z.object({
  body: z.object({
    healthStatus: z.enum(['HEALTHY', 'WATCH', 'AT_RISK', 'DEFAULT']).optional(),
    lastReviewDate: z.coerce.date().optional().nullable(),
    nextReviewDate: z.coerce.date().optional().nullable(),
    reviewFrequency: z.enum(['QUARTERLY', 'SEMI_ANNUALLY', 'ANNUALLY']).optional(),
    notes: z.string().max(5000).optional().nullable(),
    updatedById: z.string().uuid().optional().nullable(),
  }),
});

// ---------------------------------------------------------------------------
// CovenantDefinition
// ---------------------------------------------------------------------------

export const createCovenantSchema = z.object({
  body: z.object({
    description: z.string().min(1).max(5000),
    covenantType: z.enum([
      'FINANCIAL_RATIO',
      'NEGATIVE_PLEDGE',
      'MINIMUM_TURNOVER',
      'DEBT_SERVICE_COVERAGE',
      'LOAN_TO_VALUE',
      'INSURANCE',
      'REPORTING',
      'OTHER',
    ]),
    metricKey: z.string().max(100).optional().nullable(),
    threshold: decimalString.optional().nullable(),
    frequency: z.enum(['QUARTERLY', 'SEMI_ANNUALLY', 'ANNUALLY']).optional(),
    isActive: z.boolean().optional(),
  }),
});

// ---------------------------------------------------------------------------
// CovenantTest
// ---------------------------------------------------------------------------

export const createCovenantTestSchema = z.object({
  body: z.object({
    testDate: z.coerce.date(),
    reportedValue: decimalString.optional().nullable(),
    isCompliant: z.boolean(),
    testedById: z.string().uuid().optional().nullable(),
    notes: z.string().max(5000).optional().nullable(),
  }),
});

// ---------------------------------------------------------------------------
// PaymentEvent
// ---------------------------------------------------------------------------

export const createPaymentEventSchema = z.object({
  body: z.object({
    dueDate: z.coerce.date(),
    paidDate: z.coerce.date().optional().nullable(),
    amount: decimalString,
    status: z.enum(['ON_TIME', 'LATE_30', 'LATE_60', 'LATE_90', 'MISSED']).optional(),
  }),
});

export const updatePaymentEventSchema = z.object({
  body: z.object({
    paidDate: z.coerce.date().optional().nullable(),
    status: z.enum(['ON_TIME', 'LATE_30', 'LATE_60', 'LATE_90', 'MISSED']).optional(),
  }),
});

// ---------------------------------------------------------------------------
// EarlyWarningSignal
// ---------------------------------------------------------------------------

export const resolveSignalSchema = z.object({
  body: z.object({}),
});