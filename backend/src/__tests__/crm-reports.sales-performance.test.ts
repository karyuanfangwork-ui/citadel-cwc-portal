const mockPrisma = {
  crmOpportunity: {
    findMany: jest.fn(),
  },
};

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

import { getSalesPerformanceReport } from '../services/crm-reports.service';

describe('CRM sales performance report', () => {
  const from = new Date('2026-09-01T00:00:00.000Z');
  const to = new Date('2026-09-30T23:59:59.999Z');
  const ownerA = { id: 'owner-a', firstName: 'Asha', lastName: 'Tan' };
  const ownerB = { id: 'owner-b', firstName: 'Ben', lastName: 'Lim' };
  const opportunity = (id: string, value: string, owner = ownerA) => ({ id, value, ownerId: owner.id, owner });

  beforeEach(() => jest.clearAllMocks());

  it('uses separate creation, won-event, and lost-event populations and merges them by owner', async () => {
    // Created: open in-period, won in-period, and converted-lead opportunity.
    mockPrisma.crmOpportunity.findMany
      .mockResolvedValueOnce([
        opportunity('open-created', '100'),
        opportunity('created-and-won', '200'),
        opportunity('converted-lead-opportunity', '300', ownerB),
      ])
      // Won: pre-period creation won in-period plus created-and-won.
      .mockResolvedValueOnce([
        opportunity('pre-period-won', '400'),
        opportunity('created-and-won', '200'),
      ])
      // Lost: pre-period creation lost in-period.
      .mockResolvedValueOnce([opportunity('pre-period-lost', '500', ownerB)]);

    const report = await getSalesPerformanceReport(from, to, 'pipeline-1', ['owner-a', 'owner-b']);

    expect(report.byOwner).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ownerId: 'owner-a', totalDeals: 2, wonDeals: 2, lostDeals: 0,
        totalWonValue: 600, totalLostValue: 0, winRate: 100, avgDealSize: 300,
      }),
      expect.objectContaining({
        ownerId: 'owner-b', totalDeals: 1, wonDeals: 0, lostDeals: 1,
        totalWonValue: 0, totalLostValue: 500, winRate: 0, avgDealSize: 0,
      }),
    ]));
    expect(report.totalRevenue).toBe(600);
    expect(report.overallWinRate).toBe(67);

    expect(mockPrisma.crmOpportunity.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { deletedAt: null, ownerId: { in: ['owner-a', 'owner-b'] }, pipelineId: 'pipeline-1', createdAt: { gte: from, lte: to } },
    }));
    expect(mockPrisma.crmOpportunity.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { deletedAt: null, ownerId: { in: ['owner-a', 'owner-b'] }, pipelineId: 'pipeline-1', stage: { isWonStage: true }, wonAt: { not: null, gte: from, lte: to } },
    }));
    expect(mockPrisma.crmOpportunity.findMany).toHaveBeenNthCalledWith(3, expect.objectContaining({
      where: { deletedAt: null, ownerId: { in: ['owner-a', 'owner-b'] }, pipelineId: 'pipeline-1', stage: { isLostStage: true }, lostAt: { not: null, gte: from, lte: to } },
    }));
  });

  it('excludes outcome records that lack the matching lifecycle event or current terminal stage', async () => {
    mockPrisma.crmOpportunity.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await getSalesPerformanceReport(from, to);

    const wonWhere = mockPrisma.crmOpportunity.findMany.mock.calls[1][0].where;
    const lostWhere = mockPrisma.crmOpportunity.findMany.mock.calls[2][0].where;
    // These predicates exclude stage=won/lost with no event, an event whose
    // current stage no longer matches, and records with both events unless the
    // current terminal stage and the corresponding event establish one outcome.
    expect(wonWhere).toMatchObject({ stage: { isWonStage: true }, wonAt: { not: null, gte: from, lte: to }, deletedAt: null });
    expect(lostWhere).toMatchObject({ stage: { isLostStage: true }, lostAt: { not: null, gte: from, lte: to }, deletedAt: null });
  });
});
