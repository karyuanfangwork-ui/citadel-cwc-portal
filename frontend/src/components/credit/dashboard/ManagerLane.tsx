import React from 'react';
import type { CSSProperties } from 'react';
import type { PipelineDashboard } from '../../../services/credit.service';
import { buildPipelineStages, formatActivityAction, formatPipelineState } from './managerPresentation';

interface TeamPerformanceData {
  slaCompliancePct: number;
  avgApprovalTurnaroundDays: number | null;
  bottleneckStage: { state: string; avgDays: number; pctSlowerThanAvg: number } | null;
  totalDecisions: number;
}

interface ActivityItem {
  id: string;
  applicationNo: string;
  action: string;
  actorName: string | null;
  createdAt: string;
}

interface AlertsData {
  highDsr: { count: number; thresholdPct: number; filterUrl: string };
  expiredBureau: { count: number; maxAgeDays: number; filterUrl: string };
  amlReview: { count: number; filterUrl: string };
}

interface ManagerLaneProps {
  pipeline: PipelineDashboard | null;
  teamPerf: TeamPerformanceData | null;
  activity: ActivityItem[];
  alerts: AlertsData | null;
}

const sectionStyle: CSSProperties = {
  background: 'var(--cr-surface-container-lowest)',
  border: '1px solid var(--cr-outline-variant)',
  borderRadius: 'var(--cr-radius-lg, 0.5rem)',
  padding: 20,
};

const cardStyle: CSSProperties = {
  background: 'var(--cr-surface-container-low)',
  border: '1px solid var(--cr-outline-variant)',
  borderRadius: 'var(--cr-radius-md, 0.375rem)',
  minWidth: 0,
  padding: 14,
};

function formatDays(days: number): string {
  return `${Number.isInteger(days) ? days : days.toFixed(1)} ${days === 1 ? 'day' : 'days'}`;
}

function formatRelativeTime(createdAt: string): string {
  const timestamp = new Date(createdAt).getTime();
  if (Number.isNaN(timestamp)) return 'Recently';

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (elapsedSeconds < 60) return 'Just now';

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `${elapsedDays}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

const ManagerLane: React.FC<ManagerLaneProps> = ({ pipeline, teamPerf, activity, alerts }) => {
  const hasPipeline = Boolean(pipeline?.states.length);
  const totalApplications = pipeline?.totalApplications ?? 0;
  const pipelineStages = hasPipeline ? buildPipelineStages(pipeline!.states) : [];
  const activeAlerts = alerts ? [
    {
      id: 'high-dsr',
      label: 'High DSR',
      count: alerts.highDsr.count,
      description: `Applications above the ${alerts.highDsr.thresholdPct}% debt service ratio threshold.`,
      filterUrl: alerts.highDsr.filterUrl,
    },
    {
      id: 'expired-bureau',
      label: 'Expired bureau checks',
      count: alerts.expiredBureau.count,
      description: `Bureau checks older than ${alerts.expiredBureau.maxAgeDays} days need refreshing.`,
      filterUrl: alerts.expiredBureau.filterUrl,
    },
    {
      id: 'aml-review',
      label: 'AML review',
      count: alerts.amlReview.count,
      description: 'Applications waiting for anti-money-laundering review.',
      filterUrl: alerts.amlReview.filterUrl,
    },
  ].filter(alert => alert.count > 0) : [];

  const performanceMetrics = teamPerf ? [
    { label: 'SLA compliance', value: `${teamPerf.slaCompliancePct}%`, detail: 'Applications completed within the agreed service level.' },
    { label: 'Decisions', value: String(teamPerf.totalDecisions), detail: 'Credit decisions recorded for this view.' },
    {
      label: 'Approval turnaround',
      value: teamPerf.avgApprovalTurnaroundDays === null ? 'Not available' : formatDays(teamPerf.avgApprovalTurnaroundDays),
      detail: 'Average time taken to reach an approval decision.',
    },
    {
      label: 'Bottleneck',
      value: teamPerf.bottleneckStage ? formatPipelineState(teamPerf.bottleneckStage.state) : 'None identified',
      detail: teamPerf.bottleneckStage
        ? `${formatDays(teamPerf.bottleneckStage.avgDays)} in stage, ${teamPerf.bottleneckStage.pctSlowerThanAvg}% slower than average.`
        : 'No stage is currently slower than the rest of the pipeline.',
    },
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      <section aria-labelledby="manager-pipeline-heading" style={sectionStyle}>
        <div style={{ alignItems: 'baseline', display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
          <h2 id="manager-pipeline-heading" style={{ color: 'var(--cr-on-surface)', fontSize: 16, fontWeight: 650, margin: 0 }}>Application pipeline</h2>
          {hasPipeline && <p aria-label={`${totalApplications} total applications`} style={{ color: 'var(--cr-primary)', fontSize: 24, fontWeight: 700, margin: 0 }}>{totalApplications}</p>}
        </div>
        {hasPipeline ? (
          <>
            <p id="manager-pipeline-description" style={{ color: 'var(--cr-on-surface-variant)', fontSize: 13, margin: '4px 0 16px' }}>Applications currently moving through the credit process.</p>
            <ul aria-describedby="manager-pipeline-description" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', listStyle: 'none', margin: 0, padding: 0 }}>
              {pipelineStages.map(stage => {
                const percentage = totalApplications > 0 ? Math.round((stage.count / totalApplications) * 100) : 0;
                const averageDays = stage.avgDaysInState === undefined ? null : formatDays(stage.avgDaysInState);

                return (
                  <li key={stage.key} aria-label={`${stage.label}: ${stage.count} applications, ${percentage}% of total${averageDays ? `, average ${averageDays} in stage` : ''}`} style={cardStyle}>
                    <p style={{ color: 'var(--cr-on-surface-variant)', fontSize: 12, fontWeight: 600, margin: 0 }}>{stage.label}</p>
                    <p style={{ color: 'var(--cr-on-surface)', fontSize: 22, fontWeight: 700, margin: '6px 0 2px' }}>{stage.count}</p>
                    <p style={{ color: 'var(--cr-on-surface-variant)', fontSize: 12, margin: 0 }}>{percentage}% of total</p>
                    {averageDays && <p style={{ color: 'var(--cr-on-surface-variant)', fontSize: 12, margin: '6px 0 0' }}>Avg. {averageDays}</p>}
                    <div aria-hidden="true" style={{ background: 'var(--cr-surface-container-high)', borderRadius: 999, height: 4, marginTop: 10, overflow: 'hidden' }}>
                      <div style={{ background: 'var(--cr-primary)', borderRadius: 'inherit', height: '100%', width: `${percentage}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        ) : <p style={{ color: 'var(--cr-on-surface-variant)', margin: '12px 0 0' }}>No pipeline data available.</p>}
      </section>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', minWidth: 0 }}>
        <section aria-labelledby="manager-team-heading" style={sectionStyle}>
          <h2 id="manager-team-heading" style={{ color: 'var(--cr-on-surface)', fontSize: 16, fontWeight: 650, margin: 0 }}>Team performance</h2>
          {teamPerf ? (
            <dl style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 132px), 1fr))', margin: '16px 0 0' }}>
              {performanceMetrics.map(metric => (
                <div key={metric.label} aria-label={`${metric.label}: ${metric.value}`} style={cardStyle}>
                  <dt aria-label={metric.label} style={{ color: 'var(--cr-on-surface-variant)', fontSize: 12, fontWeight: 600 }}>{metric.label}</dt>
                  <dd aria-label={metric.value} style={{ color: 'var(--cr-on-surface)', fontSize: 18, fontWeight: 700, margin: '6px 0 4px' }}>{metric.value}</dd>
                  <p style={{ color: 'var(--cr-on-surface-variant)', fontSize: 12, lineHeight: 1.4, margin: 0 }}>{metric.detail}</p>
                </div>
              ))}
            </dl>
          ) : <p style={{ color: 'var(--cr-on-surface-variant)', margin: '12px 0 0' }}>Team performance is not available for this view.</p>}
        </section>

        <section aria-labelledby="manager-alerts-heading" style={sectionStyle}>
          <h2 id="manager-alerts-heading" style={{ color: 'var(--cr-on-surface)', fontSize: 16, fontWeight: 650, margin: 0 }}>Operational alerts</h2>
          {activeAlerts.length > 0 ? (
            <ul style={{ display: 'grid', gap: 10, listStyle: 'none', margin: '16px 0 0', padding: 0 }}>
              {activeAlerts.map(alert => (
                <li key={alert.id} aria-label={`${alert.label}: ${alert.count}. ${alert.description}`} style={cardStyle}>
                  <div style={{ alignItems: 'baseline', display: 'flex', gap: 10, justifyContent: 'space-between' }}>
                    <strong style={{ color: 'var(--cr-on-surface)', fontSize: 14 }}>{alert.label}</strong>
                    <span style={{ color: 'var(--cr-error, #b3261e)', fontSize: 20, fontWeight: 700 }}>{alert.count}</span>
                  </div>
                  <p style={{ color: 'var(--cr-on-surface-variant)', fontSize: 13, lineHeight: 1.4, margin: '6px 0 10px' }}>{alert.description}</p>
                  <a href={alert.filterUrl} style={{ color: 'var(--cr-primary)', fontSize: 13, fontWeight: 600 }}>Review applications</a>
                </li>
              ))}
            </ul>
          ) : <p style={{ color: 'var(--cr-on-surface-variant)', margin: '12px 0 0' }}>No operational alerts.</p>}
        </section>
      </div>

      <section aria-labelledby="manager-activity-heading" style={sectionStyle}>
        <h2 id="manager-activity-heading" style={{ color: 'var(--cr-on-surface)', fontSize: 16, fontWeight: 650, margin: 0 }}>Recent activity</h2>
        {activity.length > 0 ? (
          <ul style={{ display: 'grid', gap: 1, listStyle: 'none', margin: '12px 0 0', padding: 0 }}>
            {activity.map(item => (
              <li key={item.id} aria-label={`${item.actorName ?? 'Unknown user'} ${formatActivityAction(item.action)} ${item.applicationNo} ${formatRelativeTime(item.createdAt)}`} style={{ borderBottom: '1px solid var(--cr-outline-variant)', padding: '12px 0' }}>
                <p style={{ color: 'var(--cr-on-surface)', fontSize: 14, margin: 0 }}><strong>{item.actorName ?? 'Unknown user'}</strong> {formatActivityAction(item.action)}</p>
                <p style={{ color: 'var(--cr-on-surface-variant)', fontSize: 12, margin: '4px 0 0' }}>{item.applicationNo} · {formatRelativeTime(item.createdAt)}</p>
              </li>
            ))}
          </ul>
        ) : <p style={{ color: 'var(--cr-on-surface-variant)', margin: '12px 0 0' }}>No recent activity.</p>}
      </section>
    </div>
  );
};

export default ManagerLane;
