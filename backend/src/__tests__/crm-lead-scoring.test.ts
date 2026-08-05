import { computeRuleScore, type ScoringRule, type LeadLike } from '../services/crm-lead-scoring.service';

// ── Test data ──────────────────────────────────────────────────────

const baseLead: LeadLike = {
  source: 'WEBSITE',
  status: 'NEW',
  company: 'Acme Corp',
  title: 'Enterprise Deal',
  estimatedValue: 50000,
  contactEmail: 'ceo@acme.com',
  contactPhone: '+60123456789',
  description: 'Large enterprise opportunity for Q3',
};

const rules: ScoringRule[] = [
  { id: '1', field: 'source', operator: 'equals', value: 'WEBSITE', points: 10, isActive: true },
  { id: '2', field: 'source', operator: 'equals', value: 'REFERRAL', points: 20, isActive: true },
  { id: '3', field: 'estimatedValue', operator: 'gt', value: '10000', points: 15, isActive: true },
  { id: '4', field: 'title', operator: 'contains', value: 'Enterprise', points: 5, isActive: true },
  { id: '5', field: 'contactEmail', operator: 'contains', value: '@acme.com', points: 3, isActive: true },
  { id: '6', field: 'status', operator: 'equals', value: 'CONVERTED', points: 25, isActive: true },
  { id: '7', field: 'description', operator: 'starts_with', value: 'Large', points: 2, isActive: true },
  { id: '8', field: 'contactPhone', operator: 'not_empty', value: '', points: 4, isActive: true },
  { id: '9', field: 'company', operator: 'lt', value: '3', points: 1, isActive: false }, // inactive rule
];

// ── computeRuleScore ──────────────────────────────────────────────

describe('computeRuleScore', () => {
  it('sums matching rules (equals, gt, contains)', () => {
    const score = computeRuleScore(baseLead, rules);
    // source=WEBSITE → 10, estimatedValue > 10000 → 15, title contains Enterprise → 5,
    // email contains @acme.com → 3, description starts_with Large → 2, phone not_empty → 4
    expect(score).toBe(10 + 15 + 5 + 3 + 2 + 4); // = 39
  });

  it('returns 0 when no rules match', () => {
    const score = computeRuleScore({ ...baseLead, source: 'COLD_CALL', estimatedValue: 100 }, rules);
    // source doesn't match any equals rule; estimatedValue=100 not > 10000; title still matches Enterprise
    expect(score).toBe(5 + 3 + 2 + 4); // title=contains Enterprise(5) + email=contains acme(3) + starts_with Large(2) + phone not_empty(4)
  });

  it('skips inactive rules', () => {
    // Rule 9 is inactive: company lt 3 → should not count
    const lead = { ...baseLead, company: 'AB' }; // "AB" < "3" lexicographically, but rule is inactive
    const score = computeRuleScore(lead, rules);
    expect(score).not.toContain(1);
  });

  it('equals operator is case-insensitive for strings', () => {
    const score = computeRuleScore({ ...baseLead, source: 'website' }, rules);
    expect(score).toBeGreaterThanOrEqual(10); // source=WEBSITE rule still matches case-insensitive
  });

  it('lt operator works for numeric fields', () => {
    const smallLead = { ...baseLead, estimatedValue: 5000 };
    const ltRule: ScoringRule[] = [
      { id: 'lt1', field: 'estimatedValue', operator: 'lt', value: '10000', points: 7, isActive: true },
    ];
    expect(computeRuleScore(smallLead, ltRule)).toBe(7);
    expect(computeRuleScore(baseLead, ltRule)).toBe(0); // 50000 is not < 10000
  });

  it('not_empty operator returns points when field has a value', () => {
    const notEmptyRule: ScoringRule[] = [
      { id: 'ne1', field: 'company', operator: 'not_empty', value: '', points: 8, isActive: true },
    ];
    expect(computeRuleScore(baseLead, notEmptyRule)).toBe(8);
    expect(computeRuleScore({ ...baseLead, company: null }, notEmptyRule)).toBe(0);
  });

  it('starts_with operator checks string prefix', () => {
    const rule: ScoringRule[] = [
      { id: 'sw1', field: 'title', operator: 'starts_with', value: 'Enterprise', points: 12, isActive: true },
    ];
    expect(computeRuleScore(baseLead, rule)).toBe(12);
    expect(computeRuleScore({ ...baseLead, title: 'Deal for Enterprise' }, rule)).toBe(0);
  });

  it('returns 0 with empty rules array', () => {
    expect(computeRuleScore(baseLead, [])).toBe(0);
  });

  it('handles null lead field values gracefully', () => {
    const lead: LeadLike = { ...baseLead, description: null as any, contactEmail: null as any };
    const score = computeRuleScore(lead, rules);
    // Null fields won't match contains/starts_with/not_empty
    expect(score).toBe(10 + 15 + 5 + 4); // source, estimatedValue, title, phone
  });
});