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
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.crmOpportunity.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockPrisma.crmLead.findMany
      .mockResolvedValueOnce([
        {
          id: 'lead-1',
          title: 'Lost merchant lead',
          companyName: 'Acme Sdn Bhd',
          lostReason: 'Price',
          updatedAt: new Date('2026-08-13T10:00:00.000Z'),
          account: { name: 'Acme Account' },
          owner: { firstName: 'Cristel', lastName: 'Erguiza' },
        },
        {
          id: 'lead-2',
          title: 'Second lost lead',
          companyName: 'Beta Sdn Bhd',
          lostReason: null,
          updatedAt: new Date('2026-08-14T10:00:00.000Z'),
          account: null,
          owner: { firstName: 'Cristel', lastName: 'Erguiza' },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'lead-3',
          title: 'Converted merchant lead',
          companyName: 'Gamma Sdn Bhd',
          convertedAt: new Date('2026-08-15T10:00:00.000Z'),
          account: { name: 'Gamma Account' },
          owner: { firstName: 'Cristel', lastName: 'Erguiza' },
        },
      ]);
  });

  it('reports lost and converted leads separately from opportunities', async () => {
    const from = new Date('2026-08-01T00:00:00.000Z');
    const to = new Date('2026-08-24T23:59:59.999Z');

    const result = await getWinLossReport(from, to, 'owner-1', ['owner-1']);

    expect(result.totalWon).toEqual({ count: 0, value: 0 });
    expect(result.totalLost).toEqual({ count: 0, value: 0 });
    expect(result.totalConvertedLeads).toBe(1);
    expect(result.totalLostLeads).toBe(2);
    expect(result.lostLeads).toEqual([
      expect.objectContaining({ id: 'lead-1', companyName: 'Acme Sdn Bhd', accountName: 'Acme Account' }),
      expect.objectContaining({ id: 'lead-2', companyName: 'Beta Sdn Bhd', accountName: null }),
    ]);
    expect(result.convertedLeads).toEqual([
      expect.objectContaining({ id: 'lead-3', companyName: 'Gamma Sdn Bhd', accountName: 'Gamma Account' }),
    ]);

    expect(mockPrisma.crmLead.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: {
        ownerId: { in: ['owner-1'] },
        status: 'LOST',
        updatedAt: { gte: from, lte: to },
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      select: expect.any(Object),
    }));
    expect(mockPrisma.crmLead.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: {
        ownerId: { in: ['owner-1'] },
        status: 'CONVERTED',
        convertedAt: { not: null, gte: from, lte: to },
        deletedAt: null,
      },
      orderBy: { convertedAt: 'desc' },
      select: expect.any(Object),
    }));
  });
});
