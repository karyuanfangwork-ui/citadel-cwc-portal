/**
 * Credit Export Audit Service — §1.5
 *
 * Logs every CSV/PDF/XLSX export from the credit module for DLP compliance.
 */

import prisma from '../../utils/prisma';
import { logger } from '../../utils/logger';

interface ExportLogParams {
  userId: string;
  reportType: string;
  format: 'csv' | 'pdf' | 'xlsx';
  filters?: Record<string, unknown>;
  rowCount?: number;
  ip?: string;
  userAgent?: string;
}

/**
 * Log a credit export event for audit/DLP purposes.
 */
export async function logCreditExport(params: ExportLogParams): Promise<void> {
  await prisma.creditExportEvent.create({
    data: {
      userId: params.userId,
      reportType: params.reportType,
      format: params.format,
      filters: params.filters ? JSON.stringify(params.filters) : null,
      rowCount: params.rowCount ?? null,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
    },
  });

  logger.info(
    `[ExportAudit] ${params.format.toUpperCase()} export by ${params.userId}: ${params.reportType} (${params.rowCount ?? '?'} rows)`,
  );
}

/**
 * Get export audit trail for a user (admin view).
 */
export async function getExportAuditTrail(
  userId: string,
  page = 1,
  limit = 50,
): Promise<{ data: unknown[]; total: number }> {
  const where = { userId };
  const [data, total] = await Promise.all([
    prisma.creditExportEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.creditExportEvent.count({ where }),
  ]);

  return { data, total };
}