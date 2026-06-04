// ============================================================================
// CSV response helper for report endpoints
// ============================================================================

import { toCsv, type ColumnDef } from './csv';
import type { Response } from 'express';

/**
 * If req.query.format === 'csv', respond with a CSV download.
 * Otherwise call res.json() normally.
 */
export function respondOrCsv(
  res: Response,
  data: any,
  filename: string,
  columns: ColumnDef[],
  rowsExtractor: (data: any) => Record<string, unknown>[],
  format?: string,
): void {
  if (format === 'csv') {
    const rows = rowsExtractor(data);
    const csv = toCsv(rows, columns);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } else {
    res.json({ status: 'success', data });
  }
}