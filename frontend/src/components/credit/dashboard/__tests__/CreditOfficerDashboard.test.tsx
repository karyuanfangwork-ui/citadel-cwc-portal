import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import AttentionStrip from '../AttentionStrip';
import NextActionsPanel from '../NextActionsPanel';
import OperationalAlerts from '../OperationalAlerts';
import PriorityWorkQueue from '../PriorityWorkQueue';

describe('Credit officer dashboard sections', () => {
  it('exposes attention, priority work, next actions, and operational alerts', () => {
    render(
      <MemoryRouter>
        <AttentionStrip attention={{ overdue: 1, dueSoon: 2, informationRequired: 3, returned: 4 }} />
        <PriorityWorkQueue
          items={[{ id: 'app-1', applicationNo: 'CA-2026-00001', borrowerName: 'A Borrower', state: 'UNDERWRITING', requestedAmount: 100000, slaStatus: 'WARNING', slaRemainingHours: 4, priority: 'HIGH' }]}
          formatAmount={(value) => `MYR ${value}`}
          stateLabels={{ UNDERWRITING: 'Underwriting' }}
          formatSla={(hours) => `${hours}h remaining`}
        />
        <NextActionsPanel items={[{ id: 'app-1', applicationNo: 'CA-2026-00001', borrowerName: 'A Borrower', currentTask: 'Complete underwriting', nextAction: { label: 'Continue underwriting', route: '/credit/applications/app-1' } }]} />
        <OperationalAlerts alerts={[{ title: 'High DSR', icon: 'trending_up', count: 2, description: 'Review cases', actionLabel: 'View Cases', filterUrl: '/credit/applications?dsr=high', variant: 'danger' }]} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Priority Work Queue' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'CA-2026-00001' })).toHaveAttribute('href', '/credit/applications/app-1');
    expect(screen.getByRole('heading', { name: 'Next Actions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Operational alerts' })).toBeInTheDocument();
    expect(screen.getByText('High DSR')).toBeInTheDocument();
  });
});
