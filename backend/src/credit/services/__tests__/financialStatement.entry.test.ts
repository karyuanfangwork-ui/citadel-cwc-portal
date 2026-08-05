/**
 * F4 — Financial Statement Template & Add-Row Tests
 */
jest.mock('../../../utils/prisma', () => {
  let _nextId = 1;

  return {
    __esModule: true,
    default: {
      borrowerProfile: {
        findUnique: jest.fn().mockResolvedValue({ borrowerType: 'CORPORATE' }),
      },
      financialStatement: {
        create: jest.fn().mockImplementation(({ data, include }) => {
          const lineItems = (data as any).lineItems?.create ?? [];
          return Promise.resolve({
            id: 'stmt-1',
            ...data,
            lineItems,
            enteredBy: { id: 'u1', firstName: 'Test', lastName: 'User', email: 't@t' },
          });
        }),
        findFirst: jest.fn().mockResolvedValue({ id: 'stmt-1' }),
      },
      financialLineItem: {
        aggregate: jest.fn().mockResolvedValue({ _max: { displayOrder: 5 } }),
        create: jest.fn().mockImplementation(({ data }) => {
          return Promise.resolve({ id: `line-${_nextId++}`, ...data, amount: 0 });
        }),
      },
    },
  };
});

import prisma from '../../../utils/prisma';
import { financialService } from '../financial.service';

describe('Financial Statement Templates & Add Row (F4)', () => {
  describe('createStatement — auto-populate', () => {
    it('auto-populates template rows for CORPORATE borrower (BS)', async () => {
      (prisma.borrowerProfile.findUnique as jest.Mock).mockResolvedValue({ borrowerType: 'CORPORATE' });

      const result = await financialService.createStatement({
        borrowerProfileId: 'bp-1',
        period: 'FY2025',
        fiscalYearEnd: '2025-12-31',
        statementType: 'BS',
        currency: 'MYR',
        enteredById: 'u1',
      });

      expect(result.lineItems).toBeDefined();
      expect(result.lineItems.length).toBeGreaterThan(0);
      // Balance sheet should have key rows
      const keys = result.lineItems.map((l: any) => l.lineKey);
      expect(keys).toContain('cash_and_cash_equivalents');
      expect(keys).toContain('total_assets');
      expect(keys).toContain('total_equity');
      // All amounts should be 0
      result.lineItems.forEach((l: any) => {
        expect(Number(l.amount)).toBe(0);
      });
    });

    it('does NOT auto-populate for INDIVIDUAL borrower', async () => {
      (prisma.borrowerProfile.findUnique as jest.Mock).mockResolvedValue({ borrowerType: 'INDIVIDUAL' });

      const result = await financialService.createStatement({
        borrowerProfileId: 'bp-2',
        period: 'FY2025',
        fiscalYearEnd: '2025-12-31',
        statementType: 'BS',
        currency: 'MYR',
        enteredById: 'u1',
      });

      // For INDIVIDUAL, template rows are empty, so include.lineItems = false → not in result
      // OR lineItems is empty array
      const count = Array.isArray(result.lineItems) ? result.lineItems.length : 0;
      expect(count).toBe(0);
    });

    it('auto-populates PL template for CORPORATE borrower', async () => {
      (prisma.borrowerProfile.findUnique as jest.Mock).mockResolvedValue({ borrowerType: 'CORPORATE' });

      const result = await financialService.createStatement({
        borrowerProfileId: 'bp-1',
        period: 'FY2025',
        fiscalYearEnd: '2025-12-31',
        statementType: 'PL',
        currency: 'MYR',
        enteredById: 'u1',
      });

      expect(result.lineItems).toBeDefined();
      const keys = result.lineItems.map((l: any) => l.lineKey);
      expect(keys).toContain('revenue');
      expect(keys).toContain('net_profit');
    });
  });

  describe('addLine — single row add', () => {
    it('creates a new line item on an existing statement', async () => {
      (prisma.financialStatement.findFirst as jest.Mock).mockResolvedValue({ id: 'stmt-1' });

      const result = await financialService.addLine('stmt-1', 'custom_key', 'Custom Line');

      expect(result).not.toBeNull();
      expect(result!.lineKey).toBe('custom_key');
      expect(result!.lineLabel).toBe('Custom Line');
      expect(result!.displayOrder).toBe(6); // max was 5, so next is 6
    });

    it('returns null for nonexistent statement', async () => {
      (prisma.financialStatement.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await financialService.addLine('nonexistent', 'key', 'Label');

      expect(result).toBeNull();
    });
  });
});