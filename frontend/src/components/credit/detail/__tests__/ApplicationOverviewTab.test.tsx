import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getApplicationLifecycleState } from '../../../../../pages/credit/creditUtils';
import ApplicationOverviewTab from '../ApplicationOverviewTab';

const makeProps = () => ({
  app: {
    id: 'app-1', applicationNo: 'APP-001', productType: 'SME', requestedAmount: 100000,
    currency: 'MYR', requestedTenor: 12, riskRating: 'BBB', borrowerProfile: {
      borrowerType: 'CORPORATE', companyName: 'Example Sdn Bhd',
    }, rm: { firstName: 'R', lastName: 'M' }, analyst: { firstName: 'A', lastName: 'N' },
  },
  facilities: [],
  readiness: {
    ready: false,
    errors: [{ field: 'retailIncome', message: 'Income assessment is required' }],
    warnings: [],
    satisfied: [],
  },
  readinessLoading: false,
  readinessError: null,
  onRetryReadiness: vi.fn(),
  slaDaysLeft: 5,
  formatTimeAgo: () => 'recently',
  onNavigate: vi.fn(),
  transitions: [],
  currentState: 'DRAFT',
  lifecycleState: getApplicationLifecycleState('DRAFT'),
  phaseCompletion: {},
  commentPreviews: [],
  onAddNote: vi.fn(),
  onOpenComments: vi.fn(),
  nextTab: null,
  nextGroupLabel: '',
  nextTabLabel: '',
  urgency: 'normal' as const,
  progressPct: 20,
  documentReadinessPct: 0,
  workflowVelocityPct: 50,
  currentJourneyIndex: 0,
  onNavigateToWorkspace: vi.fn(),
  onSubmit: vi.fn(),
});

describe('ApplicationOverviewTab progress mode', () => {
  it('renders progress essentials first and defers secondary details', () => {
    render(<ApplicationOverviewTab {...(makeProps() as any)} />);

    expect(screen.getByTestId('application-overview')).toHaveClass('gap-3');

    const identity = screen.getByRole('heading', { name: 'APP-001' });
    const progress = screen.getByRole('region', { name: 'Application progress' });
    const attention = screen.getByText('What needs your attention');
    expect(identity.compareDocumentPosition(progress) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(progress.compareDocumentPosition(attention) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open next item' })).toBeInTheDocument();
    expect(screen.queryByText('Credit Risk Snapshot')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'More application details' }));
    expect(screen.getByText('Credit Risk Snapshot')).toBeInTheDocument();
    expect(document.getElementById('application-overview-secondary-details')).toBeInTheDocument();
  });
});
