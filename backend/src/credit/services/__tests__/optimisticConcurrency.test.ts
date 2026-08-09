// backend/src/credit/services/__tests__/optimisticConcurrency.test.ts
import { assertVersionMatch } from '../../utils/optimisticConcurrency';

describe('LOS-018 — assertVersionMatch', () => {
  const now = new Date('2026-08-09T10:00:00.000Z');

  it('passes when the client omits the token (backward compatible)', () => {
    expect(() => assertVersionMatch(now, undefined, 'FinancialStatement')).not.toThrow();
  });

  it('passes when the token matches', () => {
    expect(() => assertVersionMatch(now, now.toISOString(), 'FinancialStatement')).not.toThrow();
  });

  it('throws 409 when the record moved on', () => {
    const stale = new Date('2026-08-09T09:59:00.000Z').toISOString();
    try {
      assertVersionMatch(now, stale, 'FinancialStatement');
      throw new Error('expected assertVersionMatch to throw');
    } catch (e: any) {
      expect(e.statusCode).toBe(409);
      expect(e.message).toMatch(/FinancialStatement/);
      expect(e.message).toMatch(/changed since you loaded it/i);
    }
  });

  it('throws 409 when the token is unparseable', () => {
    expect(() => assertVersionMatch(now, 'not-a-date', 'Collateral')).toThrow(
      expect.objectContaining({ statusCode: 409 }),
    );
  });

  it('throws 409 when the record has no timestamp but a token was supplied', () => {
    expect(() => assertVersionMatch(null, now.toISOString(), 'Collateral')).toThrow(
      expect.objectContaining({ statusCode: 409 }),
    );
  });
});