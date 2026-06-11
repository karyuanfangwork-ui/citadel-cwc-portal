/**
 * Tests for Approval Turnaround Report data-integrity fixes (Task 18 — F17).
 *
 * 1. Turnaround must include rejected applications with decision type
 * 2. Turnaround detail rows must include a decision column
 * 3. Month groups must be sorted chronologically
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

import prisma from '../../../utils/prisma';
import { dashboardService } from '../dashboard.service';

const mockedFindMany = prisma.creditApplication.findMany as jest.Mock;

const makeApp = (overrides: Record<string, any> = {}) => ({
  id: overrides.id ?? 'app-1',
  applicationNo: overrides.applicationNo ?? 'CA-0001',
  productType: overrides.productType ?? 'TERM_LOAN',
  submittedAt: overrides.submittedAt ?? new Date('2026-01-15'),
  assignedRmId: overrides.assignedRmId ?? 'rm-1',
  borrowerProfile: overrides.borrowerProfile ?? {
    name: 'Test Borrower',
    account: { name: 'Test Borrower' },
    contact: { firstName: 'Test', lastName: 'Borrower' },
  },
  assignedRm: overrides.assignedRm ?? {
    id: 'rm-1',
    firstName: 'John',
    lastName: 'RM',
  },
  decisions: overrides.decisions ?? [
    { decisionType: 'APPROVE', decisionAt: new Date('2026-01-20') },
  ],
  ...overrides,
});

describe('Approval Turnaround — data integrity (F17)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('includes rejected applications with decision type', async () => {
    // Two apps: one approved, one rejected — both should appear
    const approvedApp = makeApp({
      id: 'app-approved',
      applicationNo: 'CA-0001',
      submittedAt: new Date('2026-01-10'),
      decisions: [
        { decisionType: 'APPROVE', decisionAt: new Date('2026-01-15') },
      ],
    });

    const rejectedApp = makeApp({
      id: 'app-rejected',
      applicationNo: 'CA-0002',
      submittedAt: new Date('2026-01-12'),
      decisions: [
        { decisionType: 'REJECT', decisionAt: new Date('2026-01-14') },
      ],
    });

    mockedFindMany.mockResolvedValueOnce([approvedApp, rejectedApp]);

    const result = await dashboardService.getApprovalTurnaround({ groupBy: 'month' });

    // Both apps should be in the result
    expect(result.applications).toHaveLength(2);

    // Check that we have one APPROVE and one REJECT
    const approved = result.applications.find(a => a.applicationId === 'app-approved');
    const rejected = result.applications.find(a => a.applicationId === 'app-rejected');

    expect(approved).toBeDefined();
    expect(rejected).toBeDefined();

    // The rejected app should have decision 'REJECT'
    expect(rejected!.decision).toBe('REJECT');
    expect(approved!.decision).toBe('APPROVE');
  });

  it('detail rows include a decision column', async () => {
    const app = makeApp({
      id: 'app-1',
      decisions: [
        { decisionType: 'APPROVE', decisionAt: new Date('2026-01-15') },
      ],
    });

    mockedFindMany.mockResolvedValueOnce([app]);

    const result = await dashboardService.getApprovalTurnaround({ groupBy: 'product' });

    expect(result.applications).toHaveLength(1);
    const row = result.applications[0];
    // The row must have a `decision` field
    expect(row).toHaveProperty('decision');
    expect(typeof row.decision).toBe('string');
    expect(row.decision).toBe('APPROVE');
  });

  it('month groups are sorted chronologically', async () => {
    // Create apps across different months — out of order
    const apps = [
      makeApp({
        id: 'app-mar',
        applicationNo: 'CA-0003',
        submittedAt: new Date('2026-03-10'),
        decisions: [{ decisionType: 'APPROVE', decisionAt: new Date('2026-03-15') }],
      }),
      makeApp({
        id: 'app-jan',
        applicationNo: 'CA-0001',
        submittedAt: new Date('2026-01-10'),
        decisions: [{ decisionType: 'APPROVE', decisionAt: new Date('2026-01-15') }],
      }),
      makeApp({
        id: 'app-feb',
        applicationNo: 'CA-0002',
        submittedAt: new Date('2026-02-10'),
        decisions: [{ decisionType: 'APPROVE', decisionAt: new Date('2026-02-15') }],
      }),
    ];

    mockedFindMany.mockResolvedValueOnce(apps);

    const result = await dashboardService.getApprovalTurnaround({ groupBy: 'month' });

    const groupKeys = result.summary.groups.map(g => g.key);
    // Must be chronologically sorted (YYYY-MM string comparison works)
    for (let i = 1; i < groupKeys.length; i++) {
      expect(groupKeys[i] >= groupKeys[i - 1]).toBe(true);
    }
  });

  it('uses the first final decision (APPROVE or REJECT) per app, ignoring earlier non-final decisions', async () => {
    // An app with a non-decisive entry followed by a REJECT
    const app = makeApp({
      id: 'app-multi',
      submittedAt: new Date('2026-01-10'),
      decisions: [
        // Some earlier non-final decision type (e.g. DEFER) should be ignored
        { decisionType: 'DEFER', decisionAt: new Date('2026-01-11') },
        { decisionType: 'REJECT', decisionAt: new Date('2026-01-14') },
      ],
    });

    mockedFindMany.mockResolvedValueOnce([app]);

    const result = await dashboardService.getApprovalTurnaround({ groupBy: 'month' });

    expect(result.applications).toHaveLength(1);
    expect(result.applications[0].decision).toBe('REJECT');
    // Turnaround should use the REJECT decision date, not the DEFER date
    expect(result.applications[0].firstApprovalAt.slice(0, 10)).toBe('2026-01-14');
  });

  it('summary metric overall.label is Decisions', async () => {
    const app = makeApp({
      submittedAt: new Date('2026-01-10'),
      decisions: [{ decisionType: 'APPROVE', decisionAt: new Date('2026-01-15') }],
    });

    mockedFindMany.mockResolvedValueOnce([app]);

    const result = await dashboardService.getApprovalTurnaround({ groupBy: 'month' });

    expect(result.summary.overall.label).toBe('Decisions');
  });
});