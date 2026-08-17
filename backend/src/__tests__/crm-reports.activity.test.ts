const mockPrisma = {
  crmActivity: {
    groupBy: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
};

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

import { getActivitySummaryReport } from '../services/crm-reports.service';

describe('CRM activity summary report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.crmActivity.groupBy
      .mockResolvedValueOnce([
        { activityType: 'MEETING', _count: 1 },
        { activityType: 'EMAIL', _count: 1 },
      ])
      .mockResolvedValueOnce([
        { userId: 'user-1', activityType: 'MEETING', _count: 1 },
        { userId: 'user-1', activityType: 'EMAIL', _count: 1 },
      ]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'user-1', firstName: 'Test', lastName: 'Agent' },
    ]);
  });

  it('applies active linked-entity and owner visibility filters to both aggregations', async () => {
    const result = await getActivitySummaryReport(
      new Date('2026-08-01T00:00:00.000Z'),
      new Date('2026-08-17T23:59:59.999Z'),
      undefined,
      ['user-1'],
    );

    const byTypeWhere = mockPrisma.crmActivity.groupBy.mock.calls[0][0].where;
    const byUserWhere = mockPrisma.crmActivity.groupBy.mock.calls[1][0].where;

    expect(byTypeWhere).toEqual(byUserWhere);
    expect(byTypeWhere.AND).toEqual(expect.arrayContaining([
      expect.objectContaining({ OR: expect.arrayContaining([
        expect.objectContaining({ lead: { deletedAt: null } }),
      ]) }),
      expect.objectContaining({ OR: expect.arrayContaining([
        expect.objectContaining({ lead: { ownerId: { in: ['user-1'] }, deletedAt: null } }),
      ]) }),
    ]));
    expect(result.totalActivities).toBe(2);
    expect(result.byUser[0]).toMatchObject({ userId: 'user-1', count: 2 });
  });
});