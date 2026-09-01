import { FACTOR_GROUPS, type FactorGroup } from './scorecard.service';

/**
 * CA-P3-004a / GAP-P1-08 — the single definition of the scored-risk vocabulary.
 *
 * The live borrower scorer writes the nine FACTOR_GROUPS to BorrowerRiskRun.
 * The six-key vocabulary below is retained separately for the unwired legacy
 * risk engine and its risk_factor_matrices table. The 4P risk categories remain
 * narrative headings and are deliberately not mapped to scoring factors.
 */

/** Re-exported by reference so this cannot drift from scorecard.service.ts. */
export const RISK_FACTOR_KEYS = FACTOR_GROUPS;

export type RiskFactorKey = FactorGroup;

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

/** The private six-key vocabulary retained by riskEngine.service.ts. */
export const LEGACY_ENGINE_FACTORS = [
  'APPLICANT',
  'INDUSTRY',
  'PRODUCT',
  'DOCUMENTATION',
  'BEHAVIOUR',
  'FRAUD',
] as const;

export type LegacyEngineFactor = (typeof LEGACY_ENGINE_FACTORS)[number];

export function isLegacyEngineFactor(value: unknown): value is LegacyEngineFactor {
  return typeof value === 'string' && (LEGACY_ENGINE_FACTORS as readonly string[]).includes(value);
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
