import {
  RISK_FACTOR_KEYS,
  isRiskFactorKey,
  RISK_FACTOR_LABELS,
  LEGACY_ENGINE_FACTORS,
  isLegacyEngineFactor,
  LEGACY_RISK_CATEGORIES,
  LEGACY_CATEGORY_LABELS,
} from '../riskTaxonomy';
import { FACTOR_GROUPS } from '../scorecard.service';

describe('RISK_FACTOR_KEYS — canonical scored taxonomy', () => {
  it('is the nine governed factor groups in scorecard order', () => {
    expect([...RISK_FACTOR_KEYS]).toEqual([
      'financial_performance', 'leverage', 'liquidity', 'cashflow',
      'management', 'industry', 'collateral', 'relationship', 'market_conditions',
    ]);
  });

  it('is the FACTOR_GROUPS declaration by identity', () => {
    expect(RISK_FACTOR_KEYS).toBe(FACTOR_GROUPS);
  });

  it('accepts canonical keys and rejects near-misses', () => {
    for (const key of RISK_FACTOR_KEYS) expect(isRiskFactorKey(key)).toBe(true);
    for (const bad of ['FINANCIAL_PERFORMANCE', 'financialperformance', 'APPLICANT', 'cash_flow', '', ' leverage']) {
      expect(isRiskFactorKey(bad)).toBe(false);
    }
    expect(isRiskFactorKey(null)).toBe(false);
    expect(isRiskFactorKey(undefined)).toBe(false);
  });

  it('labels every canonical group', () => {
    for (const key of RISK_FACTOR_KEYS) expect(RISK_FACTOR_LABELS[key]).toBeTruthy();
  });
});

describe('LEGACY_ENGINE_FACTORS', () => {
  it('retains the six-key vocabulary of the unwired engine', () => {
    expect([...LEGACY_ENGINE_FACTORS]).toEqual(['APPLICANT', 'INDUSTRY', 'PRODUCT', 'DOCUMENTATION', 'BEHAVIOUR', 'FRAUD']);
  });

  it('is disjoint from the canonical taxonomy and guards membership', () => {
    for (const legacy of LEGACY_ENGINE_FACTORS) expect(isRiskFactorKey(legacy)).toBe(false);
    expect(isLegacyEngineFactor('APPLICANT')).toBe(true);
    expect(isLegacyEngineFactor('APPLICNT')).toBe(false);
    expect(isLegacyEngineFactor('leverage')).toBe(false);
  });
});

describe('LEGACY_RISK_CATEGORIES — narrative, unchanged', () => {
  it('retains its five form categories and labels', () => {
    expect([...LEGACY_RISK_CATEGORIES]).toEqual(['PROJECT', 'PERFORMANCE', 'PACKAGING', 'PAYMENT', 'OTHER']);
    expect(LEGACY_CATEGORY_LABELS.PROJECT).toBe('Project Risk');
    expect(LEGACY_CATEGORY_LABELS.OTHER).toBe('Other Risk');
  });
});

describe('4P mapping removal', () => {
  it('exports no legacy category-to-factor mapping', async () => {
    const mod: Record<string, unknown> = await import('../riskTaxonomy');
    expect(mod).not.toHaveProperty('LEGACY_CATEGORY_TO_FACTOR');
    expect(mod).not.toHaveProperty('mapLegacyCategory');
  });
});
