import {
  buildCrmActivityReminderVariables,
  formatCrmActivityType,
} from '../crm-activity-reminder.service';

const scheduledAt = new Date('2026-09-24T07:00:00.000Z');

function build(overrides: Record<string, unknown> = {}) {
  return buildCrmActivityReminderVariables({
    id: 'activity-1',
    activityType: 'MEETING',
    subject: 'Quarterly Review',
    scheduledAt,
    ...overrides,
  });
}

describe('CRM activity reminder variables', () => {
  it('builds a scheduled meeting reminder with Account context', () => {
    const variables = build({ account: { name: 'ABC Sdn Bhd' } });

    expect(variables).toMatchObject({
      activityId: 'activity-1',
      activitySubject: 'Quarterly Review',
      activityType: 'MEETING',
      activityTypeLabel: 'Meeting',
      relatedEntityLabel: 'ABC Sdn Bhd',
      reminderTitle: 'Meeting Reminder — ABC Sdn Bhd',
    });
    expect(variables.scheduledTime).not.toBe('—');
  });

  it('uses Opportunity, Lead, Account, then Contact precedence', () => {
    expect(build({ activityType: 'CALL', opportunity: { name: 'Acme Renewal' }, lead: { title: 'John Tan' }, account: { name: 'Acme' }, contact: { firstName: 'John', lastName: 'Tan' } }).relatedEntityLabel)
      .toBe('Opportunity: Acme Renewal');
    expect(build({ activityType: 'FOLLOW_UP', lead: { title: 'John Tan' }, account: { name: 'Acme' } }).reminderTitle)
      .toBe('Follow-up Reminder — Lead: John Tan');
    expect(build({ account: { name: 'ABC Sdn Bhd' }, contact: { firstName: 'John', lastName: 'Tan' } }).relatedEntityLabel)
      .toBe('ABC Sdn Bhd');
    expect(build({ contact: { firstName: 'John', lastName: 'Tan' } }).relatedEntityLabel)
      .toBe('Contact: John Tan');
  });

  it('falls back to the activity subject when no CRM record is linked', () => {
    const variables = build({ activityType: 'TASK', subject: 'Prepare proposal' });

    expect(variables.relatedEntityLabel).toBe('Prepare proposal');
    expect(variables.reminderTitle).toBe('Task Reminder — Prepare proposal');
  });

  it('converts internal activity enum values to user-facing labels', () => {
    expect(formatCrmActivityType('SITE_VISIT')).toBe('Site Visit');
    expect(formatCrmActivityType('FOLLOW_UP')).toBe('Follow-up');
  });
});
