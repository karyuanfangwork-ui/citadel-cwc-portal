import {
  normalisePolicyLimits,
  normaliseReadiness,
  normaliseDeviations,
  normaliseBureauFreshness,
  normaliseMissingInputs,
  summarisePolicyResults,
  type PolicyResultEntry,
} from '../policyResult';

const block = (over: Record<string, unknown> = {}) => ({
  limitId: 'lim-1', limitType: 'SINGLE_BORROWER', severity: 'HARD' as const,
  thresholdValue: 5_000_000, proposedValue: 6_000_000, message: 'Exceeds cap.', ...over,
});

describe('policy result normalisers', () => {
  it('maps hard and soft limit blocks and warnings', () => {
    expect(normalisePolicyLimits({ blocks: [block()], warnings: [block({ severity: 'HARD' })] }).map((e) => e.verdict)).toEqual(['FAIL', 'WARN']);
    expect(normalisePolicyLimits({ blocks: [block({ severity: 'SOFT' })], warnings: [] })[0].verdict).toBe('WARN');
    expect(normalisePolicyLimits({ blocks: [], warnings: [] })).toEqual([]);
  });

  it('maps readiness errors, warnings and satisfied rules', () => {
    const entries = normaliseReadiness({
      errors: [{ field: 'bureau', message: 'missing', severity: 'error' }],
      warnings: [{ field: 'collateral', message: 'none', severity: 'warning' }],
      satisfied: [{ field: 'signoff', message: 'ok', severity: 'info' }],
    });
    expect(entries.map((e) => [e.ruleCode, e.verdict])).toEqual([
      ['READINESS.bureau', 'FAIL'], ['READINESS.collateral', 'WARN'], ['READINESS.signoff', 'PASS'],
    ]);
    expect(entries[0].actual).toBeNull();
    expect(entries[0].threshold).toBeNull();
  });

  it('maps pending deviations to fail and no pending deviations to pass', () => {
    expect(normaliseDeviations({ pendingCount: 2, approvedCount: 1, rejectedCount: 0, total: 3 })[0]).toMatchObject({ verdict: 'FAIL', actual: '2', threshold: '0' });
    expect(normaliseDeviations({ pendingCount: 0, approvedCount: 0, rejectedCount: 0, total: 0 })[0].verdict).toBe('PASS');
  });

  it('maps bureau freshness to advisory warning or pass', () => {
    expect(normaliseBureauFreshness({ fresh: false, staleProviders: ['CTOS', 'CCRIS'] })[0]).toMatchObject({ verdict: 'WARN', actual: 'CTOS, CCRIS' });
    expect(normaliseBureauFreshness({ fresh: true, staleProviders: [] })[0].verdict).toBe('PASS');
  });

  it('maps missing data policies and ignores malformed JSON', () => {
    const entries = normaliseMissingInputs([
      { factor: 'cashflow', subField: 'ocf', policy: 'BLOCK' },
      { factor: 'leverage', subField: 'debt', policy: 'PENALTY' },
      { factor: 'industry', subField: 'sector', policy: 'NEUTRAL' },
    ]);
    expect(entries.map((e) => [e.ruleCode, e.verdict])).toEqual([
      ['MISSING_DATA.cashflow.ocf', 'FAIL'], ['MISSING_DATA.leverage.debt', 'WARN'], ['MISSING_DATA.industry.sector', 'PASS'],
    ]);
    expect(normaliseMissingInputs(null)).toEqual([]);
    expect(normaliseMissingInputs(undefined)).toEqual([]);
    expect(normaliseMissingInputs('bad')).toEqual([]);
    expect(normaliseMissingInputs([{ nonsense: true }])).toEqual([]);
  });

  it('summarises verdicts with fail-over-warn-over-pass precedence', () => {
    const entry = (verdict: 'PASS' | 'WARN' | 'FAIL'): PolicyResultEntry => ({ ruleCode: verdict, verdict, actual: null, threshold: null, message: 'm', source: 'READINESS' });
    expect(summarisePolicyResults([entry('PASS'), entry('WARN'), entry('FAIL')])).toEqual({ total: 3, passed: 1, warned: 1, failed: 1, overall: 'FAIL' });
    expect(summarisePolicyResults([entry('PASS'), entry('WARN')]).overall).toBe('WARN');
    expect(summarisePolicyResults([])).toEqual({ total: 0, passed: 0, warned: 0, failed: 0, overall: 'PASS' });
  });
});
