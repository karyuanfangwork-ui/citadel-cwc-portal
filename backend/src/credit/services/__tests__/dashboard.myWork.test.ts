/**
 * Tests for My Work dashboard KPI counts (Task 6 — F5).
 * The lists use `take: 10` so counts must come from a separate `count()` query,
 * not from `.length` which caps at 10.
 */

// Mock prisma
jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditApplication: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    creditSlaBreach: {
      findMany: jest.fn(),
    },
    creditSlaPolicy: {
      findMany: jest.fn(),
    },
    creditSlaPolicyBranchOverride: {
      findMany: jest.fn(),
    },
  },
}));

import prisma from '../../../utils/prisma';
import { dashboardService } from '../dashboard.service';

const mockedFindMany = prisma.creditApplication.findMany as jest.Mock;
const mockedCount = prisma.creditApplication.count as jest.Mock;
const mockedBreachFindMany = prisma.creditSlaBreach.findMany as jest.Mock;
const mockedPolicyFindMany = prisma.creditSlaPolicy.findMany as jest.Mock;
const mockedOverrideFindMany = prisma.creditSlaPolicyBranchOverride.findMany as jest.Mock;

const makeApp = (idx: number) => ({
  id: `app-${idx}`,
  applicationNo: `CA-${String(idx).padStart(4, '0')}`,
  state: 'UNDERWRITING',
  productType: 'TERM_LOAN',
  updatedAt: new Date(),
  borrowerProfile: {
    id: `bp-${idx}`,
    name: `Borrower ${idx}`,
    account: { name: `Account ${idx}` },
    contact: { firstName: 'First', lastName: 'Last' },
  },
});

describe('My Work Dashboard KPI counts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no SLA breaches
    mockedBreachFindMany.mockResolvedValue([]);
    mockedPolicyFindMany.mockResolvedValue([]);
    mockedOverrideFindMany.mockResolvedValue([]);
  });

  it('returns true counts even when list is capped at 10', async () => {
    // Simulate 25 pending approvals and 30 assigned cases
    const approvalCount = 25;
    const assignedCount = 30;

    // findMany returns at most 10 items (capped by `take: 10`)
    const approvalList = Array.from({ length: 10 }, (_, i) => makeApp(i));
    const assignedList = Array.from({ length: 10 }, (_, i) => makeApp(i + 10));

    // findMany is called twice: once for approvals, once for assigned
    mockedFindMany
      .mockResolvedValueOnce(approvalList)   // myApprovals
      .mockResolvedValueOnce(assignedList);   // myAssigned

    // count() returns the real totals
    mockedCount
      .mockResolvedValueOnce(approvalCount)   // myApprovalCount
      .mockResolvedValueOnce(assignedCount);  // myAssignedCount

    const result = await dashboardService.getMyWorkDashboard('user-1');

    // KPI counts must reflect the true totals, not the capped list length
    expect(result.myApprovalCount).toBe(25);
    expect(result.myAssignedCount).toBe(30);

    // The list items are capped at 10
    expect(result.recentApprovals).toHaveLength(10);
    expect(result.recentAssigned).toHaveLength(10);

    // count() was called for both queries
    expect(mockedCount).toHaveBeenCalledTimes(2);
  });

  it('returns correct counts when totals are under 10', async () => {
    const approvalList = Array.from({ length: 3 }, (_, i) => makeApp(i));
    const assignedList = Array.from({ length: 5 }, (_, i) => makeApp(i + 10));

    mockedFindMany
      .mockResolvedValueOnce(approvalList)
      .mockResolvedValueOnce(assignedList);

    mockedCount
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(5);

    const result = await dashboardService.getMyWorkDashboard('user-1');

    expect(result.myApprovalCount).toBe(3);
    expect(result.myAssignedCount).toBe(5);
    expect(result.recentApprovals).toHaveLength(3);
    expect(result.recentAssigned).toHaveLength(5);
  });

  it('returns zero counts when there are no matching applications', async () => {
    mockedFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    mockedCount
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const result = await dashboardService.getMyWorkDashboard('user-1');

    expect(result.myApprovalCount).toBe(0);
    expect(result.myAssignedCount).toBe(0);
    expect(result.recentApprovals).toHaveLength(0);
    expect(result.recentAssigned).toHaveLength(0);
  });
});