import { render, screen } from '@testing-library/react';
import UpcomingFollowUpsWidget from '../UpcomingFollowUpsWidget';

const items = [
  { id: '1', title: 'Site Visit: Global Logistics', contactName: 'Ahmad Razak', followUpDate: '2026-10-18T10:30:00Z', followUpNote: null, entityType: 'lead' as const },
  { id: '2', title: 'Call: Dato Seri Zulkifli', contactName: null, followUpDate: '2026-10-19T15:45:00Z', followUpNote: 'Discuss rate', entityType: 'opportunity' as const },
];

describe('UpcomingFollowUpsWidget', () => {
  it('renders follow-up titles', () => {
    render(<UpcomingFollowUpsWidget items={items} />);
    expect(screen.getByText('Site Visit: Global Logistics')).toBeInTheDocument();
    expect(screen.getByText('Call: Dato Seri Zulkifli')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    render(<UpcomingFollowUpsWidget items={[]} />);
    expect(screen.getByText('No upcoming follow-ups')).toBeInTheDocument();
  });
});
