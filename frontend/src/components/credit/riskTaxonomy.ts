/**
 * CA-P3-004a — frontend mirror of the nine live scored factor groups.
 * The 4P categories remain narrative-only and are intentionally not mapped.
 */

export const RISK_FACTOR_KEYS = [
  'financial_performance',
  'leverage',
  'liquidity',
  'cashflow',
  'management',
  'industry',
  'collateral',
  'relationship',
  'market_conditions',
] as const;

export type RiskFactorKey = (typeof RISK_FACTOR_KEYS)[number];

export const RISK_FACTOR_LABELS: Record<RiskFactorKey, string> = {
  financial_performance: 'Financial Performance',
  leverage: 'Leverage',
  liquidity: 'Liquidity',
  cashflow: 'Cashflow',
  management: 'Management',
  industry: 'Industry',
  collateral: 'Collateral',
  relationship: 'Relationship',
  market_conditions: 'Market Conditions',
};

export function isRiskFactorKey(value: unknown): value is RiskFactorKey {
  return typeof value === 'string' && (RISK_FACTOR_KEYS as readonly string[]).includes(value);
}

export const LEGACY_RISK_CATEGORIES = [
  'PROJECT',
  'PERFORMANCE',
  'PACKAGING',
  'PAYMENT',
  'OTHER',
] as const;

export type LegacyRiskCategory = (typeof LEGACY_RISK_CATEGORIES)[number];

export const LEGACY_CATEGORY_LABELS: Record<LegacyRiskCategory, string> = {
  PROJECT: 'Project Risk',
  PERFORMANCE: 'Performance Risk',
  PACKAGING: 'Packaging Risk',
  PAYMENT: 'Payment Risk',
  OTHER: 'Other Risk',
};
