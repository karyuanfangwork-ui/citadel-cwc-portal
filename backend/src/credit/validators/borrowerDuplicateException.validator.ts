import { z } from 'zod';

export const duplicateExceptionRequestSchema = z.object({
  body: z.object({
    draftId: z.string().uuid(),
    matchedBorrowerId: z.string().uuid(),
    segment: z.enum(['INDIVIDUAL', 'SME', 'CORPORATE']),
    identityValue: z.string().trim().min(1).max(100),
    category: z.string().trim().min(1).max(80),
    justification: z.string().trim().min(20).max(2000),
    supportingReference: z.string().trim().max(255).optional().nullable(),
  }),
});

export const duplicateExceptionDecisionSchema = z.object({
  body: z.object({
    decision: z.enum(['APPROVE', 'REJECT']),
    comment: z.string().trim().min(1).max(2000).optional(),
  }).superRefine((data, ctx) => {
    if (data.decision === 'REJECT' && !data.comment) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['body', 'comment'], message: 'A rejection comment is required' });
    }
  }),
});

export const duplicateExceptionIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
