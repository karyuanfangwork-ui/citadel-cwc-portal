import { fireEvent, render, screen } from '@testing-library/react';
import MyTasksWidget from '../MyTasksWidget';
import type { CrmActivity } from '../../../services/crm.service';

const tasks: CrmActivity[] = [
  {
    id: '1',
    activityType: 'TASK',
    subject: 'Review credit report',
    description: null,
    scheduledAt: '2026-10-18T14:00:00Z',
    createdAt: '',
    updatedAt: '',
    userId: 'u1',
    accountId: null,
    contactId: null,
    opportunityId: null,
    leadId: null,
    completedAt: null,
    durationMinutes: null,
    callCategory: null,
    callOutcome: null,
    emailOutcome: null,
    meetingOutcome: null,
    engagementOutcome: null,
    reminderSent: false,
    user: { id: 'u1', firstName: 'Ahmad', lastName: 'Razak', email: 'ahmad@test.local', avatarUrl: null },
  },
];

describe('MyTasksWidget', () => {
  it('renders task subject', () => {
    render(<MyTasksWidget activities={tasks} />);
    expect(screen.getByText('Review credit report')).toBeInTheDocument();
  });

  it('checking a task marks it done', () => {
    render(<MyTasksWidget activities={tasks} />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('renders empty state when no tasks', () => {
    render(<MyTasksWidget activities={[]} />);
    expect(screen.getByText('No tasks due')).toBeInTheDocument();
  });
});
