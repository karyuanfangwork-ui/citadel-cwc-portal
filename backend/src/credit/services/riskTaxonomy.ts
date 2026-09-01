/**
 * CA-P3-004 / GAP-P1-08 — the single definition of the scored-risk vocabulary.
 *
 * RISK_FACTOR_KEYS is the canonical scored taxonomy. LEGACY_RISK_CATEGORIES is
 * the narrative taxonomy used by the existing 4P risk form. The mapping joins
 * the two without changing the stored narrative category.
 *
 * This module intentionally has no Prisma or I/O dependency so validators,
 * services, and configuration checks can share the same vocabulary.
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
 * Ratified 2026-09-01. This is the canonical join between the narrative
 * categories an RM writes prose under and the scored factors the engine
 * weights.
 *
 * OTHER maps to null on purpose: a catch-all is not a factor, and forcing it
 * onto one would poison every join that uses this table. INDUSTRY and FRAUD
 * have no legacy counterpart — they are engine-only factors with no narrative
 * section, which is expected and not a gap.
 *
 * CA-P3-005 persists application_risk_run rows keyed by these values, and that
 * table is append-only. Changing a pair after it ships means either rewriting
 * immutable audit rows or carrying a permanent "rows before date X used the old
 * mapping" caveat. Treat an edit here as a data-governance change, not a
 * refactor.
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
