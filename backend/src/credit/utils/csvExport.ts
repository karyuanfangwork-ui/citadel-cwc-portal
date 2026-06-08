/**
 * CSV Export Utility — §5.3
 *
 * Reusable CSV generation and response helpers for credit report exports.
 * Handles escaping, BOM prefix for Excel compatibility, and Content-Disposition headers.
 */

export interface CsvExportOptions {
  headers: string[];      // Human-readable column headers
  rows: (string | number | null)[][];  // Row data arrays
  filename: string;       // Download filename (without extension)
}

/**
 * Escape a single CSV field — wrap in double quotes if it contains
 * commas, double quotes, or newlines. Internal double quotes become "".
 */
function escapeField(value: string | number | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate a CSV string from headers and rows.
 * Prepends UTF-8 BOM so Excel opens Unicode correctly.
 */
export function generateCsv(options: CsvExportOptions): string {
  const { headers, rows } = options;
  const headerLine = headers.map(escapeField).join(',');
  const dataLines = rows.map(row => row.map(escapeField).join(','));
  // BOM prefix for Excel Unicode support
  return '\uFEFF' + [headerLine, ...dataLines].join('\n');
}

/**
 * Send a CSV file as an HTTP response with proper headers.
 */
export function sendCsvResponse(res: any, csv: string, filename: string): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  res.send(csv);
}