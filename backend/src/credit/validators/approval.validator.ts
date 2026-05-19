import { z } from 'zod';

// Risk rating enum values matching Prisma schema
const riskRatingEnum = z.enum([
  'AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D', 'NR',
]);

// Decimal field — accept string or number, normalise to string for Prisma Decimal
const decimalField = z.union([z.string(), z.number()]);

// ============================================================================
// Approval Matrix CRUD validators
// ============================================================================

export const createApprovalMatrixSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(5000).optional(),
    minExposure: decimalField,
    maxExposure: decimalField,
    minRating: riskRatingEnum,
    maxRating: riskRatingEnum,
    authorityLevel: z.string().min(1).max(50),
    requiredApproverCount: z.number().int().min(1).default(1),
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date().optional().nullable(),
  }).refine(
    (data) => Number(data.minExposure) < Number(data.maxExposure),
    {
      message: 'minExposure must be less than maxExposure',
      path: ['maxExposure'],
    },
  ),
});

export const updateApprovalMatrixSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(5000).optional(),
    minExposure: decimalField.optional(),
    maxExposure: decimalField.optional(),
    minRating: riskRatingEnum.optional(),
    maxRating: riskRatingEnum.optional(),
    authorityLevel: z.string().min(1).max(50).optional(),
    requiredApproverCount: z.number().int().min(1).optional(),
    isActive: z.boolean().optional(),
    effectiveFrom: z.coerce.date().optional(),
    effectiveTo: z.coerce.date().optional().nullable(),
  }),
});

// ============================================================================
// Approval Action validator
// ============================================================================

export const submitApprovalActionSchema = z.object({
  body: z.object({
    decision: z.enum(['APPROVE', 'REJECT', 'RETURN', 'ESCALATE', 'DEFER']),
    comment: z.string().max(5000).optional(),
    isCommitteeVote: z.boolean().default(false),
  }),
});

export type CreateApprovalMatrixInput = z.infer<typeof createApprovalMatrixSchema>['body'];
export type UpdateApprovalMatrixInput = z.infer<typeof updateApprovalMatrixSchema>['body'];
export type SubmitApprovalActionInput = z.infer<typeof submitApprovalActionSchema>['body'];