/**
 * CA-P3-004 / GAP-P1-08 — the canonical risk vocabulary, deliberately mirroring
 * backend/src/credit/services/riskTaxonomy.ts.
 *
 * There is no shared package between backend and frontend; this repo's answer
 * is a mirror plus a test that pins the two together.
 */

export const RISK_FACTOR_KEYS = [
  'APPLICANT',
  'INDUSTRY',
  'PRODUCT',
  'DOCUMENTATION',
  'BEHAVIOUR',
  'FRAUD',
] as const;

export type RiskFactorKey = (typeof RISK_FACTOR_KEYS)[number];

export const RISK_FACTOR_LABELS: Record<RiskFactorKey, string> = {
  APPLICANT: 'Applicant',
  INDUSTRY: 'Industry',
  PRODUCT: 'Product',
  DOCUMENTATION: 'Documentation',
  BEHAVIOUR: 'Behaviour',
  FRAUD: 'Fraud',
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

/**
 * Ratified 2026-09-01. Mirrors LEGACY_CATEGORY_TO_FACTOR in
 * backend/src/credit/services/riskTaxonomy.ts — change both, and both test
 * tables, or the mirror test fails.
 */
export const LEGACY_CATEGORY_TO_FACTOR: Record<LegacyRiskCategory, RiskFactorKey | null> = {
  PROJECT: 'PRODUCT',
  PERFORMANCE: 'APPLICANT',
  PACKAGING: 'DOCUMENTATION',
  PAYMENT: 'BEHAVIOUR',
  OTHER: null,
};

export function mapLegacyCategory(category: string | null | undefined): RiskFactorKey | null {
  if (!category || !(LEGACY_RISK_CATEGORIES as readonly string[]).includes(category)) return null;
  return LEGACY_CATEGORY_TO_FACTOR[category as LegacyRiskCategory];
}
