import { recommendDecision } from '../decisionEngine.service';
import { RiskRating } from '../../types/credit.types';

describe('recommendDecision', () => {
  it('recommends APPROVE for high score, low risk, no flags', () => {
    const result = recommendDecision({
      score: 85, rating: 'AAA' as RiskRating,
      amlBlocked: false, fraudFlags: [],
    });
    expect(result.recommendation).toBe('APPROVE');
    expect(result.ruleTrace.length).toBeGreaterThan(0);
  });

  it('recommends REJECT when AML is blocked', () => {
    const result = recommendDecision({
      score: 90, rating: 'AAA' as RiskRating,
      amlBlocked: true, fraudFlags: [],
    });
    expect(result.recommendation).toBe('REJECT');
    expect(result.ruleTrace.some((r) => r.rule.includes('AML'))).toBe(true);
  });

  it('recommends REJECT when fraud flags are present', () => {
    const result = recommendDecision({
      score: 80, rating: 'AA' as RiskRating,
      amlBlocked: false, fraudFlags: ['SANCTION_MATCH'],
    });
    expect(result.recommendation).toBe('REJECT');
    expect(result.ruleTrace.some((r) => r.rule.includes('FRAUD'))).toBe(true);
  });

  it('recommends REJECT for D rating (prohibited risk)', () => {
    const result = recommendDecision({
      score: 10, rating: 'D' as RiskRating,
      amlBlocked: false, fraudFlags: [],
    });
    expect(result.recommendation).toBe('REJECT');
  });

  it('recommends REJECT for CCC or worse rating', () => {
    const result = recommendDecision({
      score: 35, rating: 'CC' as RiskRating,
      amlBlocked: false, fraudFlags: [],
    });
    expect(result.recommendation).toBe('REJECT');
  });

  it('recommends CONDITIONAL for moderate risk (BBB-BB)', () => {
    const result = recommendDecision({
      score: 60, rating: 'BB' as RiskRating,
      amlBlocked: false, fraudFlags: [],
    });
    expect(result.recommendation).toBe('CONDITIONAL');
  });

  it('recommends CONDITIONAL when missing inputs are present', () => {
    const result = recommendDecision({
      score: 75, rating: 'A' as RiskRating,
      amlBlocked: false, fraudFlags: [],
      missingInputs: [{ factor: 'cashflow', subField: 'dscr', policy: 'NEUTRAL', appliedScore: 50 }],
    });
    expect(result.recommendation).toBe('CONDITIONAL');
    expect(result.ruleTrace.some((r) => r.rule.includes('MISSING'))).toBe(true);
  });

  it('stricter-rule-wins: AML blocked overrides high score APPROVE', () => {
    const result = recommendDecision({
      score: 95, rating: 'AAA' as RiskRating,
      amlBlocked: true, fraudFlags: [],
    });
    expect(result.recommendation).toBe('REJECT');
  });

  it('stricter-rule-wins: fraud flag overrides CONDITIONAL rating', () => {
    const result = recommendDecision({
      score: 55, rating: 'BB' as RiskRating,
      amlBlocked: false, fraudFlags: ['HIGH_RISK_COUNTRY'],
    });
    expect(result.recommendation).toBe('REJECT');
  });

  it('APPROVE for A rating with no flags', () => {
    const result = recommendDecision({
      score: 72, rating: 'A' as RiskRating,
      amlBlocked: false, fraudFlags: [],
    });
    expect(result.recommendation).toBe('APPROVE');
  });
});