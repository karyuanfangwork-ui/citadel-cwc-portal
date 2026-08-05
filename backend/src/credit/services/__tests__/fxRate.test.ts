import { toBase, getRate } from '../fxRate.service';

// ---------------------------------------------------------------------------
// Mock prisma — matches project convention (see exposureCompute.test.ts)
// ---------------------------------------------------------------------------
jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditFxRate: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

const mockFindFirst = jest.requireMock('../../../utils/prisma').default.creditFxRate.findFirst as jest.Mock;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fxRate.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── toBase ─────────────────────────────────────────────────────────────

  describe('toBase', () => {
    it('passes MYR through at 1:1 (no DB lookup)', async () => {
      const result = await toBase(100_000, 'MYR');
      expect(result).toBe(100_000);
      // Should not call the DB at all for MYR
      expect(mockFindFirst).not.toHaveBeenCalled();
    });

    it('converts USD to MYR using the latest rate', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'rate-1',
        currency: 'USD',
        rateToBase: 4.72,
        effectiveDate: new Date('2026-01-01'),
        createdAt: new Date(),
      });

      // 10,000 USD * 4.72 = 47,200 MYR
      const result = await toBase(10_000, 'USD');
      expect(result).toBeCloseTo(47_200, 0);
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ currency: 'USD' }),
        }),
      );
    });

    it('converts SGD to MYR using the latest rate', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'rate-2',
        currency: 'SGD',
        rateToBase: 3.50,
        effectiveDate: new Date('2026-01-01'),
        createdAt: new Date(),
      });

      // 50,000 SGD * 3.50 = 175,000 MYR
      const result = await toBase(50_000, 'SGD');
      expect(result).toBeCloseTo(175_000, 0);
    });

    it('respects the asOf date for historical rates', async () => {
      const historicalDate = new Date('2025-06-01');

      mockFindFirst.mockResolvedValue({
        id: 'rate-hist',
        currency: 'USD',
        rateToBase: 4.45,
        effectiveDate: new Date('2025-06-01'),
        createdAt: new Date(),
      });

      const result = await toBase(10_000, 'USD', historicalDate);
      expect(result).toBeCloseTo(44_500, 0);

      // Verify the query used the provided date
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            currency: 'USD',
            effectiveDate: { lte: historicalDate },
          }),
        }),
      );
    });

    it('throws BadRequestError when no rate exists for a non-MYR currency', async () => {
      mockFindFirst.mockResolvedValue(null);

      await expect(toBase(10_000, 'EUR')).rejects.toThrow(/No FX rate found for currency EUR/);
    });

    it('handles lowercase currency codes (normalizes to uppercase)', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'rate-3',
        currency: 'USD',
        rateToBase: 4.72,
        effectiveDate: new Date('2026-01-01'),
        createdAt: new Date(),
      });

      await toBase(10_000, 'usd');
      // The query should use uppercase
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ currency: 'USD' }),
        }),
      );
    });
  });

  // ── getRate ────────────────────────────────────────────────────────────

  describe('getRate', () => {
    it('returns 1 for MYR', async () => {
      const rate = await getRate('MYR');
      expect(rate).toBe(1);
      expect(mockFindFirst).not.toHaveBeenCalled();
    });

    it('returns the stored rate for non-MYR currencies', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'rate-1',
        currency: 'USD',
        rateToBase: 4.72,
        effectiveDate: new Date('2026-01-01'),
        createdAt: new Date(),
      });

      const rate = await getRate('USD');
      expect(rate).toBe(4.72);
    });

    it('throws BadRequestError when no rate exists for a non-MYR currency', async () => {
      mockFindFirst.mockResolvedValue(null);
      await expect(getRate('JPY')).rejects.toThrow(/No FX rate found for currency JPY/);
    });
  });
});