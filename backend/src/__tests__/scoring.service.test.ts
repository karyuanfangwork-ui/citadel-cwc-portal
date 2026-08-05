import { computeDsrCashflowScore } from '../credit/services/scoring.service';

describe('computeDsrCashflowScore', () => {
  it('returns ~80 for DSR at exactly 60% (pass boundary)', () => {
    expect(computeDsrCashflowScore(60)).toBeCloseTo(80, 0);
  });

  it('returns ~80 for DSR well below 60%', () => {
    expect(computeDsrCashflowScore(30)).toBeGreaterThan(80);
  });

  it('returns ~50 for DSR at exactly 65% (midpoint of warning band)', () => {
    expect(computeDsrCashflowScore(65)).toBeCloseTo(50, 0);
  });

  it('returns ~20 for DSR at exactly 70% (fail boundary)', () => {
    expect(computeDsrCashflowScore(70)).toBeCloseTo(20, 0);
  });

  it('returns 0 for DSR far above 70%', () => {
    expect(computeDsrCashflowScore(100)).toBeLessThanOrEqual(20);
  });

  it('returns 100 for DSR of 0%', () => {
    expect(computeDsrCashflowScore(0)).toBe(100);
  });
});