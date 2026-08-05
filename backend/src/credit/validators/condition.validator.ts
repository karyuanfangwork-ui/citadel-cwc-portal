import { z } from 'zod';

export const createConditionSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255),
    description: z.string().max(5000).optional(),
    category: z.enum(['PRE_DISBURSEMENT', 'POST_DISBURSEMENT', 'FINANCIAL_COVENANT', 'REPORTING', 'OTHER']).optional(),
    conditionType: z.enum(['PRECEDENT', 'SUBSEQUENT']).optional(),
    dueDate: z.coerce.date().optional().nullable(),
  }),
});

export const updateConditionSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(5000).optional(),
    category: z.enum(['PRE_DISBURSEMENT', 'POST_DISBURSEMENT', 'FINANCIAL_COVENANT', 'REPORTING', 'OTHER']).optional(),
    conditionType: z.enum(['PRECEDENT', 'SUBSEQUENT']).optional(),
    status: z.enum(['PENDING', 'COMPLETED', 'WAIVED', 'EXPIRED']).optional(),
    dueDate: z.coerce.date().optional().nullable(),
  }),
});

export const completeConditionSchema = z.object({
  body: z.object({
    fulfilmentNotes: z.string().max(5000).optional(),
  }),
});

export const waiveConditionSchema = z.object({
  body: z.object({
    waiverReason: z.string().min(1).max(5000),
  }),
});