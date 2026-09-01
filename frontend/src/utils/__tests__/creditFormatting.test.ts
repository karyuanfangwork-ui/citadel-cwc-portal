import { describe, expect, it } from 'vitest';
import { formatCurrency, formatRequiredCreditAmount, isValidRequiredCreditAmount } from '../../../pages/credit/creditUtils';

describe('credit formatting', () => {
  it('formats valid amounts', () => {
    expect(formatCurrency('125000', 'MYR')).toContain('125,000');
  });

  it('does not render NaN for invalid numeric data', () => {
    expect(formatCurrency('not-a-number', 'MYR')).toBe('Data quality error');
  });

  it('uses one unavailable rule for missing, invalid, negative, and zero required amounts', () => {
    for (const value of [null, undefined, '', 'not-a-number', -1, 0]) {
      expect(isValidRequiredCreditAmount(value)).toBe(false);
      expect(formatRequiredCreditAmount(value, 'MYR')).toBe('Amount unavailable · Review details');
    }
  });

  it('formats positive required amounts and allows zero only explicitly', () => {
    expect(isValidRequiredCreditAmount(125000)).toBe(true);
    expect(formatRequiredCreditAmount(125000, 'MYR')).toContain('125,000');
    expect(isValidRequiredCreditAmount(0, true)).toBe(true);
    expect(formatRequiredCreditAmount(0, 'MYR', true)).toContain('0');
  });
});
