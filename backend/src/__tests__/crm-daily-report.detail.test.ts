const mockPrisma = { crmActivity: { findMany: jest.fn() }, crmLead: { findMany: jest.fn() }, crmOpportunity: { findMany: jest.fn() } };
jest.mock('../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));
import { getDailyOperationalActivityDetail } from '../services/crm-daily-report.service';

describe('daily operational activity detail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.crmActivity.findMany.mockResolvedValue([{
      id: 'activity-1', activityType: 'MEETING', subject: 'Walkthrough', callCategory: null, callOutcome: null, emailOutcome: null, meetingOutcome: 'COMPLETED', engagementOutcome: 'INTERESTED', source: 'CRM', createdAt: new Date('2026-09-01T02:00:00.000Z'), outcomeRecordedAt: new Date('2026-09-02T02:00:00.000Z'), accountId: null, contactId: null, leadId: null, opportunityId: null, account: null, contact: null, lead: null, opportunity: null, user: { firstName: 'Kar', lastName: 'Yuan', email: 'ky@test.local' },
    }]);
    mockPrisma.crmOpportunity.findMany.mockResolvedValue([{ id: 'o1', name: 'Won deal', wonAt: new Date('2026-09-02T03:00:00.000Z'), lostAt: null, account: { id: 'a1', name: 'Won Co' }, owner: { firstName: 'Kar', lastName: 'Yuan', email: 'ky@test.local' } }]);
    mockPrisma.crmLead.findMany.mockResolvedValue([]);
  });
  it('exports both metric dates and outcome fields', async () => {
    const [row] = await getDailyOperationalActivityDetail('2026-09-01', '2026-09-02', { visibleOwnerIds: null });
    expect(row).toMatchObject({ eventType: 'ACTIVITY', volumeDate: '2026-09-01', outcomeDate: '2026-09-02', meetingOutcome: 'COMPLETED', engagementOutcome: 'INTERESTED', source: 'CRM' });
  });
  it('includes and chronologically sorts lifecycle events', async () => {
    const rows = await getDailyOperationalActivityDetail('2026-09-01', '2026-09-02', { visibleOwnerIds: null });
    expect(rows).toContainEqual(expect.objectContaining({ eventType: 'OPPORTUNITY_WON', activitySubject: 'Won deal' }));
    expect(rows.map(row => row.occurredAt)).toEqual([...rows].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).map(row => row.occurredAt));
  });
});
