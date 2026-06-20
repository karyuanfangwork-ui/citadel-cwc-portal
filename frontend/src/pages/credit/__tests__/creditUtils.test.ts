import { describe, expect, it } from 'vitest';
import { getPhaseCompletion } from '../../../../pages/credit/creditUtils';

describe('getPhaseCompletion', () => {
  it('does not require facilities for PERSONAL_FAST loan requests', () => {
    const result = getPhaseCompletion({
      requestedAmount: 50000,
      requestedTenor: 24,
      productType: 'TERM_LOAN',
      purpose: 'Home renovation',
      lane: 'PERSONAL_FAST',
      borrowerType: 'INDIVIDUAL',
      facilities: [],
      financialStatements: [],
      creditBureauChecks: [],
      creditDecisions: [],
      parties: [],
      isSecured: false,
    });

    expect(result.s1).toBe('complete');
  });

  it('still requires at least one facility for non-PERSONAL_FAST applications', () => {
    const result = getPhaseCompletion({
      requestedAmount: 50000,
      requestedTenor: 24,
      productType: 'TERM_LOAN',
      purpose: 'Working capital',
      lane: 'SME',
      borrowerType: 'SOLE_PROPRIETOR',
      facilities: [],
      financialStatements: [],
      creditBureauChecks: [],
      creditDecisions: [],
      parties: [],
      isSecured: false,
    });

    expect(result.s1).toBe('incomplete');
  });
});
