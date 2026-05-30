import { computeDsr, getDsrStatus } from '../credit/services/retailIncome.service';

jest.mock('../utils/prisma', () => ({
  retailIncome: { upsert: jest.fn(), findUnique: jest.fn() },
}));

describe('computeDsr', () => {
  it('computes DSR as percentage of gross income', () => {
    const dsr = computeDsr({
      monthlyGrossIncome: 5000,
      hirePurchaseCommitment: 500,
      creditCardCommitment: 200,
      existingLoanCommitment: 0,
      otherCommitments: 0,
      proposedInstalment: 800,
    });
    // (500+200+800) / 5000 * 100 = 30
    expect(dsr).toBeCloseTo(30, 1);
  });

  it('returns 0 when gross income is 0', () => {
    const dsr = computeDsr({
      monthlyGrossIncome: 0,
      hirePurchaseCommitment: 0,
      creditCardCommitment: 0,
      existingLoanCommitment: 0,
      otherCommitments: 0,
      proposedInstalment: 0,
    });
    expect(dsr).toBe(0);
  });

  it('sums all commitment types', () => {
    const dsr = computeDsr({
      monthlyGrossIncome: 10000,
      hirePurchaseCommitment: 1000,
      creditCardCommitment: 500,
      existingLoanCommitment: 500,
      otherCommitments: 200,
      proposedInstalment: 800,
    });
    // (1000+500+500+200+800) / 10000 * 100 = 30
    expect(dsr).toBeCloseTo(30, 1);
  });
});

describe('getDsrStatus', () => {
  it('returns pass for DSR ≤ 60', () => {
    expect(getDsrStatus(50)).toBe('pass');
    expect(getDsrStatus(60)).toBe('pass');
  });

  it('returns warning for DSR 61–70', () => {
    expect(getDsrStatus(61)).toBe('warning');
    expect(getDsrStatus(70)).toBe('warning');
  });

  it('returns fail for DSR > 70', () => {
    expect(getDsrStatus(70.1)).toBe('fail');
    expect(getDsrStatus(85)).toBe('fail');
  });
});
