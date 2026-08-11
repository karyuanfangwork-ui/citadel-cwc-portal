import { describe, expect, it } from 'vitest';
import { formatMyr, formatPercent, formatRatio } from '../formatters';

describe('credit formatters', () => {
  it('formats MYR values using Malaysian grouping', () => {
    expect(formatMyr(1_250_000)).toBe('RM 1,250,000');
  });

  it('formats ratios with an x suffix', () => {
    expect(formatRatio(1.58)).toBe('1.58x');
  });

  it('formats percentages without unnecessary decimals', () => {
    expect(formatPercent(42)).toBe('42%');
    expect(formatPercent(42.5)).toBe('42.5%');
  });

  it('uses an em dash for missing numeric values', () => {
    expect(formatMyr(null)).toBe('—');
    expect(formatRatio(undefined)).toBe('—');
    expect(formatPercent(null)).toBe('—');
  });
});
