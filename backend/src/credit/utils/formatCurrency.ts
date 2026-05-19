// ============================================================================
// Currency formatting utilities for the Credit Assessment Module
// ============================================================================

/**
 * Convert a Prisma Decimal (or any numeric input) to a plain JavaScript number.
 * Returns null for null/undefined/invalid values.
 *
 * Use this before serialising Decimal fields in API responses to avoid
 * Prisma Decimal objects being sent to the client.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatCurrency(value: any): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Format a monetary value for display in the CWC convention: RM8,500.00
 * Returns "—" (em-dash) for null / undefined values.
 *
 * Note: the CWC convention is `RM8,500.00` — no space between RM and number.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatCurrencyDisplay(value: any): string {
  const num = formatCurrency(value);
  if (num === null) return '—';

  return `RM${num.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}