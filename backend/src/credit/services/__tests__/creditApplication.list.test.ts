/**
 * Tests for server-side quick filters + sort on application listing (Task 9 — F8).
 * Covers: assignedToMe, states (multi-state), overdueSla, sortBy/sortDir.
 * Also verifies hasOpenSlaBreach in the list payload.
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
  },
}));

import prisma from '../../../utils/prisma';
import { creditApplicationService } from '../creditApplication.service';

const mockedFindMany = prisma.creditApplication.findMany as jest.Mock;
const mockedCount = prisma.creditApplication.count as jest.Mock;

const makeApp = (idx: number, overrides: Record<string, any> = {}) => ({
  id: `app-${idx}`,
  applicationNo: `CA-2026-${String(idx).padStart(5, '0')}`,
  state: 'UNDERWRITING',
  productType: 'TERM_LOAN',
  requestedAmount: 100000 + idx * 10000,
  createdAt: new Date('2026-01-01'),
  deletedAt: null,
  borrowerProfileId: 'bp-1',
  assignedRmId: 'rm-1',
  assignedAnalystId: 'analyst-1',
  ...overrides,
});

const makeBreachAppResult = (app: any, hasBreach: boolean) => ({
  ...app,
  borrowerProfile: { id: 'bp-1', name: 'Borrower', borrowerType: 'CORPORATE', account: { id: 'a-1', name: 'Acct' }, contact: { id: 'c-1', firstName: 'F', lastName: 'L' } },
  assignedRm: { id: 'rm-1', firstName: 'RM', lastName: 'User' },
  assignedAnalyst: { id: 'analyst-1', firstName: 'Analyst', lastName: 'User' },
  slaBreaches: hasBreach ? [{ id: 'breach-1' }] : [],
});

describe('listApplications — server-side quick filters + sort (F8)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: empty list, 0 total
    mockedFindMany.mockResolvedValue([]);
    mockedCount.mockResolvedValue(0);
  });

  it('filters assignedToMe=true to apps where user is RM or analyst', async () => {
    const app1 = makeBreachAppResult(makeApp(1, { assignedRmId: 'user-me' }), false);
    const app2 = makeBreachAppResult(makeApp(2, { assignedAnalystId: 'user-me' }), false);
    mockedFindMany.mockResolvedValue([app1, app2]);
    mockedCount.mockResolvedValue(2);

    const result = await creditApplicationService.listApplications({
      assignedToMe: 'user-me',
    });

    // Verify the where clause includes assignedToMe filter
    const whereArg = mockedFindMany.mock.calls[0][0].where;
    // AND should contain an OR filter for assignedRmId/assignedAnalystId
    const andClauses = Array.isArray(whereArg.AND) ? whereArg.AND : [whereArg.AND];
    const meFilter = andClauses.find((c: any) => c && c.OR);
    expect(meFilter).toBeDefined();
    expect(meFilter.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ assignedRmId: 'user-me' }),
        expect.objectContaining({ assignedAnalystId: 'user-me' }),
      ])
    );

    expect(result.applications).toHaveLength(2);
    expect(result.pagination.total).toBe(2);
  });

  it('filters states=[A,B] (multi-state)', async () => {
    const app1 = makeBreachAppResult(makeApp(1, { state: 'SUBMITTED' }), false);
    const app2 = makeBreachAppResult(makeApp(2, { state: 'KYC_REVIEW' }), false);
    mockedFindMany.mockResolvedValue([app1, app2]);
    mockedCount.mockResolvedValue(2);

    const result = await creditApplicationService.listApplications({
      states: ['SUBMITTED', 'KYC_REVIEW'],
    });

    const whereArg = mockedFindMany.mock.calls[0][0].where;
    expect(whereArg.state).toEqual({ in: ['SUBMITTED', 'KYC_REVIEW'] });

    expect(result.applications).toHaveLength(2);
  });

  it('filters overdueSla=true using CreditSlaBreach (unresolved breaches)', async () => {
    const app1 = makeBreachAppResult(makeApp(1), true);
    mockedFindMany.mockResolvedValue([app1]);
    mockedCount.mockResolvedValue(1);

    const result = await creditApplicationService.listApplications({
      overdueSla: true,
    });

    const whereArg = mockedFindMany.mock.calls[0][0].where;
    // AND should contain a slaBreaches filter
    const andClauses = Array.isArray(whereArg.AND) ? whereArg.AND : [whereArg.AND];
    const slaFilter = andClauses.find((c: any) => c && c.slaBreaches);
    expect(slaFilter).toBeDefined();
    expect(slaFilter.slaBreaches.some.resolvedAt).toBeNull();

    expect(result.applications).toHaveLength(1);
  });

  it('sorts by amount/createdAt/state across the full result set', async () => {
    // Test sort by amount ascending
    mockedFindMany.mockResolvedValue([]);
    mockedCount.mockResolvedValue(0);

    await creditApplicationService.listApplications({
      sortBy: 'amount',
      sortDir: 'asc',
    });

    let orderByArg = mockedFindMany.mock.calls[0][0].orderBy;
    expect(orderByArg).toEqual({ requestedAmount: 'asc' });

    // Test sort by state descending
    jest.clearAllMocks();
    mockedFindMany.mockResolvedValue([]);
    mockedCount.mockResolvedValue(0);

    await creditApplicationService.listApplications({
      sortBy: 'state',
      sortDir: 'desc',
    });

    orderByArg = mockedFindMany.mock.calls[0][0].orderBy;
    expect(orderByArg).toEqual({ state: 'desc' });

    // Test default sort (createdAt desc)
    jest.clearAllMocks();
    mockedFindMany.mockResolvedValue([]);
    mockedCount.mockResolvedValue(0);

    await creditApplicationService.listApplications({});

    orderByArg = mockedFindMany.mock.calls[0][0].orderBy;
    expect(orderByArg).toEqual({ createdAt: 'desc' });
  });

  it('ignores invalid sortBy values and defaults to createdAt', async () => {
    mockedFindMany.mockResolvedValue([]);
    mockedCount.mockResolvedValue(0);

    await creditApplicationService.listApplications({
      sortBy: 'invalid_column',
    });

    const orderByArg = mockedFindMany.mock.calls[0][0].orderBy;
    expect(orderByArg).toEqual({ createdAt: 'desc' });
  });

  it('adds hasOpenSlaBreach to each application in the list payload', async () => {
    const appWithBreach = makeBreachAppResult(makeApp(1), true);
    const appNoBreach = makeBreachAppResult(makeApp(2), false);
    // Remove the slaBreaches key from the raw result — the service should strip it
    // and add hasOpenSlaBreach instead
    mockedFindMany.mockResolvedValue([appWithBreach, appNoBreach]);
    mockedCount.mockResolvedValue(2);

    const result = await creditApplicationService.listApplications({});

    expect(result.applications[0].hasOpenSlaBreach).toBe(true);
    expect(result.applications[1].hasOpenSlaBreach).toBe(false);
    // slaBreaches should not be in the output
    expect((result.applications[0] as any).slaBreaches).toBeUndefined();
  });

  it('combines assignedToMe with overdueSla filter', async () => {
    const app1 = makeBreachAppResult(makeApp(1, { assignedRmId: 'user-me' }), true);
    mockedFindMany.mockResolvedValue([app1]);
    mockedCount.mockResolvedValue(1);

    await creditApplicationService.listApplications({
      assignedToMe: 'user-me',
      overdueSla: true,
    });

    const whereArg = mockedFindMany.mock.calls[0][0].where;
    const andClauses = Array.isArray(whereArg.AND) ? whereArg.AND : [whereArg.AND];
    // Should have both filters
    const meFilter = andClauses.find((c: any) => c && c.OR);
    const slaFilter = andClauses.find((c: any) => c && c.slaBreaches);
    expect(meFilter).toBeDefined();
    expect(slaFilter).toBeDefined();
  });

  it('states filter overrides single state filter when both are provided', async () => {
    mockedFindMany.mockResolvedValue([]);
    mockedCount.mockResolvedValue(0);

    const result = await creditApplicationService.listApplications({
      state: 'DRAFT',
      states: ['SUBMITTED', 'KYC_REVIEW'],
    });

    // states should take precedence
    const whereArg = mockedFindMany.mock.calls[0][0].where;
    expect(whereArg.state).toEqual({ in: ['SUBMITTED', 'KYC_REVIEW'] });
  });
});