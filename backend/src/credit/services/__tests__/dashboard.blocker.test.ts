import { resolveBlocker } from '../dashboard.service';

const base = {
  state: 'UNDERWRITING',
  slaStatus: 'OK' as const,
  daysOverdue: null,
  breachPolicyName: null,
  openConditionCount: null,
  currentTask: 'Complete underwriting',
  flags: { expiredBureau: false, highDsr: false, amlReview: false },
};

describe('resolveBlocker', () => {
  it('ranks an SLA breach above every other signal', () => {
    expect(resolveBlocker({ ...base, state: 'REFERRED_BACK', slaStatus: 'OVERDUE', daysOverdue: 3, breachPolicyName: 'Underwriting 48h', openConditionCount: 2, flags: { expiredBureau: true, highDsr: false, amlReview: false } })).toBe('Overdue 3 days — Underwriting 48h');
  });
  it('names the outstanding condition count when returned', () => {
    expect(resolveBlocker({ ...base, state: 'REFERRED_BACK', openConditionCount: 2 })).toBe('Returned by credit — 2 conditions outstanding');
  });
  it('singularises a lone outstanding condition', () => {
    expect(resolveBlocker({ ...base, state: 'KYC_REJECTED', openConditionCount: 1 })).toBe('Returned by credit — 1 condition outstanding');
  });
  it('reports an information request on compliance hold', () => {
    expect(resolveBlocker({ ...base, state: 'COMPLIANCE_HOLD' })).toBe('Information requested from customer');
  });
  it('surfaces an expired bureau report when nothing higher applies', () => {
    expect(resolveBlocker({ ...base, flags: { expiredBureau: true, highDsr: true, amlReview: false } })).toBe('Bureau report expired');
  });
  it('surfaces high DSR below the bureau flag', () => {
    expect(resolveBlocker({ ...base, flags: { expiredBureau: false, highDsr: true, amlReview: false } })).toBe('DSR above policy threshold');
  });
  it('surfaces AML review below DSR', () => {
    expect(resolveBlocker({ ...base, flags: { expiredBureau: false, highDsr: false, amlReview: true } })).toBe('Pending AML review');
  });
  it('falls back to the state-derived task when nothing is blocking', () => {
    expect(resolveBlocker(base)).toBe('Complete underwriting');
  });
  it('falls back when returned but the condition count is unavailable', () => {
    expect(resolveBlocker({ ...base, state: 'REFERRED_BACK', currentTask: 'Resolve returned items' })).toBe('Returned by credit');
  });
});
