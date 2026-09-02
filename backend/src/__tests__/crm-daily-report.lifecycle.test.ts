const mockPrisma = { crmActivity: { findMany: jest.fn() }, crmLead: { findMany: jest.fn() }, crmOpportunity: { findMany: jest.fn() } };
jest.mock('../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));
import { getDailyOperationalReport, companyKey, resolveCompanyAttribution } from '../services/crm-daily-report.service';

describe('daily operational lifecycle metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.crmActivity.findMany.mockResolvedValue([]);
    mockPrisma.crmOpportunity.findMany.mockResolvedValue([
      { wonAt: new Date('2026-09-01T02:00:00.000Z'), lostAt: null, account: { id: 'a1', name: 'Won Co' } },
      { wonAt: null, lostAt: new Date('2026-09-02T02:00:00.000Z'), account: { id: 'a2', name: 'Lost Co' } },
    ]);
    mockPrisma.crmLead.findMany.mockResolvedValue([
      { status: 'CONVERTED', convertedAt: new Date('2026-09-01T03:00:00.000Z'), lostAt: null, convertedToOppId: 'o1', companyName: 'Won Co', accountId: 'a1', account: { id: 'a1', name: 'Won Co' } },
      { status: 'LOST', convertedAt: null, lostAt: new Date('2026-09-02T04:00:00.000Z'), convertedToOppId: null, companyName: 'Never Converted', accountId: null, account: null },
    ]);
  });
  it('separates opportunity wins from lead conversions', async () => {
    const report = await getDailyOperationalReport('2026-09-01', '2026-09-02', { visibleOwnerIds: null });
    expect(report.daily[0]).toMatchObject({ merchantsSignedUp: 1, leadsConverted: 1 });
    expect(report.daily[1]).toMatchObject({ merchantsSignedUp: 0, merchantsDeclined: 2 });
  });
  it('does not double count converted then lost leads', async () => {
    mockPrisma.crmLead.findMany.mockResolvedValue([{ status: 'LOST', convertedAt: new Date('2026-09-01T03:00:00.000Z'), lostAt: new Date('2026-09-02T04:00:00.000Z'), convertedToOppId: 'o2', companyName: 'Lost Co', accountId: 'a2', account: { id: 'a2', name: 'Lost Co' } }]);
    const report = await getDailyOperationalReport('2026-09-01', '2026-09-02', { visibleOwnerIds: null });
    expect(report.totals.merchantsDeclined).toBe(1);
  });
  it('adds recorder filtering without changing owner visibility', async () => {
    await getDailyOperationalReport('2026-09-01', '2026-09-02', { visibleOwnerIds: null, recordedByUserId: 'user-7' });
    expect(mockPrisma.crmActivity.findMany.mock.calls[0][0].where.AND).toContainEqual({ userId: 'user-7' });
  });
  it('rejects inverted ranges', async () => {
    await expect(getDailyOperationalReport('2026-09-02', '2026-09-01', { visibleOwnerIds: null })).rejects.toThrow('from must not be after to');
  });
  it('uses a cursor when the activity result reaches the page size', async () => {
    const activity = { id: 'activity-0', activityType: 'CALL', callCategory: 'NEW_CALL', callOutcome: null, emailOutcome: null, meetingOutcome: null, engagementOutcome: null, createdAt: new Date('2026-09-01T02:00:00.000Z'), outcomeRecordedAt: null, accountId: null, contactId: null, leadId: null, opportunityId: null, account: null, contact: null, lead: null, opportunity: null };
    mockPrisma.crmActivity.findMany.mockReset();
    mockPrisma.crmActivity.findMany.mockResolvedValueOnce(Array.from({ length: 2000 }, (_, index) => ({ ...activity, id: `activity-${index}` }))).mockResolvedValueOnce([{ ...activity, id: 'activity-2000' }]);
    await getDailyOperationalReport('2026-09-01', '2026-09-02', { visibleOwnerIds: null });
    expect(mockPrisma.crmActivity.findMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.crmActivity.findMany.mock.calls[1][0].cursor).toEqual({ id: 'activity-1999' });
  });
  it('uses account identity for converted-lead attribution and company keys', () => {
    expect(resolveCompanyAttribution({ accountId: null, contactId: null, leadId: 'lead-1', opportunityId: null, account: null, contact: null, opportunity: null, lead: { companyName: 'old name', accountId: 'a1', account: { id: 'a1', name: 'Canonical Co' } } })).toEqual({ companyName: 'Canonical Co', accountId: 'a1' });
    expect(companyKey('Renamed Later', 'a1')).toBe('account:a1');
    expect(companyKey('Kapitani Sdn Bhd', null)).toBe(companyKey('KAPITANI  SDN BHD', null));
  });
  it('requires CRM source in the activity predicate', () => {
    expect(JSON.stringify((require('../services/crm-daily-report.service') as typeof import('../services/crm-daily-report.service')).activityReportWhere(new Date('2026-09-01'), new Date('2026-09-02'), { visibleOwnerIds: null }))).toContain('"source":"CRM"');
  });
});
