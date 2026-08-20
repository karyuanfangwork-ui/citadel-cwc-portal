import { render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dashboardMocks = vi.hoisted(() => ({
  getActivityFeed: vi.fn(),
  getAlerts: vi.fn(),
  getApprovalInbox: vi.fn(),
  getMyWork: vi.fn(),
  getPipelineDashboard: vi.fn(),
  getTeamPerformance: vi.fn(),
  getWorkQueue: vi.fn(),
  listBranches: vi.fn(),
  useCreditLane: vi.fn(),
}));

vi.mock('../../../../services/credit.service', () => ({
  dashboardApi: {
    getActivityFeed: dashboardMocks.getActivityFeed,
    getAlerts: dashboardMocks.getAlerts,
    getApprovalInbox: dashboardMocks.getApprovalInbox,
    getMyWork: dashboardMocks.getMyWork,
    getPipelineDashboard: dashboardMocks.getPipelineDashboard,
    getTeamPerformance: dashboardMocks.getTeamPerformance,
    getWorkQueue: dashboardMocks.getWorkQueue,
  },
  branchApi: { list: dashboardMocks.listBranches },
}));

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'manager-1', permissions: ['credit:admin'] } }),
}));

vi.mock('../useCreditLane', () => ({
  LANE_LABELS: { rm: 'My deals', approver: 'Decisions', manager: 'Portfolio' },
  useCreditLane: dashboardMocks.useCreditLane,
}));

import ManagerLane from '../ManagerLane';
import type { PipelineDashboard } from '../../../../services/credit.service';
import CreditDashboard from '../../../../../pages/credit/CreditDashboard';

const pipeline: PipelineDashboard = {
  states: [
    { state: 'SUBMITTED', count: 2, avgDaysInState: 1 },
    { state: 'KYC_REVIEW', count: 1, avgDaysInState: 3 },
    { state: 'CREDIT_ASSESSMENT', count: 4, avgDaysInState: 2 },
  ],
  totalApplications: 7,
  slaBreachCount: 0,
  slaBreaches: [],
};

const teamPerf = {
  slaCompliancePct: 92,
  avgApprovalTurnaroundDays: 4.5,
  bottleneckStage: { state: 'CREDIT_ASSESSMENT', avgDays: 2, pctSlowerThanAvg: 20 },
  totalDecisions: 18,
};

const alerts = {
  highDsr: { count: 2, thresholdPct: 60, filterUrl: '/credit/applications?filter=highDsr' },
  expiredBureau: { count: 1, maxAgeDays: 30, filterUrl: '/credit/applications?filter=expiredBureau' },
  amlReview: { count: 1, filterUrl: '/credit/applications?filter=amlReview' },
};

const renderLane = (overrides: Partial<ComponentProps<typeof ManagerLane>> = {}) => render(
  <ManagerLane
    pipeline={pipeline}
    teamPerf={teamPerf}
    activity={[]}
    alerts={alerts}
    {...overrides}
  />,
);

beforeEach(() => {
  dashboardMocks.useCreditLane.mockReturnValue({ lane: 'manager', lanes: ['rm', 'manager'], setLane: vi.fn() });
  dashboardMocks.listBranches.mockResolvedValue([]);
  dashboardMocks.getWorkQueue.mockResolvedValue({ data: { data: { buckets: [], totalApplications: 0 } } });
  dashboardMocks.getAlerts.mockResolvedValue({ data: { data: alerts } });
  dashboardMocks.getActivityFeed.mockResolvedValue({ data: { data: { items: [], total: 0, page: 1, limit: 20 } } });
  dashboardMocks.getTeamPerformance.mockResolvedValue({ data: { data: teamPerf } });
  dashboardMocks.getPipelineDashboard.mockResolvedValue({ data: { data: pipeline } });
  dashboardMocks.getMyWork.mockResolvedValue({ data: { data: {
    myApprovalCount: 0,
    myAssignedCount: 0,
    mySlaBreaches: 0,
    mySlaBreachItems: [],
    recentAssigned: [],
    recentApprovals: [],
    attention: { overdue: 0, dueSoon: 0, informationRequired: 0, returned: 0 },
  } } });
  dashboardMocks.getApprovalInbox.mockResolvedValue({ data: { data: { high: [], medium: [], low: [], totalPending: 0, excluded: [] } } });
});

describe('ManagerLane', () => {
  it('keeps each manager dashboard section under a single presentation owner', async () => {
    render(<MemoryRouter><CreditDashboard /></MemoryRouter>);

    await waitFor(() => expect(screen.getAllByRole('heading', { name: /application pipeline/i })).toHaveLength(1));

    expect(screen.getAllByRole('heading', { name: /team performance/i })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { name: /operational alerts/i })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { name: /recent activit/i })).toHaveLength(1);
  });

  it.each([
    ['manager', ['rm', 'manager']],
    ['approver', ['rm', 'approver']],
  ] as const)('keeps attention items linked to their existing routes in the %s lane', async (lane, lanes) => {
    dashboardMocks.useCreditLane.mockReturnValue({ lane, lanes, setLane: vi.fn() });
    render(<MemoryRouter><CreditDashboard /></MemoryRouter>);

    await waitFor(() => expect(screen.getByRole('link', { name: 'Overdue: 0' })).toHaveAttribute('href', '/credit/applications?quickFilter=overdue'));

    expect(screen.getByRole('link', { name: 'Due soon: 0' })).toHaveAttribute('href', '/credit/applications?quickFilter=dueSoon');
    expect(screen.getByRole('link', { name: 'Information required: 0' })).toHaveAttribute('href', '/credit/applications?quickFilter=informationRequired');
    expect(screen.getByRole('link', { name: 'Returned: 0' })).toHaveAttribute('href', '/credit/applications?quickFilter=returned');
  });

  it('renders a user-facing application pipeline with compact accessible stages', () => {
    renderLane();

    const pipelineRegion = screen.getByRole('region', { name: 'Application pipeline' });
    expect(within(pipelineRegion).getByRole('heading', { name: 'Application pipeline' })).toBeInTheDocument();
    expect(screen.queryByText('KYC_REVIEW')).not.toBeInTheDocument();
    expect(screen.queryByText('CREDIT_ASSESSMENT')).not.toBeInTheDocument();
    expect(within(pipelineRegion).getByRole('listitem', { name: /Intake.*2/ })).toBeInTheDocument();
    expect(within(pipelineRegion).getByRole('listitem', { name: /Verification.*1/ })).toBeInTheDocument();
    expect(within(pipelineRegion).getByRole('listitem', { name: /Assessment.*4/ })).toBeInTheDocument();
    expect(within(pipelineRegion).getAllByRole('listitem')).toHaveLength(5);
  });

  it('renders team performance as labeled metrics', () => {
    renderLane();

    const teamRegion = screen.getByRole('region', { name: 'Team performance' });
    expect(within(teamRegion).getByRole('term', { name: 'SLA compliance' })).toBeInTheDocument();
    expect(within(teamRegion).getByRole('definition', { name: '92%' })).toBeInTheDocument();
    expect(within(teamRegion).getByRole('term', { name: 'Approval turnaround' })).toBeInTheDocument();
    expect(within(teamRegion).getByRole('definition', { name: '4.5 days' })).toBeInTheDocument();
  });

  it('uses each active alert backend filter URL', () => {
    renderLane();

    const alertsRegion = screen.getByRole('region', { name: 'Operational alerts' });
    const highDsrAlert = within(alertsRegion).getByRole('listitem', { name: /High DSR.*2/ });
    const expiredBureauAlert = within(alertsRegion).getByRole('listitem', { name: /Expired bureau checks.*1/ });
    const amlReviewAlert = within(alertsRegion).getByRole('listitem', { name: /AML review.*1/ });

    expect(within(highDsrAlert).getByRole('link', { name: 'Review applications' })).toHaveAttribute('href', '/credit/applications?filter=highDsr');
    expect(within(expiredBureauAlert).getByRole('link', { name: 'Review applications' })).toHaveAttribute('href', '/credit/applications?filter=expiredBureau');
    expect(within(amlReviewAlert).getByRole('link', { name: 'Review applications' })).toHaveAttribute('href', '/credit/applications?filter=amlReview');
  });

  it('shows an explicit zero-alert state', () => {
    renderLane({ alerts: {
      highDsr: { count: 0, thresholdPct: 60, filterUrl: '/credit/applications?filter=highDsr' },
      expiredBureau: { count: 0, maxAgeDays: 30, filterUrl: '/credit/applications?filter=expiredBureau' },
      amlReview: { count: 0, filterUrl: '/credit/applications?filter=amlReview' },
    } });

    expect(screen.getByText('No operational alerts.')).toBeInTheDocument();
  });

  it('shows an explicit empty state when there is no recent activity', () => {
    renderLane();

    const activityRegion = screen.getByRole('region', { name: 'Recent activity' });
    expect(within(activityRegion).getByText('No recent activity.')).toBeInTheDocument();
    expect(within(activityRegion).queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows the specified unavailable states without empty lists', () => {
    renderLane({ pipeline: null, teamPerf: null, alerts: null, activity: [] });

    const pipelineRegion = screen.getByRole('region', { name: 'Application pipeline' });
    const teamRegion = screen.getByRole('region', { name: 'Team performance' });
    const alertsRegion = screen.getByRole('region', { name: 'Operational alerts' });

    expect(within(pipelineRegion).getByText('No pipeline data available.')).toBeInTheDocument();
    expect(within(pipelineRegion).queryByRole('list')).not.toBeInTheDocument();
    expect(within(teamRegion).getByText('Team performance is not available for this view.')).toBeInTheDocument();
    expect(within(alertsRegion).getByText('No operational alerts.')).toBeInTheDocument();
    expect(within(alertsRegion).queryByRole('list')).not.toBeInTheDocument();
  });

  it('renders activity details with the actor, action, application, and relative time', () => {
    renderLane({
      activity: [{
        id: 'activity-1',
        applicationNo: 'APP-1001',
        action: 'start_condition_fulfilment',
        actorName: 'Alex Tan',
        createdAt: new Date().toISOString(),
      }],
    });

    const activityRegion = screen.getByRole('region', { name: 'Recent activity' });
    expect(within(activityRegion).getByRole('listitem', { name: /Alex Tan.*Started condition fulfilment.*APP-1001.*Just now/ })).toBeInTheDocument();
    expect(within(activityRegion).queryByText('start_condition_fulfilment')).not.toBeInTheDocument();
  });
});
