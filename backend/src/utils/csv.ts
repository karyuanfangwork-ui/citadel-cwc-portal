// ============================================================================
// RFC-4180 CSV Utility
// ============================================================================

type ColumnDef = string | { key: string; label: string };

export type { ColumnDef };

function quoteField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function toValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return String(val);
}

function resolveColumns(cols: ColumnDef[]): { key: string; label: string }[] {
  return cols.map(c => typeof c === 'string' ? { key: c, label: c } : c);
}

/**
 * Convert an array of objects to RFC-4180 CSV string.
 * Columns can be string keys or { key, label } objects for custom headers.
 * Rows are separated by \r\n (RFC-4180).
 */
export function toCsv(rows: Record<string, unknown>[], columns: ColumnDef[]): string {
  const cols = resolveColumns(columns);
  const header = cols.map(c => quoteField(c.label)).join(',');
  if (rows.length === 0) return header;

  const dataRows = rows.map(row =>
    cols.map(c => quoteField(toValue(row[c.key]))).join(',')
  );

  return [header, ...dataRows].join('\r\n');
}