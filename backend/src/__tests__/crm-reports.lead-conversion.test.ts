const mockPrisma = {
  crmLead: {
    groupBy: jest.fn(),
  },
};

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

import { getLeadConversionReport } from '../services/crm-reports.service';

describe('CRM lead conversion report', () => {
  const from = new Date('2026-09-15T00:00:00.000Z');
  const to = new Date('2026-09-17T23:59:59.999Z');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports only non-deleted conversion and loss events in the selected period with unchanged owner scope', async () => {
    // The conversion rows represent: pre-period creation converted in-period,
    // in-period creation converted in-period, and an owned conversion. They
    // exclude an in-period-created lead converted after the period, an
    // unconverted lead, and a soft-deleted lead.
    mockPrisma.crmLead.groupBy
      .mockResolvedValueOnce([{ source: 'REFERRAL', _count: 2 }])
      .mockResolvedValueOnce([{ source: 'WEBSITE', _count: 1 }]);

    const report = await getLeadConversionReport(from, to, 'owner-1', ['owner-1', 'owner-2']);

    expect(report.bySource).toEqual(expect.arrayContaining([
      { source: 'REFERRAL', total: 2, converted: 2, lost: 0, conversionRate: 100 },
      { source: 'WEBSITE', total: 1, converted: 0, lost: 1, conversionRate: 0 },
    ]));
    expect(report.byStatus).toEqual([
      { status: 'CONVERTED', count: 2 },
      { status: 'LOST', count: 1 },
    ]);
    expect(report.overallConversionRate).toBe(67);

    expect(mockPrisma.crmLead.groupBy).toHaveBeenNthCalledWith(1, {
      by: ['source'],
      _count: true,
      where: {
        ownerId: { in: ['owner-1'] },
        status: 'CONVERTED',
        convertedAt: { not: null, gte: from, lte: to },
        deletedAt: null,
      },
    });
    expect(mockPrisma.crmLead.groupBy).toHaveBeenNthCalledWith(2, {
      by: ['source'],
      _count: true,
      where: {
        ownerId: { in: ['owner-1'] },
        status: 'LOST',
        lostAt: { not: null, gte: from, lte: to },
        deletedAt: null,
      },
    });
  });

  it('does not filter conversion events by lead creation date or treat them as opportunity wins', async () => {
    mockPrisma.crmLead.groupBy
      .mockResolvedValueOnce([{ source: 'PARTNER', _count: 1 }])
      .mockResolvedValueOnce([]);

    const report = await getLeadConversionReport(from, to, undefined, null);

    expect(report.bySource).toEqual([
      { source: 'PARTNER', total: 1, converted: 1, lost: 0, conversionRate: 100 },
    ]);
    const conversionWhere = mockPrisma.crmLead.groupBy.mock.calls[0][0].where;
    expect(conversionWhere).not.toHaveProperty('createdAt');
    expect(conversionWhere).not.toHaveProperty('wonAt');
    expect(conversionWhere).toMatchObject({ status: 'CONVERTED', convertedAt: { gte: from, lte: to } });
  });
});
