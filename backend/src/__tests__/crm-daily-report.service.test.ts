const mockPrisma = {
  crmActivity: { findMany: jest.fn() },
  crmLead: { findMany: jest.fn() },
};

jest.mock('../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));

import { getDailyOperationalReport, resolveCompanyAttribution } from '../services/crm-daily-report.service';

describe('CRM daily operational report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.crmActivity.findMany.mockResolvedValue([
      {
        activityType: 'CALL', callCategory: 'NEW_CALL', callOutcome: 'NO_ANSWER',
        emailOutcome: null, meetingOutcome: null, engagementOutcome: null,
        createdAt: new Date('2026-08-17T01:00:00.000Z'),
      },
      {
        activityType: 'FOLLOW_UP', callCategory: 'FOLLOW_UP_CALL', callOutcome: 'INTERESTED',
        emailOutcome: null, meetingOutcome: null, engagementOutcome: 'INTERESTED',
        createdAt: new Date('2026-08-17T02:00:00.000Z'),
      },
      {
        activityType: 'EMAIL', callCategory: null, callOutcome: null,
        emailOutcome: 'BOUNCED', meetingOutcome: null, engagementOutcome: null,
        createdAt: new Date('2026-08-17T03:00:00.000Z'),
      },
      {
        activityType: 'MEETING', callCategory: null, callOutcome: null,
        emailOutcome: null, meetingOutcome: 'ARRANGED', engagementOutcome: null,
        createdAt: new Date('2026-08-17T04:00:00.000Z'),
      },
    ]);
    mockPrisma.crmLead.findMany.mockResolvedValue([
      { status: 'CONVERTED', convertedAt: new Date('2026-08-17T05:00:00.000Z'), updatedAt: new Date('2026-08-17T05:00:00.000Z') },
      { status: 'LOST', convertedAt: null, updatedAt: new Date('2026-08-17T06:00:00.000Z') },
    ]);
  });

  it('resolves company attribution without parsing activity text', () => {
    expect(resolveCompanyAttribution({
      accountId: null, contactId: null, leadId: 'lead-1', opportunityId: null,
      account: null, contact: null, opportunity: null, lead: { companyName: 'Kapitani sdn bhd' },
    })).toEqual({ companyName: 'Kapitani sdn bhd', accountId: null });
    expect(resolveCompanyAttribution({
      accountId: 'account-1', contactId: null, leadId: null, opportunityId: null,
      account: { id: 'account-1', name: 'Wanzar group sdn bhd' }, contact: null, opportunity: null, lead: null,
    })).toEqual({ companyName: 'Wanzar group sdn bhd', accountId: 'account-1' });
    expect(resolveCompanyAttribution({
      accountId: 'account-1', contactId: null, leadId: 'lead-1', opportunityId: null,
      account: null, contact: null, opportunity: null, lead: { companyName: 'Invalid' },
    })).toEqual({ companyName: 'Unassigned / Invalid linkage', accountId: null });
  });

  it('aggregates structured activity outcomes and lead lifecycle events by day', async () => {
    const result = await getDailyOperationalReport(
      new Date('2026-08-17T00:00:00.000Z'),
      new Date('2026-08-17T23:59:59.999Z'),
      ['owner-1'],
    );

    expect(result.period.timezone).toBe('Asia/Kuala_Lumpur');
    expect(result.daily).toHaveLength(1);
    expect(result.daily[0]).toMatchObject({
      date: '2026-08-17',
      emailsSent: 0,
      emailBounces: 1,
      newCalls: 1,
      followUpCalls: 1,
      callEngagement: 1,
      interested: 1,
      noAnswer: 1,
      meetingsArranged: 1,
      merchantsSignedUp: 1,
      merchantsDeclined: 1,
    });
    expect(result.totals).toMatchObject({
      date: 'TOTAL',
      emailsSent: result.daily[0].emailsSent,
      emailBounces: result.daily[0].emailBounces,
      newCalls: result.daily[0].newCalls,
      followUpCalls: result.daily[0].followUpCalls,
      callEngagement: result.daily[0].callEngagement,
      interested: result.daily[0].interested,
      noAnswer: result.daily[0].noAnswer,
      meetingsArranged: result.daily[0].meetingsArranged,
      merchantsSignedUp: result.daily[0].merchantsSignedUp,
      merchantsDeclined: result.daily[0].merchantsDeclined,
    });
    expect(result.byCompany.reduce((sum, company) => sum + company.activityCount, 0)).toBe(4);
  });
});
