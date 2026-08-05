/**
 * XLSX Export Utility — §5.3
 *
 * Reusable Excel (XLSX) generation and response helpers for credit report exports.
 * Uses exceljs for workbook creation with basic styling.
 */

import ExcelJS from 'exceljs';
import { Response } from 'express';

export interface XlsxExportOptions {
  headers: string[];       // Human-readable column headers
  rows: (string | number | null)[][];  // Row data arrays
  filename: string;        // Download filename (without extension)
  sheetName?: string;      // Default: 'Report'
}

// Column format hints for auto-width calculation
const MIN_COL_WIDTH = 10;
const MAX_COL_WIDTH = 40;

/**
 * Generate an XLSX Buffer from headers and rows using exceljs.
 * Applies minimal styling: header bold, number formatting, auto-width.
 */
export async function generateXlsx(options: XlsxExportOptions): Promise<Buffer> {
  const { headers, rows, sheetName = 'Report' } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CWC Credit Module';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName);

  // Add header row
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8EDF5' }, // light blue-gray
  };
  headerRow.border = {
    bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  };

  // Add data rows
  for (const rowData of rows) {
    const row = worksheet.addRow(rowData);

    // Apply number format to cells that look like monetary/percentage values
    row.eachCell({ includeEmpty: false }, (cell: ExcelJS.Cell, colNumber: number) => {
      if (cell.value === null || cell.value === undefined) return;
      if (typeof cell.value === 'number') {
        // Check header for hints
        const header = headers[colNumber - 1]?.toLowerCase() ?? '';
        if (header.includes('exposure') || header.includes('amount') || header.includes('total')) {
          cell.numFmt = '#,##0.00';
        } else if (header.includes('pct') || header.includes('%') || header.includes('share')) {
          cell.numFmt = '0.0%';
        } else if (header.includes('days') || header.includes('count')) {
          cell.numFmt = '#,##0.0';
        }
      }
    });
  }

  // Auto-fit column widths
  (worksheet.columns as any[]).forEach((column: any, idx: number) => {
    const headerLen = (headers[idx] ?? '').length;
    let maxLen = headerLen;
    for (let i = 1; i <= Math.min(rows.length, 100); i++) {
      const cellVal = rows[i - 1]?.[idx];
      const cellLen = cellVal != null ? String(cellVal).length : 0;
      if (cellLen > maxLen) maxLen = cellLen;
    }
    column.width = Math.max(MIN_COL_WIDTH, Math.min(maxLen + 3, MAX_COL_WIDTH));
  });

  // Freeze header row
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Write to buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Send an XLSX file as an HTTP response with proper headers.
 */
export function sendXlsxResponse(res: Response, buffer: Buffer, filename: string): void {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  res.send(buffer);
}