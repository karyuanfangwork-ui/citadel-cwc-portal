const mockPrisma = {
  crmOpportunity: {
    findMany: jest.fn(),
  },
  crmLead: {
    findMany: jest.fn(),
  },
};

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

import { getWinLossReport } from '../services/crm-reports.service';

describe('CRM win/loss report', () => {
  const from = new Date('2026-08-01T00:00:00.000Z');
  const to = new Date('2026-08-24T23:59:59.999Z');

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.crmOpportunity.findMany
      .mockResolvedValueOnce([
        {
          id: 'won-1', name: 'Signed trust mandate', value: '120000', wonAt: new Date('2026-08-15T10:00:00.000Z'),
          account: { name: 'Acme Account' }, owner: { firstName: 'Cristel', lastName: 'Erguiza' },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'lost-opp-1', name: 'Estate planning proposal', value: '80000', lostReason: 'Price', lostAt: new Date('2026-08-14T10:00:00.000Z'),
          account: { name: 'Beta Account' }, owner: { firstName: 'Cristel', lastName: 'Erguiza' },
        },
      ]);
    mockPrisma.crmLead.findMany.mockResolvedValueOnce([
      {
        id: 'lost-lead-1', title: 'Lost merchant lead', companyName: 'Gamma Sdn Bhd', estimatedValue: '25000', lostReason: 'Timing',
        lostAt: new Date('2026-08-13T10:00:00.000Z'), account: { name: 'Gamma Account' },
        owner: { firstName: 'Cristel', lastName: 'Erguiza' },
      },
    ]);
  });

  it('counts only closed-won opportunities as wins and combines closed-lost opportunities with lost leads as losses', async () => {
    const result = await getWinLossReport(from, to, 'owner-1', ['owner-1']);

    expect(result.totalWon).toEqual({ count: 1, value: 120000 });
    expect(result.wonOpportunities).toEqual([
      expect.objectContaining({ id: 'won-1', name: 'Signed trust mandate', accountName: 'Acme Account' }),
    ]);
    expect(result.totalLost).toEqual({ count: 2, value: 80000 });
    expect(result.totalLostOpportunities).toEqual({ count: 1, value: 80000 });
    expect(result.totalLostLeads).toBe(1);
    expect(result.winRate).toBe(50);
    expect(result.totalLostLeadEstimatedValue).toBe(25000);
    expect(result.lostLeadEstimatedValueCount).toBe(1);
    expect(result.lostOpportunities).toEqual([
      expect.objectContaining({ id: 'lost-opp-1', accountName: 'Beta Account' }),
    ]);
    expect(result.lostLeads).toEqual([
      expect.objectContaining({ id: 'lost-lead-1', accountName: 'Gamma Account', estimatedValue: 25000 }),
    ]);
    expect(result.byReason).toEqual(expect.arrayContaining([
      expect.objectContaining({ lostReason: 'Price', count: 1, totalValue: 80000 }),
      expect.objectContaining({ lostReason: 'Timing', count: 1, totalValue: 0 }),
    ]));

    expect(mockPrisma.crmOpportunity.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: {
        ownerId: { in: ['owner-1'] },
        stage: { isWonStage: true },
        wonAt: { not: null, gte: from, lte: to },
        deletedAt: null,
      },
      orderBy: { wonAt: 'desc' },
    }));
    expect(mockPrisma.crmOpportunity.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: {
        ownerId: { in: ['owner-1'] },
        stage: { isLostStage: true },
        lostAt: { not: null, gte: from, lte: to },
        deletedAt: null,
      },
      orderBy: { lostAt: 'desc' },
    }));
    expect(mockPrisma.crmLead.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        ownerId: { in: ['owner-1'] },
        status: 'LOST',
        lostAt: { not: null, gte: from, lte: to },
        deletedAt: null,
      },
      orderBy: { lostAt: 'desc' },
    }));
  });
});
