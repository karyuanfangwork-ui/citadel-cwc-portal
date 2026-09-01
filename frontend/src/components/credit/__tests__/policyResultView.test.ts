import {
  VERDICT_ORDER,
  sortResults,
  groupBySource,
  SOURCE_LABELS,
  verdictTone,
  triggerLabel,
  isEvaluationError,
} from '../policyResultView';
import type { PolicyResultRow } from '../../../services/credit.service';

const row = (over: Partial<PolicyResultRow> = {}): PolicyResultRow => ({
  id: 'r1', ruleCode: 'READINESS.signoff', verdict: 'PASS', source: 'READINESS',
  actual: null, threshold: null, message: 'ok', ...over,
});

describe('sortResults', () => {
  it('puts failures first, then warnings, then passes', () => {
    const sorted = sortResults([
      row({ id: 'p', verdict: 'PASS', ruleCode: 'A.pass' }),
      row({ id: 'f', verdict: 'FAIL', ruleCode: 'Z.fail' }),
      row({ id: 'w', verdict: 'WARN', ruleCode: 'M.warn' }),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['f', 'w', 'p']);
  });

  it('sorts alphabetically by ruleCode within a verdict', () => {
    const sorted = sortResults([
      row({ id: '2', verdict: 'FAIL', ruleCode: 'LIMIT.SECTOR.b' }),
      row({ id: '1', verdict: 'FAIL', ruleCode: 'LIMIT.SECTOR.a' }),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['1', '2']);
  });

  it('does not mutate its input', () => {
    const input = [row({ id: 'p', verdict: 'PASS' }), row({ id: 'f', verdict: 'FAIL' })];
    sortResults(input);
    expect(input.map((r) => r.id)).toEqual(['p', 'f']);
  });

  it('VERDICT_ORDER is failure-first', () => {
    expect(VERDICT_ORDER).toEqual(['FAIL', 'WARN', 'PASS']);
  });
});

describe('groupBySource', () => {
  it('groups rows under their source, keeping each group sorted', () => {
    const groups = groupBySource([
      row({ id: 'a', source: 'READINESS', verdict: 'PASS', ruleCode: 'READINESS.z' }),
      row({ id: 'b', source: 'POLICY_LIMIT', verdict: 'FAIL', ruleCode: 'LIMIT.SECTOR.x' }),
      row({ id: 'c', source: 'READINESS', verdict: 'FAIL', ruleCode: 'READINESS.a' }),
    ]);
    expect(groups.map((g) => g.source)).toEqual(['POLICY_LIMIT', 'READINESS']);
    expect(groups[1].results.map((r) => r.id)).toEqual(['c', 'a']);
  });

  it('orders groups by worst verdict, so failing sources surface first', () => {
    const groups = groupBySource([
      row({ id: 'ok', source: 'BUREAU', verdict: 'PASS' }),
      row({ id: 'bad', source: 'DEVIATION', verdict: 'FAIL' }),
      row({ id: 'warn', source: 'MISSING_DATA', verdict: 'WARN' }),
    ]);
    expect(groups.map((g) => g.source)).toEqual(['DEVIATION', 'MISSING_DATA', 'BUREAU']);
  });

  it('returns nothing for an empty evaluation', () => {
    expect(groupBySource([])).toEqual([]);
  });

  it('labels every known source, and falls back to the raw value', () => {
    for (const s of ['POLICY_LIMIT', 'READINESS', 'DEVIATION', 'BUREAU', 'MISSING_DATA']) {
      expect(SOURCE_LABELS[s]).toEqual(expect.any(String));
    }
    const [group] = groupBySource([row({ source: 'SOMETHING_NEW' })]);
    expect(group.label).toBe('SOMETHING_NEW');
  });
});

describe('verdictTone', () => {
  it('gives each verdict a distinct tone with a text label', () => {
    const tones = (['FAIL', 'WARN', 'PASS'] as const).map(verdictTone);
    expect(tones.map((t) => t.label)).toEqual(['Failed', 'Warning', 'Passed']);
    expect(new Set(tones.map((t) => t.className)).size).toBe(3);
  });

  it('never relies on colour alone — every tone carries a label', () => {
    for (const v of ['FAIL', 'WARN', 'PASS'] as const) {
      expect(verdictTone(v).label.length).toBeGreaterThan(0);
    }
  });
});

describe('triggerLabel', () => {
  it('renders the four lifecycle actions in plain language', () => {
    expect(triggerLabel('submit_to_committee')).toBe('Submitted to committee');
    expect(triggerLabel('resume_committee')).toBe('Resumed committee review');
    expect(triggerLabel('approve')).toBe('Approved');
    expect(triggerLabel('reject')).toBe('Rejected');
  });

  it('falls back to the raw action rather than hiding it', () => {
    expect(triggerLabel('something_new')).toBe('something_new');
  });
});

describe('isEvaluationError', () => {
  it('identifies a source that failed to evaluate', () => {
    expect(isEvaluationError(row({ ruleCode: 'POLICY_LIMIT.EVALUATION_ERROR' }))).toBe(true);
  });

  it('does not mistake a normal failing rule for an evaluator error', () => {
    expect(isEvaluationError(row({ ruleCode: 'LIMIT.SECTOR.abc', verdict: 'FAIL' }))).toBe(false);
  });
});
