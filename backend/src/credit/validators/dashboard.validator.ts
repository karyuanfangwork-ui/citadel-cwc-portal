import { z } from 'zod';

// ============================================================================
// Dashboard query validators
// ============================================================================

export const pipelineDashboardSchema = z.object({
  query: z.object({
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  }),
});

export const approvalInboxSchema = z.object({
  query: z.object({
    urgency: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const exposureDashboardSchema = z.object({
  query: z.object({
    topN: z.coerce.number().int().min(1).max(50).default(10),
  }),
});

export const committeeCalendarSchema = z.object({
  query: z.object({
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
});