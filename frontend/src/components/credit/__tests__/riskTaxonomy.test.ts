import {
  RISK_FACTOR_KEYS,
  LEGACY_RISK_CATEGORIES,
  LEGACY_CATEGORY_LABELS,
  LEGACY_CATEGORY_TO_FACTOR,
  mapLegacyCategory,
  RISK_FACTOR_LABELS,
} from '../riskTaxonomy';

describe('frontend risk taxonomy mirrors the backend', () => {
  it('declares the same six canonical factors in the same order', () => {
    expect([...RISK_FACTOR_KEYS]).toEqual([
      'APPLICANT', 'INDUSTRY', 'PRODUCT', 'DOCUMENTATION', 'BEHAVIOUR', 'FRAUD',
    ]);
  });

  it('declares the same five narrative categories with the form labels', () => {
    expect([...LEGACY_RISK_CATEGORIES]).toEqual(['PROJECT', 'PERFORMANCE', 'PACKAGING', 'PAYMENT', 'OTHER']);
    expect(LEGACY_CATEGORY_LABELS.PROJECT).toBe('Project Risk');
    expect(LEGACY_CATEGORY_LABELS.OTHER).toBe('Other Risk');
  });

  it('carries the same mapping, catch-all included', () => {
    expect(LEGACY_CATEGORY_TO_FACTOR).toEqual({
      PROJECT: 'PRODUCT',
      PERFORMANCE: 'APPLICANT',
      PACKAGING: 'DOCUMENTATION',
      PAYMENT: 'BEHAVIOUR',
      OTHER: null,
    });
    expect(mapLegacyCategory('PROJECT')).toBe('PRODUCT');
    expect(mapLegacyCategory('OTHER')).toBeNull();
    expect(mapLegacyCategory('JUNK')).toBeNull();
  });

  it('labels every canonical factor', () => {
    for (const key of RISK_FACTOR_KEYS) expect(RISK_FACTOR_LABELS[key]).toBeTruthy();
  });
});
