import { buildSlaCalculator } from '../dashboard.service';

const NOW = new Date('2026-08-20T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000);

const policies = [
  { id: 'p-uw', targetState: 'UNDERWRITING', slaHours: 48, productType: null },
  { id: 'p-tl', targetState: 'SUBMITTED', slaHours: 24, productType: 'TERM_LOAN' },
];
const overrides = [{ policyId: 'p-uw', branchId: 'br-kl', slaHours: 12 }];

describe('buildSlaCalculator', () => {
  const calc = buildSlaCalculator(policies, overrides, NOW);

  it('returns remaining hours against the policy for the current state', () => {
    const r = calc.compute(
      { state: 'UNDERWRITING', branchId: null, productType: 'TERM_LOAN', createdAt: hoursAgo(8) },
      false,
    );
    expect(r.slaRemainingHours).toBe(40);
    expect(r.slaStatus).toBe('OK');
  });

  it('honours a branch override in place of the policy hours', () => {
    const r = calc.compute(
      { state: 'UNDERWRITING', branchId: 'br-kl', productType: 'TERM_LOAN', createdAt: hoursAgo(8) },
      false,
    );
    expect(r.slaRemainingHours).toBe(4);
  });

  it('returns WARNING inside the final 25% of the window', () => {
    const r = calc.compute(
      { state: 'UNDERWRITING', branchId: null, productType: 'TERM_LOAN', createdAt: hoursAgo(40) },
      false,
    );
    expect(r.slaStatus).toBe('WARNING');
    expect(r.slaRemainingHours).toBe(8);
  });

  it('ignores a product-specific policy when the product does not match', () => {
    const r = calc.compute(
      { state: 'SUBMITTED', branchId: null, productType: 'OVERDRAFT', createdAt: hoursAgo(100) },
      false,
    );
    expect(r.slaStatus).toBe('OK');
    expect(r.slaRemainingHours).toBeNull();
  });

  it('returns OK with null hours when no policy targets the state', () => {
    const r = calc.compute(
      { state: 'DRAFT', branchId: null, productType: 'TERM_LOAN', createdAt: hoursAgo(500) },
      false,
    );
    expect(r.slaStatus).toBe('OK');
    expect(r.slaRemainingHours).toBeNull();
  });

  it('reports OVERDUE with zero remaining when a breach record exists', () => {
    const r = calc.compute(
      { state: 'UNDERWRITING', branchId: null, productType: 'TERM_LOAN', createdAt: hoursAgo(1) },
      true,
    );
    expect(r.slaStatus).toBe('OVERDUE');
    expect(r.slaRemainingHours).toBe(0);
  });

  it('reports OVERDUE once the window has elapsed even before the breach job runs', () => {
    const r = calc.compute(
      { state: 'UNDERWRITING', branchId: null, productType: 'TERM_LOAN', createdAt: hoursAgo(60) },
      false,
    );
    expect(r.slaStatus).toBe('OVERDUE');
    expect(r.slaRemainingHours).toBe(0);
  });
});
