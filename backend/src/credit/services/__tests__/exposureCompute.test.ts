import { computeBorrowerExposure, refreshBorrowerExposure, EXPOSURE_STATES } from '../exposureCompute.service';

// ---------------------------------------------------------------------------
// Mock prisma — matches project convention (see harness.smoke.test.ts + setup.ts)
// ---------------------------------------------------------------------------
jest.mock('../../../utils/prisma', () => {
  return {
    __esModule: true,
    default: {
      creditApplication: {
        findMany: jest.fn(),
      },
      borrowerProfile: {
        update: jest.fn(),
      },
      $disconnect: jest.fn(),
    },
  };
});

const mockFindMany = jest.requireMock('../../../utils/prisma').default.creditApplication.findMany as jest.Mock;
const mockUpdate = jest.requireMock('../../../utils/prisma').default.borrowerProfile.update as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BORROWER_ID = 'bp-1';

function makeApp(state: string, facilities: Array<{ id: string; facilityType: string; amount: number; approvedAmount: number | null }>) {
  return {
    id: `app-${state}`,
    borrowerProfileId: BORROWER_ID,
    state,
    deletedAt: null,
    facilities,
  };
}

function makeFac(id: string, amount: number, approvedAmount: number | null = null) {
  return { id, facilityType: 'TERM_LOAN', amount, approvedAmount };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('exposureCompute.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── computeBorrowerExposure ──────────────────────────────────────────

  describe('computeBorrowerExposure', () => {
    it('sums approvedAmount ?? amount across facilities of APPROVED/OFFER/ACCEPTED/DISBURSED/ACTIVE apps', async () => {
      mockFindMany.mockResolvedValue([
        makeApp('APPROVED', [makeFac('f1', 100_000, 90_000)]),   // approvedAmount wins
        makeApp('OFFER',    [makeFac('f2', 50_000, null)]),       // fallback to amount
        makeApp('ACCEPTED', [makeFac('f3', 200_000, 200_000)]),  // both equal
        makeApp('DISBURSED', [makeFac('f4', 80_000, 75_000)]),   // approvedAmount wins
        makeApp('ACTIVE',    [makeFac('f5', 300_000, null)]),     // fallback to amount
      ]);

      const result = await computeBorrowerExposure(BORROWER_ID);

      // 90k + 50k + 200k + 75k + 300k = 715k
      expect(result.totalExposure).toBe(715_000);
    });

    it('excludes facilities from non-qualifying states (DRAFT, REJECTED, CLOSED, WITHDRAWN)', async () => {
      mockFindMany.mockResolvedValue([]);

      // We pass only non-qualifying apps — prisma.findMany should return empty
      // because the WHERE clause filters by EXPOSURE_STATES.
      const result = await computeBorrowerExposure(BORROWER_ID);
      expect(result.totalExposure).toBe(0);

      // Verify the query used EXPOSURE_STATES
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            state: { in: EXPOSURE_STATES },
          }),
        }),
      );
    });

    it('returns 0 when borrower has no applications in exposure states', async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await computeBorrowerExposure(BORROWER_ID);
      expect(result.totalExposure).toBe(0);
    });
  });

  // ── refreshBorrowerExposure ───────────────────────────────────────────

  describe('refreshBorrowerExposure', () => {
    it('persists computed exposure to BorrowerProfile.totalExposure', async () => {
      mockFindMany.mockResolvedValue([
        makeApp('APPROVED', [makeFac('f1', 500_000, 450_000)]),
        makeApp('ACTIVE',   [makeFac('f2', 100_000, null)]),
      ]);
      mockUpdate.mockResolvedValue({ id: BORROWER_ID, totalExposure: 550_000 });

      const result = await refreshBorrowerExposure(BORROWER_ID);

      // 450k + 100k = 550k
      expect(result).toBe(550_000);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: BORROWER_ID },
        data: { totalExposure: 550_000 },
      });
    });

    it('returns 0 and persists 0 when no qualifying applications exist', async () => {
      mockFindMany.mockResolvedValue([]);
      mockUpdate.mockResolvedValue({ id: BORROWER_ID, totalExposure: 0 });

      const result = await refreshBorrowerExposure(BORROWER_ID);

      expect(result).toBe(0);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: BORROWER_ID },
        data: { totalExposure: 0 },
      });
    });
  });
});