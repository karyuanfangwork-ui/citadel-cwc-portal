import { convertToBaseCurrency, type FxRate } from '../services/crm-fx.service';

describe('convertToBaseCurrency', () => {
  const rates: FxRate[] = [
    { currency: 'MYR', rateToBase: 1 },       // base
    { currency: 'USD', rateToBase: 4.2 },     // 1 USD = 4.2 MYR
    { currency: 'SGD', rateToBase: 3.1 },      // 1 SGD = 3.1 MYR
    { currency: 'GBP', rateToBase: 5.4 },      // 1 GBP = 5.4 MYR
  ];

  it('converts USD to base MYR', () => {
    expect(convertToBaseCurrency(100, 'USD', rates)).toBeCloseTo(420, 2);
  });

  it('returns same value for base currency', () => {
    expect(convertToBaseCurrency(500, 'MYR', rates)).toBeCloseTo(500, 2);
  });

  it('converts SGD to base MYR', () => {
    expect(convertToBaseCurrency(200, 'SGD', rates)).toBeCloseTo(620, 2);
  });

  it('returns null for unknown currency', () => {
    expect(convertToBaseCurrency(100, 'EUR', rates)).toBeNull();
  });

  it('returns null for empty rates array', () => {
    expect(convertToBaseCurrency(100, 'USD', [])).toBeNull();
  });

  it('handles decimal precision correctly', () => {
    // 1234.56 USD * 4.2 = 5185.152 MYR
    expect(convertToBaseCurrency(1234.56, 'USD', rates)).toBeCloseTo(5185.152, 2);
  });

  it('handles zero value', () => {
    expect(convertToBaseCurrency(0, 'USD', rates)).toBeCloseTo(0, 2);
  });
});