import { z } from 'zod';

export const createConditionSchema = z.object({
  body: z.object({
    conditionType: z.enum(['PRECEDENT', 'SUBSEQUENT']),
    description: z.string().max(5000),
    dueDate: z.coerce.date().optional().nullable(),
    isFulfilled: z.boolean().optional(),
    fulfilmentNotes: z.string().max(5000).optional().nullable(),
  }),
});

export const updateConditionSchema = z.object({
  body: z.object({
    conditionType: z.enum(['PRECEDENT', 'SUBSEQUENT']).optional(),
    description: z.string().max(5000).optional(),
    dueDate: z.coerce.date().optional().nullable(),
  }),
});

export const completeConditionSchema = z.object({
  body: z.object({
    fulfilledById: z.string().uuid().optional(),
    fulfilmentNotes: z.string().max(5000).optional(),
    evidenceDocumentUrl: z.string().max(2000).optional(),
  }),
});

export const waiveConditionSchema = z.object({
  body: z.object({
    waiverReason: z.string().min(1).max(5000),
    approvedById: z.string().uuid().optional(),
  }),
});