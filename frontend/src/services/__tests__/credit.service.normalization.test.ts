import { describe, expect, it } from 'vitest';
import { normalizeApplication } from '../credit.service';

describe('normalizeApplication', () => {
  it('converts Prisma Decimal JSON strings to numeric amounts', () => {
    const application = normalizeApplication({
      id: 'app-1',
      requestedAmount: '2000000',
      facilities: [{ amount: '2000000', ratePct: '4.25', recommendedAmount: '1900000' }],
    });

    expect(application.requestedAmount).toBe(2000000);
    expect(typeof application.requestedAmount).toBe('number');
    expect(application.facilities?.[0]).toMatchObject({
      amount: 2000000,
      ratePct: 4.25,
      recommendedAmount: 1900000,
    });
  });

  it('converts Prisma Decimal JSON internals from facility responses', () => {
    const application = normalizeApplication({
      id: 'app-decimal',
      requestedAmount: { s: 1, e: 6, d: [2000000] },
      facilities: [{
        amount: { s: 1, e: 6, d: [2000000] },
        ratePct: { s: 1, e: 0, d: [4, 2500000] },
        recommendedAmount: { s: 1, e: 6, d: [1900000] },
      }],
    });

    expect(application.requestedAmount).toBe(2000000);
    expect(application.facilities?.[0]).toMatchObject({
      amount: 2000000,
      ratePct: 4.25,
      recommendedAmount: 1900000,
    });
  });

  it('preserves missing amounts as null instead of inventing zero', () => {
    const application = normalizeApplication({
      id: 'app-2',
      requestedAmount: null,
    });

    expect(application.requestedAmount).toBeNull();
  });

  it('turns malformed amounts into a safe missing value', () => {
    const application = normalizeApplication({
      id: 'app-3',
      requestedAmount: 'not-a-number',
    });

    expect(application.requestedAmount).toBeNull();
  });
});
