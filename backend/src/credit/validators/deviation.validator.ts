import { z } from 'zod';

const deviationSeverityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const deviationStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED']);

// Decimal field — accept string or number, normalise to string for Prisma Decimal
const decimalField = z.union([z.string(), z.number()]).optional().nullable();

// ============================================================================
// Deviation CRUD validators
// ============================================================================

export const createDeviationSchema = z.object({
  body: z.object({
    applicationId: z.string().uuid(),
    policyRule: z.string().min(1).max(100),
    description: z.string().min(1).max(2000),
    actualValue: decimalField,
    thresholdValue: decimalField,
    severity: deviationSeverityEnum.default('MEDIUM'),
    justification: z.string().min(1).max(5000),
    isNonWaivable: z.boolean().default(false),
    requiredAuthorityLevel: z.string().max(50).optional(),
    reviewDate: z.coerce.date().optional().nullable(),
    sunsetDate: z.coerce.date().optional().nullable(),
  }),
});

export const updateDeviationSchema = z.object({
  body: z.object({
    description: z.string().min(1).max(2000).optional(),
    justification: z.string().min(1).max(5000).optional(),
    severity: deviationSeverityEnum.optional(),
    reviewDate: z.coerce.date().optional().nullable(),
    sunsetDate: z.coerce.date().optional().nullable(),
  }),
});

export const approveDeviationSchema = z.object({
  body: z.object({
    comments: z.string().max(5000).optional(),
  }),
});

export const rejectDeviationSchema = z.object({
  body: z.object({
    reason: z.string().min(1).max(5000),
  }),
});

export const listDeviationsSchema = z.object({
  query: z.object({
    applicationId: z.string().uuid().optional(),
    status: deviationStatusEnum.optional(),
    policyRule: z.string().max(100).optional(),
    severity: deviationSeverityEnum.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

// Inferred types
export type CreateDeviationInput = z.infer<typeof createDeviationSchema>['body'];
export type UpdateDeviationInput = z.infer<typeof updateDeviationSchema>['body'];
export type ApproveDeviationInput = z.infer<typeof approveDeviationSchema>['body'];
export type RejectDeviationInput = z.infer<typeof rejectDeviationSchema>['body'];
export type ListDeviationsInput = z.infer<typeof listDeviationsSchema>['query'];