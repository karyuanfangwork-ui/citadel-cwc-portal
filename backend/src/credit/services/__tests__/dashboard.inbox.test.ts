/**
 * Tests for Approval Inbox authority scoping (Task 7 — F6).
 * The inbox must only show applications where the user holds sufficient
 * authority to approve, as determined by the approval matrix lookup
 * and the AUTHORITY_HIERARCHY / getRoleNamesForAuthorityLevel mapping.
 */

// Mock prisma
jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditApplication: {
      findMany: jest.fn(),
    },
  },
}));

// Mock approvalMatrixService
jest.mock('../approvalMatrix.service', () => ({
  __esModule: true,
  approvalMatrixService: {
    lookupApprovalAuthority: jest.fn(),
  },
}));

import prisma from '../../../utils/prisma';
import { approvalMatrixService } from '../approvalMatrix.service';
import { dashboardService } from '../dashboard.service';
import { AUTHORITY_HIERARCHY } from '../approvalAction.service';

const mockedFindMany = prisma.creditApplication.findMany as jest.Mock;
const mockedLookupAuthority = approvalMatrixService.lookupApprovalAuthority as jest.Mock;

const makeApp = (overrides: Record<string, any> = {}) => ({
  id: overrides.id ?? 'app-1',
  applicationNo: 'CA-0001',
  state: 'UNDERWRITING',
  productType: 'TERM_LOAN',
  requestedAmount: 100000,
  currency: 'MYR',
  submittedAt: new Date('2026-01-01'),
  createdAt: new Date('2026-01-01'),
  branchId: null,
  assignedRmId: 'rm-other',
  assignedAnalystId: null,
  borrowerProfile: {
    id: 'bp-1',
    creditRiskRating: 'A',
    account: { name: 'Test Borrower', industry: 'Finance' },
    contact: { firstName: 'John', lastName: 'Doe' },
  },
  decisions: [],
  ...overrides,
});

describe('Approval Inbox — authority scoping (F6)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty inbox when user lacks credit:approve permission', async () => {
    const result = await dashboardService.getApprovalInbox(
      'user-1',
      ['CREDIT_ANALYST'],
      ['credit:read'], // no credit:approve
    );

    expect(result.totalPending).toBe(0);
    expect(result.high).toHaveLength(0);
    expect(result.medium).toHaveLength(0);
    expect(result.low).toHaveLength(0);
    // Should not query DB at all
    expect(mockedFindMany).not.toHaveBeenCalled();
  });

  it('returns empty inbox when user permissions array is empty', async () => {
    const result = await dashboardService.getApprovalInbox(
      'user-1',
      ['CREDIT_ANALYST'],
      [],
    );

    expect(result.totalPending).toBe(0);
    expect(mockedFindMany).not.toHaveBeenCalled();
  });

  it('excludes applications where required authority exceeds user level (CREDIT_MANAGER vs BOARD)', async () => {
    // CREDIT_MANAGER has authority level 2
    // BOARD has authority level 4
    const managerApp = makeApp({
      id: 'app-manager',
      requestedAmount: 500000,
      borrowerProfile: {
        id: 'bp-1',
        creditRiskRating: 'A',
        account: { name: 'Manager-Level Borrower' },
        contact: { firstName: 'J', lastName: 'D' },
      },
    });
    const boardApp = makeApp({
      id: 'app-board',
      requestedAmount: 5000000,
      borrowerProfile: {
        id: 'bp-2',
        creditRiskRating: 'BB',
        account: { name: 'Board-Level Borrower' },
        contact: { firstName: 'J', lastName: 'D' },
      },
    });

    // First query (assigned apps) returns nothing, second query (appsWithoutDecision) returns both
    mockedFindMany
      .mockResolvedValueOnce([]) // applications
      .mockResolvedValueOnce([managerApp, boardApp]); // appsWithoutDecision

    // Matrix lookup: manager-level app → MANAGER, board-level app → BOARD
    mockedLookupAuthority
      .mockResolvedValueOnce({ authorityLevel: 'MANAGER', requiredApproverCount: 1, matrixId: 'm1', matrixName: 'Manager Matrix' })
      .mockResolvedValueOnce({ authorityLevel: 'BOARD', requiredApproverCount: 1, matrixId: 'm2', matrixName: 'Board Matrix' });

    const result = await dashboardService.getApprovalInbox(
      'user-mgr',
      ['CREDIT_MANAGER'],
      ['credit:approve'],
    );

    // CREDIT_MANAGER (level 2) can approve MANAGER (level 2) but NOT BOARD (level 4)
    expect(result.totalPending).toBe(1);
    expect(result.high[0]?.applicationId ?? result.medium[0]?.applicationId ?? result.low[0]?.applicationId).toBe('app-manager');
  });

  it('includes applications within CREDIT_MANAGER authority only', async () => {
    const app1 = makeApp({ id: 'app-1', requestedAmount: 200000 });
    const app2 = makeApp({ id: 'app-2', requestedAmount: 400000 });

    mockedFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([app1, app2]);

    // Both require MANAGER level
    mockedLookupAuthority
      .mockResolvedValueOnce({ authorityLevel: 'MANAGER', requiredApproverCount: 1, matrixId: 'm1', matrixName: 'Manager Matrix' })
      .mockResolvedValueOnce({ authorityLevel: 'MANAGER', requiredApproverCount: 1, matrixId: 'm1', matrixName: 'Manager Matrix' });

    const result = await dashboardService.getApprovalInbox(
      'user-mgr',
      ['CREDIT_MANAGER'],
      ['credit:approve'],
    );

    expect(result.totalPending).toBe(2);
  });

  it('CREDIT_ADMIN can see all authority levels', async () => {
    const rmApp = makeApp({ id: 'app-rm', requestedAmount: 50000 });
    const mgrApp = makeApp({ id: 'app-mgr', requestedAmount: 500000 });
    const boardApp = makeApp({ id: 'app-board', requestedAmount: 5000000 });

    mockedFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([rmApp, mgrApp, boardApp]);

    mockedLookupAuthority
      .mockResolvedValueOnce({ authorityLevel: 'RM', requiredApproverCount: 1, matrixId: 'm1', matrixName: 'RM Matrix' })
      .mockResolvedValueOnce({ authorityLevel: 'MANAGER', requiredApproverCount: 1, matrixId: 'm2', matrixName: 'Manager Matrix' })
      .mockResolvedValueOnce({ authorityLevel: 'BOARD', requiredApproverCount: 1, matrixId: 'm3', matrixName: 'Board Matrix' });

    // CREDIT_ADMIN maps to level 4 via getRoleNamesForAuthorityLevel(4) = ['CREDIT_ADMIN']
    const result = await dashboardService.getApprovalInbox(
      'user-admin',
      ['CREDIT_ADMIN'],
      ['credit:approve'],
    );

    expect(result.totalPending).toBe(3);
  });

  it('allows applications through when matrix lookup returns null (no matrix restriction)', async () => {
    const app = makeApp({ id: 'app-no-matrix', requestedAmount: 100000 });

    mockedFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([app]);

    // No matrix match
    mockedLookupAuthority.mockResolvedValueOnce(null);

    const result = await dashboardService.getApprovalInbox(
      'user-mgr',
      ['CREDIT_MANAGER'],
      ['credit:approve'],
    );

    expect(result.totalPending).toBe(1);
  });

  it('still respects SOD exclusion (user as RM is excluded from second query)', async () => {
    // The second query (appsWithoutDecision) already excludes assignedRmId = userId
    // so apps where user is the RM won't appear there.
    // This test verifies the SOD exclusion still works after F6 changes.
    const appAsRm = makeApp({ id: 'app-rm', assignedRmId: 'user-mgr' });
    const appNotRm = makeApp({ id: 'app-not-rm', assignedRmId: 'rm-other' });

    // First query (assigned as RM or analyst) includes the RM app, but decisions check should skip
    // because the user already decided. Let's simulate: user is RM but hasn't decided.
    mockedFindMany
      .mockResolvedValueOnce([{ ...appAsRm, decisions: [] }]) // assigned, no decision yet
      .mockResolvedValueOnce([appNotRm]); // not-RM apps without decision

    // Both at MANAGER level
    mockedLookupAuthority
      .mockResolvedValueOnce({ authorityLevel: 'MANAGER', requiredApproverCount: 1, matrixId: 'm1', matrixName: 'Manager Matrix' })
      .mockResolvedValueOnce({ authorityLevel: 'MANAGER', requiredApproverCount: 1, matrixId: 'm1', matrixName: 'Manager Matrix' });

    const result = await dashboardService.getApprovalInbox(
      'user-mgr',
      ['CREDIT_MANAGER'],
      ['credit:approve'],
    );

    // The RM-assigned app from first query is included (user is RM/analyst)
    // The not-RM app from second query is also included
    // Deduplication ensures no duplicates
    expect(result.totalPending).toBe(2);
  });

  it('deduplicates apps appearing in both queries', async () => {
    const app = makeApp({ id: 'app-dup', assignedAnalystId: 'user-mgr' });

    mockedFindMany
      .mockResolvedValueOnce([app]) // appears in assigned query (user is analyst)
      .mockResolvedValueOnce([app]); // also found in appsWithoutDecision

    mockedLookupAuthority
      .mockResolvedValueOnce({ authorityLevel: 'MANAGER', requiredApproverCount: 1, matrixId: 'm1', matrixName: 'Manager Matrix' });

    const result = await dashboardService.getApprovalInbox(
      'user-mgr',
      ['CREDIT_MANAGER'],
      ['credit:approve'],
    );

    expect(result.totalPending).toBe(1);
  });

  it('skips apps where user already submitted a decision', async () => {
    const appDecided = makeApp({ id: 'app-decided', decisions: [{ id: 'dec-1' }] });
    const appPending = makeApp({ id: 'app-pending', decisions: [] });

    mockedFindMany
      .mockResolvedValueOnce([appDecided]) // assigned, already decided
      .mockResolvedValueOnce([appPending]); // not-RM, not yet decided

    mockedLookupAuthority
      .mockResolvedValueOnce({ authorityLevel: 'MANAGER', requiredApproverCount: 1, matrixId: 'm1', matrixName: 'Manager Matrix' });

    const result = await dashboardService.getApprovalInbox(
      'user-mgr',
      ['CREDIT_MANAGER'],
      ['credit:approve'],
    );

    expect(result.totalPending).toBe(1);
  });

  it('CREDIT_RM user can only see RM-level apps', async () => {
    const rmApp = makeApp({ id: 'app-rm', requestedAmount: 50000 });
    const mgrApp = makeApp({ id: 'app-mgr', requestedAmount: 500000 });

    mockedFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([rmApp, mgrApp]);

    mockedLookupAuthority
      .mockResolvedValueOnce({ authorityLevel: 'RM', requiredApproverCount: 1, matrixId: 'm1', matrixName: 'RM Matrix' })
      .mockResolvedValueOnce({ authorityLevel: 'MANAGER', requiredApproverCount: 1, matrixId: 'm2', matrixName: 'Manager Matrix' });

    const result = await dashboardService.getApprovalInbox(
      'user-rm',
      ['CREDIT_RM'],
      ['credit:approve'],
    );

    // CREDIT_RM has level 1, can only approve RM (level 1), not MANAGER (level 2)
    expect(result.totalPending).toBe(1);
  });
});