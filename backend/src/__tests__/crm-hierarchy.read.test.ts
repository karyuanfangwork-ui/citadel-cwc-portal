import { getSalesHierarchy } from '../services/crm-hierarchy.service';

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    user: { findMany: jest.fn() },
    crmTerritoryMember: { findMany: jest.fn() },
    crmLead: { groupBy: jest.fn() },
    crmOpportunity: { groupBy: jest.fn() },
  },
}));

import prisma from '../utils/prisma';

const mockPrisma = prisma as unknown as {
  user: { findMany: jest.Mock };
  crmTerritoryMember: { findMany: jest.Mock };
  crmLead: { groupBy: jest.Mock };
  crmOpportunity: { groupBy: jest.Mock };
};

const user = (overrides: Record<string, unknown>) => ({
  id: 'user-1', tenantId: 'tenant-1', managerId: null, firstName: 'A', lastName: 'User', email: 'a@test.local',
  avatarUrl: null, jobTitle: null, department: 'Sales', isActive: true,
  roles: [{ role: { name: 'SALES_REP' } }], ...overrides,
});

describe('getSalesHierarchy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.crmTerritoryMember.findMany.mockResolvedValue([
      { userId: 'manager-1', territory: { id: 'territory-1', name: 'Central' } },
      { userId: 'rep-1', territory: { id: 'territory-1', name: 'Central' } },
    ]);
    mockPrisma.crmLead.groupBy.mockResolvedValue([{ ownerId: 'rep-1', _count: 3 }]);
    mockPrisma.crmOpportunity.groupBy.mockResolvedValue([{ ownerId: 'rep-1', _count: 2 }]);
  });

  it('groups direct and indirect reports, while preserving explicit exceptions and counts', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      user({ id: 'manager-1', firstName: 'Alice', lastName: 'Manager', roles: [{ role: { name: 'SALES_MANAGER' } }] }),
      user({ id: 'rep-1', firstName: 'Ben', lastName: 'Rep', managerId: 'manager-1', roles: [{ role: { name: 'SALES_REP' } }, { role: { name: 'SALES_MANAGER' } }] }),
      user({ id: 'rep-2', firstName: 'Cindy', lastName: 'Rep', managerId: 'rep-1' }),
      user({ id: 'rep-3', firstName: 'Daniel', lastName: 'Rep', managerId: null }),
      user({ id: 'rep-4', firstName: 'Eve', lastName: 'Rep', managerId: 'missing-manager' }),
    ]);

    const result = await getSalesHierarchy('tenant-1');

    expect(result.managers).toHaveLength(2);
    expect(result.managers[0].directReports.map((rep) => rep.id)).toEqual(['rep-1']);
    expect(result.managers[0].indirectReportCount).toBe(1);
    expect(result.unassignedReps.map((rep) => rep.id)).toEqual(['rep-3']);
    expect(result.invalidAssignments[0].reason).toBe('MISSING_MANAGER');
    expect(result.summary).toEqual(expect.objectContaining({ salesRepCount: 4, assignedRepCount: 2, unassignedRepCount: 1, invalidAssignmentCount: 1 }));
    expect(result.managers[0].directReports[0]).toEqual(expect.objectContaining({ leadCount: 3, opportunityCount: 2, territories: [{ id: 'territory-1', name: 'Central' }] }));
    expect(JSON.stringify(result)).not.toContain('tenantId');
  });

  it('returns an empty, stable response without querying aggregate tables for no users', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    const result = await getSalesHierarchy('tenant-1');
    expect(result).toEqual({ managers: [], unassignedReps: [], invalidAssignments: [], managerOptions: [], summary: { managerCount: 0, activeManagerCount: 0, inactiveManagerCount: 0, salesRepCount: 0, activeSalesRepCount: 0, inactiveSalesRepCount: 0, assignedRepCount: 0, unassignedRepCount: 0, invalidAssignmentCount: 0 } });
    expect(mockPrisma.crmLead.groupBy).not.toHaveBeenCalled();
    expect(mockPrisma.crmOpportunity.groupBy).not.toHaveBeenCalled();
  });
});
