const MYR_FORMATTER = new Intl.NumberFormat('en-MY', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatNumber(value: number | null | undefined, maximumFractionDigits: number): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-MY', { maximumFractionDigits }).format(value);
}

export function formatMyr(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `RM ${MYR_FORMATTER.format(value)}`;
}

export function formatRatio(value: number | null | undefined): string {
  const formatted = formatNumber(value, 2);
  return formatted === '—' ? formatted : `${formatted}x`;
}

export function formatPercent(value: number | null | undefined): string {
  const formatted = formatNumber(value, 2);
  return formatted === '—' ? formatted : `${formatted}%`;
}
