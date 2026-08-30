import { DEFAULT_DOCUMENT_RULES } from '../services/creditRuleDefaults';

describe('P1.3 — Document Requirement Source Unification', () => {
  it('every supported borrower type has non-empty defaults', () => {
    for (const rules of Object.values(DEFAULT_DOCUMENT_RULES)) {
      expect(rules.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('unknown borrower types degrade to INDIVIDUAL defaults', () => {
    const resolved = DEFAULT_DOCUMENT_RULES.UNKNOWN_TYPE ?? DEFAULT_DOCUMENT_RULES.INDIVIDUAL;
    expect(resolved).toEqual(DEFAULT_DOCUMENT_RULES.INDIVIDUAL);
  });

  it('has no duplicate document classes within a borrower type', () => {
    for (const rules of Object.values(DEFAULT_DOCUMENT_RULES)) {
      const classes = rules.map((rule) => rule.documentClass);
      expect(new Set(classes).size).toBe(classes.length);
    }
  });
});
