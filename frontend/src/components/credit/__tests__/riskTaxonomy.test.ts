import {
  RISK_FACTOR_KEYS,
  isRiskFactorKey,
  RISK_FACTOR_LABELS,
  LEGACY_RISK_CATEGORIES,
  LEGACY_CATEGORY_LABELS,
} from '../riskTaxonomy';

describe('frontend risk taxonomy mirrors the backend', () => {
  it('declares the nine canonical factor groups in scorecard order', () => {
    expect([...RISK_FACTOR_KEYS]).toEqual([
      'financial_performance', 'leverage', 'liquidity', 'cashflow',
      'management', 'industry', 'collateral', 'relationship', 'market_conditions',
    ]);
  });

  it('guards membership and labels every group', () => {
    expect(isRiskFactorKey('leverage')).toBe(true);
    expect(isRiskFactorKey('APPLICANT')).toBe(false);
    for (const key of RISK_FACTOR_KEYS) expect(RISK_FACTOR_LABELS[key]).toBeTruthy();
  });

  it('keeps the narrative categories and their form labels unchanged', () => {
    expect([...LEGACY_RISK_CATEGORIES]).toEqual(['PROJECT', 'PERFORMANCE', 'PACKAGING', 'PAYMENT', 'OTHER']);
    expect(LEGACY_CATEGORY_LABELS.PROJECT).toBe('Project Risk');
    expect(LEGACY_CATEGORY_LABELS.OTHER).toBe('Other Risk');
  });

  it('exports no 4P-to-factor mapping', async () => {
    const mod: Record<string, unknown> = await import('../riskTaxonomy');
    expect(mod).not.toHaveProperty('LEGACY_CATEGORY_TO_FACTOR');
    expect(mod).not.toHaveProperty('mapLegacyCategory');
  });
});
