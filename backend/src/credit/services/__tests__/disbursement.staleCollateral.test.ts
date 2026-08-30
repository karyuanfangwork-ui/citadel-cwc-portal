/** GAP-P1-12 — disbursement-order path must enforce stale collateral. */

import { DisbursementStatus } from '@prisma/client';

const orderFindUniqueMock = jest.fn();
const conditionFindManyMock = jest.fn();
const staleCheckMock = jest.fn();

jest.mock('../../../utils/prisma', () => {
  const mockPrisma: any = {
    disbursementOrder: {
      findUnique: (...args: unknown[]) => orderFindUniqueMock(...args),
      update: jest.fn().mockResolvedValue({ id: 'order-1' }),
    },
    condition: {
      findMany: (...args: unknown[]) => conditionFindManyMock(...args),
    },
    creditApplication: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  mockPrisma.$transaction = jest.fn(async (fn: any) => fn(mockPrisma));
  return { __esModule: true, default: mockPrisma };
});

jest.mock('../auditChain.service', () => ({
  AuditChainService: { appendEvent: jest.fn().mockResolvedValue('evt-1') },
}));

jest.mock('../../jobs/collateralInsuranceMonitor.job', () => ({
  hasStaleCollateralValuations: (...args: unknown[]) => staleCheckMock(...args),
}));

jest.mock('../../../services/notification.service', () => ({
  notifyMultiple: jest.fn().mockResolvedValue(undefined),
}));

import { disburseOrder } from '../disbursement.service';
import prisma from '../../../utils/prisma';

const APP_ID = '00000000-0000-4000-8000-000000000001';
const ORDER_ID = '00000000-0000-4000-8000-000000000002';

beforeEach(() => {
  orderFindUniqueMock.mockReset().mockResolvedValue({
    id: ORDER_ID,
    applicationId: APP_ID,
    status: DisbursementStatus.APPROVED,
    approvedById: 'approver-user',
    requestedById: 'requestor-user',
    orderNo: 'DO-001',
    totalAmount: BigInt(100),
    approvedBy: { id: 'approver-user', firstName: 'A', lastName: 'B' },
  });
  conditionFindManyMock.mockReset().mockResolvedValue([]);
  staleCheckMock.mockReset();
  ((prisma as any).creditApplication.update as jest.Mock).mockClear();
});

describe('disburseOrder — stale collateral gate (GAP-P1-12)', () => {
  it('blocks disbursement when a collateral valuation is stale', async () => {
    staleCheckMock.mockResolvedValue({
      blocked: true,
      staleCollaterals: [{ id: 'col-1', type: 'PROPERTY', valuationDate: new Date('2025-06-01'), ageMonths: 14 }],
    });

    await expect(disburseOrder(ORDER_ID, 'disburser-user')).rejects.toThrow(/stale collateral valuation/i);
    expect((prisma as any).creditApplication.update).not.toHaveBeenCalled();
  });

  it('names the stale collateral and its age in the error', async () => {
    staleCheckMock.mockResolvedValue({
      blocked: true,
      staleCollaterals: [{ id: 'col-1', type: 'PROPERTY', valuationDate: new Date('2025-06-01'), ageMonths: 14 }],
    });

    await expect(disburseOrder(ORDER_ID, 'disburser-user')).rejects.toThrow(/PROPERTY/);
    await expect(disburseOrder(ORDER_ID, 'disburser-user')).rejects.toThrow(/14/);
  });

  it('allows disbursement when no valuation is stale', async () => {
    staleCheckMock.mockResolvedValue({ blocked: false, staleCollaterals: [] });
    await disburseOrder(ORDER_ID, 'disburser-user');
    expect((prisma as any).creditApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { state: 'DISBURSED' } }),
    );
  });

  it("checks collateral freshness for the order's application", async () => {
    staleCheckMock.mockResolvedValue({ blocked: false, staleCollaterals: [] });
    await disburseOrder(ORDER_ID, 'disburser-user');
    expect(staleCheckMock).toHaveBeenCalledWith(APP_ID);
  });
});
