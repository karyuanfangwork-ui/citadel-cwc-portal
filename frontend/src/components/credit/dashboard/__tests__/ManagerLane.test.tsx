import { render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import ManagerLane from '../ManagerLane';
import type { PipelineDashboard } from '../../../../services/credit.service';

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
  highDsr: { count: 2, thresholdPct: 60 },
  expiredBureau: { count: 1, maxAgeDays: 30 },
  amlReview: { count: 0 },
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

describe('ManagerLane', () => {
  it('renders a user-facing application pipeline with compact accessible stages', () => {
    renderLane();

    const pipelineRegion = screen.getByRole('region', { name: 'Application pipeline' });
    expect(within(pipelineRegion).getByRole('heading', { name: 'Application pipeline' })).toBeInTheDocument();
    expect(screen.queryByText('KYC_REVIEW')).not.toBeInTheDocument();
    expect(screen.queryByText('CREDIT_ASSESSMENT')).not.toBeInTheDocument();
    expect(within(pipelineRegion).getByRole('listitem', { name: /Submitted.*2/ })).toBeInTheDocument();
    expect(within(pipelineRegion).getByRole('listitem', { name: /Verification review.*1/ })).toBeInTheDocument();
    expect(within(pipelineRegion).getByRole('listitem', { name: /Credit assessment.*4/ })).toBeInTheDocument();
  });

  it('renders team performance as labeled metrics', () => {
    renderLane();

    const teamRegion = screen.getByRole('region', { name: 'Team performance' });
    expect(within(teamRegion).getByRole('term', { name: 'SLA compliance' })).toBeInTheDocument();
    expect(within(teamRegion).getByRole('definition', { name: '92%' })).toBeInTheDocument();
    expect(within(teamRegion).getByRole('term', { name: 'Approval turnaround' })).toBeInTheDocument();
    expect(within(teamRegion).getByRole('definition', { name: '4.5 days' })).toBeInTheDocument();
  });

  it('uses labeled alert items and shows an explicit zero-alert state', () => {
    renderLane();

    const alertsRegion = screen.getByRole('region', { name: 'Operational alerts' });
    expect(within(alertsRegion).getByRole('listitem', { name: /High DSR.*2/ })).toBeInTheDocument();

    renderLane({ alerts: { highDsr: { count: 0, thresholdPct: 60 }, expiredBureau: { count: 0, maxAgeDays: 30 }, amlReview: { count: 0 } } });
    expect(screen.getByText('No operational alerts.')).toBeInTheDocument();
  });

  it('shows an explicit empty state when there is no recent activity', () => {
    renderLane();

    const activityRegion = screen.getByRole('region', { name: 'Recent activity' });
    expect(within(activityRegion).getByText('No recent activity.')).toBeInTheDocument();
  });
});
