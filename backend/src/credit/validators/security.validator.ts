import { z } from 'zod';

/**
 * POST /credit/security/audit-verify
 */
export const auditVerifySchema = z.object({
  body: z.object({
    applicationId: z.string().uuid(),
  }),
});

/**
 * GET /credit/security/pii-logs
 */
export const piiLogsQuerySchema = z.object({
  query: z.object({
    userId: z.string().uuid().optional(),
    resourceType: z.string().max(50).optional(),
    resourceId: z.string().uuid().optional(),
    field: z.string().max(100).optional(),
    dateFrom: z.string().datetime({ offset: true }).optional(),
    dateTo: z.string().datetime({ offset: true }).optional(),
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50).optional(),
  }),
});

/**
 * POST /credit/security/export
 */
export const exportRequestSchema = z.object({
  body: z.object({
    resourceType: z.string().max(50),
    resourceId: z.string().uuid(),
    format: z.enum(['pdf', 'csv', 'json', 'xlsx']),
    reason: z.string().min(10).max(1000),
  }),
});

/**
 * POST /credit/security/scan-document
 */
export const scanDocumentSchema = z.object({
  body: z.object({
    documentId: z.string().uuid(),
  }),
});