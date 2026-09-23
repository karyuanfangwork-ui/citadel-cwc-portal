const mockPrisma = {
  crmActivity: { findMany: jest.fn(), update: jest.fn() },
};
const notify = jest.fn();

jest.mock('../../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../notification.service', () => ({ notify }));
jest.mock('../../utils/logger', () => ({ logger: { error: jest.fn(), info: jest.fn() } }));
jest.mock('../crm-assignment.service', () => ({ resolveAssignmentForLead: jest.fn() }));

import { checkActivityReminders } from '../crm-automation.service';

describe('scheduled CRM activity reminders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends an Account-context meeting reminder and marks it sent after notification creation', async () => {
    mockPrisma.crmActivity.findMany.mockResolvedValue([{
      id: 'activity-1', userId: 'user-1', activityType: 'MEETING', subject: 'Quarterly Review',
      scheduledAt: new Date('2026-09-24T07:00:00.000Z'), opportunity: null, lead: null,
      account: { name: 'ABC Sdn Bhd' }, contact: null,
    }]);
    notify.mockResolvedValue(undefined);
    mockPrisma.crmActivity.update.mockResolvedValue({ id: 'activity-1', reminderSent: true });

    await checkActivityReminders();

    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      eventType: 'crm_activity_reminder',
      variables: expect.objectContaining({
        reminderTitle: 'Meeting Reminder — ABC Sdn Bhd',
        activitySubject: 'Quarterly Review',
        activityId: 'activity-1',
      }),
    }));
    expect(mockPrisma.crmActivity.update).toHaveBeenCalledWith({
      where: { id: 'activity-1' }, data: { reminderSent: true },
    });
  });

  it('does not mark the activity as reminded when notification generation fails', async () => {
    mockPrisma.crmActivity.findMany.mockResolvedValue([{
      id: 'activity-1', userId: 'user-1', activityType: 'TASK', subject: 'Prepare proposal',
      scheduledAt: new Date('2026-09-24T07:00:00.000Z'), opportunity: null, lead: null, account: null, contact: null,
    }]);
    notify.mockRejectedValue(new Error('delivery unavailable'));

    await checkActivityReminders();

    expect(mockPrisma.crmActivity.update).not.toHaveBeenCalled();
  });
});
