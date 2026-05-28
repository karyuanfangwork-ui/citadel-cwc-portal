/**
 * CRM form utility helpers — shared across Create/Edit modals.
 *
 * cleanFormPayload: Strips empty/null/undefined values and casts numeric keys.
 * NUMERIC_KEYS: Per-entity numeric field definitions.
 */

/** Numeric keys per entity type — values for these keys are coerced to Number. */
export const NUMERIC_KEYS: Record<string, string[]> = {
  lead: ['estimatedValue'],
  account: ['annualRevenue'],
  contact: [],
  opportunity: ['value', 'probability'],
  trustProduct: ['assetValue'],
  beneficiary: ['allocationPct'],
};

/**
 * Strips empty/null/undefined values from a form object and casts
 * specified numeric keys to Number.
 */
export function cleanFormPayload(
  form: Record<string, any>,
  numericKeys: string[] = [],
): Record<string, any> {
  const payload: Record<string, any> = {};
  for (const [k, v] of Object.entries(form)) {
    if (v === '' || v === undefined || v === null) continue;
    if (numericKeys.includes(k)) {
      payload[k] = Number(v);
      if (isNaN(payload[k])) delete payload[k];
    } else {
      payload[k] = v;
    }
  }
  return payload;
}