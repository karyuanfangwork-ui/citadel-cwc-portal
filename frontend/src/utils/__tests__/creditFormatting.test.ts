import { describe, expect, it } from 'vitest';
import { formatCurrency } from '../../../pages/credit/creditUtils';

describe('credit formatting', () => {
  it('formats valid amounts', () => {
    expect(formatCurrency('125000', 'MYR')).toContain('125,000');
  });

  it('does not render NaN for invalid numeric data', () => {
    expect(formatCurrency('not-a-number', 'MYR')).toBe('Data quality error');
  });

  it('keeps a missing amount distinguishable from invalid data', () => {
    expect(formatCurrency(null, 'MYR')).toBe('—');
  });
});
