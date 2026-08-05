// ============================================================================
// CRM FX (Foreign Exchange) Normalization — convert opportunity values to base
// ============================================================================

export interface FxRate {
  currency: string;
  rateToBase: number; // multiplier: amount in this currency * rateToBase = amount in base currency
}

/**
 * Convert an amount from the given currency to the base currency using the
 * provided rate table. Returns null if the currency is not found in the rates.
 */
export function convertToBaseCurrency(
  amount: number,
  currency: string,
  rates: FxRate[],
): number | null {
  const rate = rates.find(r => r.currency === currency);
  if (!rate) return null;
  return amount * rate.rateToBase;
}

/**
 * Default base currency configuration.
 * In production, this would come from a CrmConfig table or environment variable.
 */
export const BASE_CURRENCY = 'MYR';

/**
 * Default FX rates table (snapshot rates).
 * In production, these would be fetched from an external FX API and cached.
 */
export const DEFAULT_FX_RATES: FxRate[] = [
  { currency: 'MYR', rateToBase: 1 },
  { currency: 'USD', rateToBase: 4.2 },
  { currency: 'SGD', rateToBase: 3.1 },
  { currency: 'GBP', rateToBase: 5.4 },
];