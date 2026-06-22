import {
  deriveBorrowerBureauCaps,
  deriveReasonCodes,
  deriveMissingInputs,
  computeBorrowerTotalScore,
  BorrowerScoreInputs,
} from '../borrowerScoring.service';

const baseInputs: BorrowerScoreInputs = {
  ratioMap: {},
  isRetail: true,
  dsrPercent: 30,
  creditScore: 720,
  facilityConductStatuses: [],
  hasFinancialStatement: true,
  hasIncome: true,
};

describe('deriveBorrowerBureauCaps', () => {
  it('returns no caps for a clean profile', () => {
    expect(deriveBorrowerBureauCaps(720, [])).toEqual([]);
  });

  it('caps at BB for a low CTOS-style score (<500)', () => {
    const caps = deriveBorrowerBureauCaps(450, []);
    expect(caps).toContainEqual({ reason: 'borrower_score_lt_500', maxRating: 'BB' });
  });

  it('caps at B for a very low score (<300)', () => {
    const caps = deriveBorrowerBureauCaps(280, []);
    expect(caps).toContainEqual({ reason: 'borrower_score_lt_300', maxRating: 'B' });
  });

  it('caps at C when any facility is IMPAIRED', () => {
    const caps = deriveBorrowerBureauCaps(720, ['PERFORMING', 'IMPAIRED']);
    expect(caps).toContainEqual({ reason: 'facility_impaired', maxRating: 'C' });
  });

  it('caps at B when a facility is CCRIS_RR (rescheduled/restructured)', () => {
    const caps = deriveBorrowerBureauCaps(720, ['CCRIS_RR']);
    expect(caps).toContainEqual({ reason: 'facility_rescheduled', maxRating: 'B' });
  });
});

describe('deriveMissingInputs', () => {
  it('flags missing income for a retail borrower', () => {
    const inputs = { ...baseInputs, hasIncome: false, dsrPercent: null };
    expect(deriveMissingInputs(inputs)).toContain('borrower_income');
  });

  it('flags missing financial statement for a corporate borrower', () => {
    const inputs = { ...baseInputs, isRetail: false, hasFinancialStatement: false };
    expect(deriveMissingInputs(inputs)).toContain('financial_statement');
  });

  it('flags missing bureau score', () => {
    const inputs = { ...baseInputs, creditScore: null };
    expect(deriveMissingInputs(inputs)).toContain('bureau_score');
  });

  it('returns empty when all inputs present', () => {
    expect(deriveMissingInputs(baseInputs)).toEqual([]);
  });
});

describe('deriveReasonCodes', () => {
  it('includes a reason for each bureau cap applied', () => {
    const codes = deriveReasonCodes(baseInputs, 'A', ['facility_impaired']);
    expect(codes.map((c) => c.code)).toContain('facility_impaired');
  });

  it('flags high DSR for retail borrowers', () => {
    const inputs = { ...baseInputs, dsrPercent: 72 };
    const codes = deriveReasonCodes(inputs, 'BB', []);
    expect(codes.map((c) => c.code)).toContain('high_dsr');
  });
});

describe('computeBorrowerTotalScore', () => {
  const weights = {
    financial_performance: 20, leverage: 15, liquidity: 10, cashflow: 20,
    management: 10, industry: 10, collateral: 10, relationship: 5, market_conditions: 0,
  };

  it('weights factor scores into a 0-100 total and maps to a rating', () => {
    const { totalScore, factorScores } = computeBorrowerTotalScore(
      { ratioMap: { current_ratio: 2.5, dscr: 2.5 }, isRetail: false, dsrPercent: null,
        creditScore: 720, facilityConductStatuses: [], hasFinancialStatement: true, hasIncome: false },
      weights as any,
    );
    expect(totalScore).toBeGreaterThan(0);
    expect(totalScore).toBeLessThanOrEqual(100);
    expect(factorScores.cashflow.weightedScore).toBeCloseTo(
      (factorScores.cashflow.score * 20) / 100, 2,
    );
  });

  it('uses DSR cashflow score for retail borrowers', () => {
    const { factorScores } = computeBorrowerTotalScore(
      { ratioMap: {}, isRetail: true, dsrPercent: 30, creditScore: 700,
        facilityConductStatuses: [], hasFinancialStatement: false, hasIncome: true },
      weights as any,
    );
    // DSR 30% -> 100 - (30/60)*20 = 90
    expect(factorScores.cashflow.score).toBeCloseTo(90, 1);
  });
});