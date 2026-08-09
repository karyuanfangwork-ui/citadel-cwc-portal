import { createOrder } from '../disbursement.service';
import { ApplicationState } from '@prisma/client';
import prisma from '../../../utils/prisma';

// ── Mocks ─────────────────────────────────────────────────────────────────
jest.mock('../../../utils/prisma', () => {
  const mockPrisma: any = {
    creditApplication: {
      findUnique: jest.fn(),
    },
    condition: {
      count: jest.fn(),
    },
    creditDecision: {
      findFirst: jest.fn(),
    },
    creditDocument: {
      findFirst: jest.fn(),
    },
    applicationFacility: {
      findMany: jest.fn(),
    },
    disbursementOrder: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    $disconnect: jest.fn(),
  };
  mockPrisma.$transaction = jest.fn(async (fn: any) => fn(mockPrisma));
  return { __esModule: true, default: mockPrisma };
});

jest.mock('../../../credit/services/auditChain.service', () => ({
  AuditChainService: {
    appendEvent: jest.fn(),
    assertChainIntact: jest.fn(),
  },
}));

jest.mock('../../../services/notification.service', () => ({
  notifyMultiple: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: { warn: jest.fn(), debug: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

const APP_ID = 'app-001';
const USER_ID = 'user-001';

/** Set up all readiness checks to pass so we can test amount validation in isolation */
function setupReadinessPasses() {
  // 1. Application in ACCEPTED state
  (prisma.creditApplication.findUnique as jest.Mock).mockImplementation((args: any) => {
    if (args?.where?.id === APP_ID) {
      return Promise.resolve({ id: APP_ID, state: ApplicationState.ACCEPTED });
    }
    return Promise.resolve(null);
  });
  // 2. No open conditions
  (prisma.condition.count as jest.Mock).mockResolvedValue(0);
  // 3. Approval decision exists
  (prisma.creditDecision.findFirst as jest.Mock).mockResolvedValue({ id: 'dec-001', decisionType: 'APPROVE' });
  // 4. Verified letter of offer
  (prisma.creditDocument.findFirst as jest.Mock).mockResolvedValue({ id: 'doc-001', verificationStatus: 'VERIFIED' });
}

describe('createOrder — disbursement amount vs approved facility total (F22)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupReadinessPasses();
  });

  // ── Reject when totalAmount exceeds sum of approved facility amounts ──
  it('rejects totalAmount exceeding sum of approved facility amounts', async () => {
    // Facilities: approved total = 500_000
    (prisma.applicationFacility.findMany as jest.Mock).mockResolvedValue([
      { id: 'fac-1', approvedAmount: 300000, amount: 200000 },
      { id: 'fac-2', approvedAmount: null, amount: 200000 },
    ]);

    // No existing disbursement order
    (prisma.disbursementOrder.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      createOrder(APP_ID, USER_ID, { totalAmount: 600000, currency: 'MYR' }),
    ).rejects.toThrow('exceeds the total approved facility amount');

    expect(prisma.disbursementOrder.create).not.toHaveBeenCalled();
  });

  // ── Accept when totalAmount equals approved total ──────────────────────
  it('accepts totalAmount equal to approved total', async () => {
    // Facilities: approved total = 500_000
    (prisma.applicationFacility.findMany as jest.Mock).mockResolvedValue([
      { id: 'fac-1', approvedAmount: 300000, amount: 200000 },
      { id: 'fac-2', approvedAmount: null, amount: 200000 },
    ]);

    // No existing disbursement order
    (prisma.disbursementOrder.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.disbursementOrder.create as jest.Mock).mockResolvedValue({
      id: 'order-001',
      orderNo: 'DO-2026-00001',
      totalAmount: 500000,
      currency: 'MYR',
      requestedById: USER_ID,
    });

    const result = await createOrder(APP_ID, USER_ID, { totalAmount: 500000, currency: 'MYR' });
    expect(result).toBeDefined();
    expect(prisma.disbursementOrder.create).toHaveBeenCalled();
  });

  // ── Accept when totalAmount is below approved total ──────────────────────
  it('accepts totalAmount below approved total', async () => {
    (prisma.applicationFacility.findMany as jest.Mock).mockResolvedValue([
      { id: 'fac-1', approvedAmount: 300000, amount: 200000 },
      { id: 'fac-2', approvedAmount: null, amount: 200000 },
    ]);

    (prisma.disbursementOrder.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.disbursementOrder.create as jest.Mock).mockResolvedValue({
      id: 'order-002',
      orderNo: 'DO-2026-00002',
      totalAmount: 400000,
      currency: 'MYR',
      requestedById: USER_ID,
    });

    const result = await createOrder(APP_ID, USER_ID, { totalAmount: 400000, currency: 'MYR' });
    expect(result).toBeDefined();
    expect(prisma.disbursementOrder.create).toHaveBeenCalled();
  });

  // ── Edge case: all facilities use amount (no approvedAmount set) ─────────
  it('falls back to amount when approvedAmount is null on all facilities', async () => {
    (prisma.applicationFacility.findMany as jest.Mock).mockResolvedValue([
      { id: 'fac-1', approvedAmount: null, amount: 250000 },
      { id: 'fac-2', approvedAmount: null, amount: 250000 },
    ]);

    (prisma.disbursementOrder.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.disbursementOrder.create as jest.Mock).mockResolvedValue({
      id: 'order-003',
      orderNo: 'DO-2026-00003',
      totalAmount: 500000,
      currency: 'MYR',
      requestedById: USER_ID,
    });

    const result = await createOrder(APP_ID, USER_ID, { totalAmount: 500000, currency: 'MYR' });
    expect(result).toBeDefined();
  });
});