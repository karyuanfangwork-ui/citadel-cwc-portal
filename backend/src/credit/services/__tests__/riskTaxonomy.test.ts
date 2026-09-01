import {
  RISK_FACTOR_KEYS,
  isRiskFactorKey,
  LEGACY_RISK_CATEGORIES,
  LEGACY_CATEGORY_TO_FACTOR,
  mapLegacyCategory,
  RISK_FACTOR_LABELS,
  LEGACY_CATEGORY_LABELS,
} from '../riskTaxonomy';

describe('RISK_FACTOR_KEYS', () => {
  it('is exactly the engine taxonomy, in weight-declaration order', () => {
    expect([...RISK_FACTOR_KEYS]).toEqual([
      'APPLICANT', 'INDUSTRY', 'PRODUCT', 'DOCUMENTATION', 'BEHAVIOUR', 'FRAUD',
    ]);
  });

  it('labels every key', () => {
    for (const key of RISK_FACTOR_KEYS) {
      expect(RISK_FACTOR_LABELS[key]).toEqual(expect.any(String));
      expect(RISK_FACTOR_LABELS[key].length).toBeGreaterThan(0);
    }
  });
});

describe('isRiskFactorKey', () => {
  it('accepts every canonical key', () => {
    for (const key of RISK_FACTOR_KEYS) expect(isRiskFactorKey(key)).toBe(true);
  });

  it('rejects near-misses, legacy categories, and junk', () => {
    for (const bad of ['applicant', 'APPLICANTS', 'APPLICNT', 'PROJECT', 'PAYMENT', '', ' APPLICANT']) {
      expect(isRiskFactorKey(bad)).toBe(false);
    }
    expect(isRiskFactorKey(null)).toBe(false);
    expect(isRiskFactorKey(undefined)).toBe(false);
  });
});

describe('LEGACY_RISK_CATEGORIES', () => {
  it('matches the Prisma RiskCategory enum exactly', () => {
    expect([...LEGACY_RISK_CATEGORIES]).toEqual(['PROJECT', 'PERFORMANCE', 'PACKAGING', 'PAYMENT', 'OTHER']);
  });

  it('labels every category the way the narrative form does', () => {
    expect(LEGACY_CATEGORY_LABELS).toEqual({
      PROJECT: 'Project Risk',
      PERFORMANCE: 'Performance Risk',
      PACKAGING: 'Packaging Risk',
      PAYMENT: 'Payment Risk',
      OTHER: 'Other Risk',
    });
  });
});

describe('LEGACY_CATEGORY_TO_FACTOR', () => {
  it('maps every legacy category, mapping the catch-all to null', () => {
    expect(LEGACY_CATEGORY_TO_FACTOR).toEqual({
      PROJECT: 'PRODUCT',
      PERFORMANCE: 'APPLICANT',
      PACKAGING: 'DOCUMENTATION',
      PAYMENT: 'BEHAVIOUR',
      OTHER: null,
    });
  });

  it('only ever targets canonical keys', () => {
    for (const target of Object.values(LEGACY_CATEGORY_TO_FACTOR)) {
      if (target !== null) expect(isRiskFactorKey(target)).toBe(true);
    }
  });

  it('has an entry for every legacy category — no silent gaps', () => {
    for (const category of LEGACY_RISK_CATEGORIES) {
      expect(LEGACY_CATEGORY_TO_FACTOR).toHaveProperty(category);
    }
  });
});

describe('mapLegacyCategory', () => {
  it('maps known categories', () => {
    expect(mapLegacyCategory('PROJECT')).toBe('PRODUCT');
    expect(mapLegacyCategory('PAYMENT')).toBe('BEHAVIOUR');
  });

  it('returns null for the catch-all and for anything unrecognised', () => {
    expect(mapLegacyCategory('OTHER')).toBeNull();
    expect(mapLegacyCategory('NOT_A_CATEGORY')).toBeNull();
    expect(mapLegacyCategory(null)).toBeNull();
    expect(mapLegacyCategory(undefined)).toBeNull();
  });
});
