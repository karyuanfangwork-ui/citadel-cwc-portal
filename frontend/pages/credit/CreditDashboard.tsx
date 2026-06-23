import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardApi, branchApi, Branch } from '../../src/services/credit.service';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../src/utils/errorMessages';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkQueueBucket {
  key: string;
  label: string;
  count: number;
  slaCompliancePct: number | null;
  states: string[];
}

interface WorkQueueResult {
  buckets: WorkQueueBucket[];
  totalApplications: number;
}

interface DashboardAlerts {
  highDsr: { count: number; thresholdPct: number; filterUrl: string };
  expiredBureau: { count: number; maxAgeDays: number; filterUrl: string };
  amlReview: { count: number; filterUrl: string };
}

interface ActivityFeedItem {
  id: string;
  applicationId: string;
  applicationNo: string;
  eventType: string;
  action: string;
  actorId: string | null;
  actorName: string | null;
  newState: string | null;
  createdAt: string;
}

interface ActivityFeedResult {
  items: ActivityFeedItem[];
  total: number;
  page: number;
  limit: number;
}

interface TeamPerformanceResult {
  slaCompliancePct: number;
  avgApprovalTurnaroundDays: number | null;
  bottleneckStage: { state: string; avgDays: number; pctSlowerThanAvg: number } | null;
  totalDecisions: number;
}

interface PipelineStateCount {
  state: string;
  count: number;
  avgDaysInState: number;
}

interface PipelineDashboard {
  states: PipelineStateCount[];
  totalApplications: number;
  slaBreachCount: number;
  slaBreaches: any[];
}

interface MyWorkItem {
  id: string;
  applicationNo: string;
  state: string;
  borrowerName: string;
  productType: string;
  updatedAt: string;
  requestedAmount: number | null;
  riskGrade: string | null;
  slaStatus: 'OK' | 'WARNING' | 'OVERDUE';
  entityType: string | null;
  slaRemainingHours: number | null;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface MyWorkDashboard {
  myApprovalCount: number;
  myAssignedCount: number;
  mySlaBreaches: number;
  mySlaBreachItems: any[];
  recentAssigned: MyWorkItem[];
  recentApprovals: MyWorkItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatMYR = (val: number | null | undefined) =>
  val != null
    ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val)
    : '—';

const STATE_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  KYC_REVIEW: 'Verification',
  COMPLIANCE_HOLD: 'Compliance Hold',
  KYC_APPROVED: 'KYC Approved',
  KYC_REJECTED: 'KYC Rejected',
  UNDERWRITING: 'Underwriting',
  CREDIT_ASSESSMENT: 'Credit Assessment',
  COMMITTEE_REVIEW: 'Committee Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  OFFER: 'Offer',
  ACCEPTED: 'Accepted',
  DISBURSED: 'Disbursed',
  ACTIVE: 'Active',
  CLOSED: 'Closed',
  WITHDRAWN: 'Withdrawn',
  REFERRED_BACK: 'Returned',
  CONDITION_FULFILMENT: 'Condition Fulfilment',
};

const PRIORITY_COLORS: Record<string, { dot: string; text: string }> = {
  HIGH: { dot: '#ba1a1a', text: '#ba1a1a' },
  MEDIUM: { dot: '#d97706', text: '#d97706' },
  LOW: { dot: '#16a34a', text: '#45464d' },
};

const SLA_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  OK: { bg: '#f0fdf4', text: '#16a34a' },
  WARNING: { bg: '#fffbeb', text: '#d97706' },
  OVERDUE: { bg: '#fef2f2', text: '#ba1a1a' },
};

function formatSlaRemaining(hours: number | null): string {
  if (hours == null) return '—';
  if (hours <= 0) return 'Overdue';
  if (hours < 24) return `${hours}h remaining`;
  const days = Math.floor(hours / 24);
  return `${days}d remaining`;
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

// Pipeline funnel stages — collapse 20 states into 6 display stages
const FUNNEL_STAGES = [
  { label: 'Draft', states: ['DRAFT'] },
  { label: 'Submitted', states: ['SUBMITTED', 'KYC_REVIEW', 'KYC_APPROVED'] },
  { label: 'Verification', states: ['COMPLIANCE_HOLD'] },
  { label: 'Under Assessment', states: ['UNDERWRITING', 'CREDIT_ASSESSMENT', 'COMMITTEE_REVIEW', 'CONDITION_FULFILMENT'] },
  { label: 'Final Approval', states: ['APPROVED', 'OFFER', 'ACCEPTED', 'REFERRED_BACK'] },
  { label: 'Disbursed', states: ['DISBURSED', 'ACTIVE'] },
];

function computeFunnel(pipelineStates: PipelineStateCount[]) {
  const total = pipelineStates.reduce((sum, s) => sum + s.count, 0);
  return FUNNEL_STAGES.map((stage, i) => {
    const count = pipelineStates
      .filter(ps => stage.states.includes(ps.state))
      .reduce((sum, ps) => sum + ps.count, 0);
    const conversionPct = total > 0 ? Math.round((count / total) * 100) : 0;
    const prevCount = i === 0 ? total : FUNNEL_STAGES.slice(0, i).reduce((acc, s) => {
      return acc + pipelineStates.filter(ps => s.states.includes(ps.state)).reduce((sum, ps) => sum + ps.count, 0);
    }, 0);
    const stageConversion = prevCount > 0 ? Math.round((count / prevCount) * 100) : 0;
    return { label: stage.label, count, conversionPct, stageConversion };
  });
}

// ---------------------------------------------------------------------------
// KPI Card Component
// ---------------------------------------------------------------------------

const KpiCard: React.FC<{ bucket: WorkQueueBucket; isCritical?: boolean }> = ({ bucket, isCritical }) => {
  const compliance = bucket.slaCompliancePct;
  const barColor = compliance == null ? 'var(--cr-outline-variant)' : compliance >= 80 ? 'var(--cr-secondary)' : compliance >= 60 ? '#d97706' : 'var(--cr-error)';

  return (
    <div
      style={{
        background: 'var(--cr-surface-container-lowest)',
        border: `1px solid ${isCritical ? 'var(--cr-error)' : 'var(--cr-outline-variant)'}`,
        borderLeft: isCritical ? '3px solid var(--cr-error)' : undefined,
        borderRadius: 'var(--cr-radius-lg, 0.5rem)',
        padding: '14px 16px',
        minWidth: 0,
        flex: '1 1 0',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--cr-font-display)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: isCritical ? 'var(--cr-error)' : 'var(--cr-on-surface-variant)',
          marginBottom: 6,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {bucket.label}
      </p>
      <p
        style={{
          fontFamily: 'var(--cr-font-display)',
          fontSize: 28,
          fontWeight: 700,
          color: isCritical ? 'var(--cr-error)' : 'var(--cr-on-surface)',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
        }}
      >
        {bucket.count}
      </p>

      {/* SLA compliance bar */}
      {compliance != null && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: 'var(--cr-on-surface-variant)' }}>SLA</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: barColor, fontVariantNumeric: 'tabular-nums' }}>{compliance}%</span>
          </div>
          <div style={{ height: 3, background: 'var(--cr-surface-container)', borderRadius: 9999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${compliance}%`, background: barColor, borderRadius: 9999, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {isCritical && bucket.count > 0 && (
        <p style={{ fontSize: 10, color: 'var(--cr-error)', marginTop: 6, fontWeight: 600 }}>Immediate attention</p>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Pipeline Funnel Component (CSS clip-path chevrons)
// ---------------------------------------------------------------------------

const PipelineFunnel: React.FC<{ pipeline: PipelineDashboard | null }> = ({ pipeline }) => {
  if (!pipeline || !pipeline.states.length) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--cr-on-surface-variant)' }}>No pipeline data</div>;
  }

  const stages = computeFunnel(pipeline.states);
  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 2, overflowX: 'auto' }}>
      {stages.map((stage, i) => {
        const widthPct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
        const isCurrent = stage.label === 'Under Assessment';
        const bg = isCurrent ? 'var(--cr-secondary-fixed)' : 'var(--cr-surface-container)';
        const textCol = isCurrent ? 'var(--cr-on-secondary-fixed-variant)' : 'var(--cr-on-surface-variant)';

        return (
          <div
            key={stage.label}
            style={{
              flex: '1 1 0',
              minWidth: 120,
              background: bg,
              clipPath: i === 0
                ? 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)'
                : i === stages.length - 1
                  ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 12px 50%)'
                  : 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)',
              padding: '12px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <p style={{ fontFamily: 'var(--cr-font-display)', fontSize: 11, fontWeight: 600, color: textCol, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              {stage.label}
            </p>
            <p style={{ fontFamily: 'var(--cr-font-display)', fontSize: 22, fontWeight: 700, color: textCol, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {stage.count}
            </p>
            <p style={{ fontSize: 10, color: textCol, opacity: 0.8, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
              {stage.conversionPct}% of total
            </p>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Alert Tile Component
// ---------------------------------------------------------------------------

const AlertTile: React.FC<{
  title: string;
  icon: string;
  count: number;
  description: string;
  actionLabel: string;
  filterUrl: string;
  variant: 'danger' | 'warning' | 'info';
}> = ({ title, icon, count, description, actionLabel, filterUrl, variant }) => {
  const colors = {
    danger: { bg: '#fef2f2', border: '#ba1a1a', iconBg: '#ba1a1a', text: '#93000a' },
    warning: { bg: '#fffbeb', border: '#d97706', iconBg: '#d97706', text: '#78350f' },
    info: { bg: 'var(--cr-surface-container)', border: 'var(--cr-outline-variant)', iconBg: 'var(--cr-on-surface-variant)', text: 'var(--cr-on-surface-variant)' },
  };
  const c = colors[variant];

  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 'var(--cr-radius-lg, 0.5rem)',
        padding: 16,
        flex: '1 1 0',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 'var(--cr-radius)', background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#fff' }}>{icon}</span>
        </div>
        <p style={{ fontFamily: 'var(--cr-font-display)', fontSize: 13, fontWeight: 600, color: c.text, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {title}
        </p>
      </div>
      <p style={{ fontSize: 13, color: c.text, lineHeight: 1.4, marginBottom: 12 }}>
        {count > 0 ? `${count} ${description}` : 'No alerts'}
      </p>
      {count > 0 && (
        <Link
          to={filterUrl}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'var(--cr-font-display)',
            fontSize: 12,
            fontWeight: 600,
            color: c.border,
            textDecoration: 'none',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {actionLabel}
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
        </Link>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Activity Timeline Component
// ---------------------------------------------------------------------------

const ActivityTimeline: React.FC<{ items: ActivityFeedItem[]; loading: boolean }> = ({ items, loading }) => {
  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--cr-on-surface-variant)' }}>Loading activities…</div>;
  }
  if (!items.length) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--cr-on-surface-variant)' }}>No recent activity</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {items.slice(0, 8).map((item, i) => (
        <div
          key={item.id}
          style={{
            display: 'flex',
            gap: 12,
            paddingBottom: i < Math.min(items.length, 8) - 1 ? 14 : 0,
            position: 'relative',
          }}
        >
          {/* Timeline dot */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--cr-secondary)', marginTop: 4 }} />
            {i < Math.min(items.length, 8) - 1 && <div style={{ width: 1, flex: 1, background: 'var(--cr-outline-variant)', marginTop: 2 }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--cr-on-surface)', marginBottom: 2 }}>
              {item.action.replace(/_/g, ' ')}
            </p>
            <p style={{ fontSize: 12, color: 'var(--cr-on-surface-variant)' }}>
              {item.applicationNo && <Link to={`/credit/applications/${item.applicationId}`} style={{ color: 'var(--cr-secondary)', textDecoration: 'none' }}>{item.applicationNo}</Link>}
              {item.actorName ? ` · ${item.actorName}` : ''}
              {item.newState ? ` · → ${STATE_LABELS[item.newState] ?? item.newState}` : ''}
            </p>
            <p style={{ fontSize: 11, color: 'var(--cr-on-surface-variant)', marginTop: 2 }}>{formatTimeAgo(item.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Team Performance Component
// ---------------------------------------------------------------------------

const TeamPerformance: React.FC<{ data: TeamPerformanceResult | null; loading: boolean }> = ({ data, loading }) => {
  if (loading || !data) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--cr-on-surface-variant)' }}>Loading…</div>;
  }

  const slaColor = data.slaCompliancePct >= 80 ? 'var(--cr-secondary)' : data.slaCompliancePct >= 60 ? '#d97706' : 'var(--cr-error)';

  return (
    <div>
      {/* SLA Compliance */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cr-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>SLA Compliance</span>
          <span style={{ fontFamily: 'var(--cr-font-display)', fontSize: 18, fontWeight: 700, color: slaColor, fontVariantNumeric: 'tabular-nums' }}>{data.slaCompliancePct}%</span>
        </div>
        <div style={{ height: 6, background: 'var(--cr-surface-container)', borderRadius: 9999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${data.slaCompliancePct}%`, background: slaColor, borderRadius: 9999, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Approval Turnaround */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cr-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Approval Turnaround</span>
          <span style={{ fontFamily: 'var(--cr-font-display)', fontSize: 18, fontWeight: 700, color: 'var(--cr-on-surface)', fontVariantNumeric: 'tabular-nums' }}>
            {data.avgApprovalTurnaroundDays != null ? `${data.avgApprovalTurnaroundDays}d` : '—'}
          </span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--cr-on-surface-variant)' }}>{data.totalDecisions} decisions</p>
      </div>

      {/* Bottleneck */}
      {data.bottleneckStage && (
        <div style={{ background: 'var(--cr-surface-container)', borderRadius: 'var(--cr-radius)', padding: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--cr-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            Queue Bottlenecks
          </p>
          <p style={{ fontSize: 13, color: 'var(--cr-on-surface)' }}>
            <strong>{STATE_LABELS[data.bottleneckStage.state] ?? data.bottleneckStage.state}</strong> is currently{' '}
            <span style={{ color: 'var(--cr-error)', fontWeight: 600 }}>{data.bottleneckStage.pctSlowerThanAvg}% slower</span>
            {' '}than hub average ({data.bottleneckStage.avgDays}d avg)
          </p>
        </div>
      )}

      {!data.bottleneckStage && (
        <div style={{ background: 'var(--cr-surface-container)', borderRadius: 'var(--cr-radius)', padding: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--cr-on-surface-variant)' }}>No bottlenecks detected</p>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const CreditDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [workQueue, setWorkQueue] = useState<WorkQueueResult | null>(null);
  const [alerts, setAlerts] = useState<DashboardAlerts | null>(null);
  const [activity, setActivity] = useState<ActivityFeedResult | null>(null);
  const [teamPerf, setTeamPerf] = useState<TeamPerformanceResult | null>(null);
  const [pipeline, setPipeline] = useState<PipelineDashboard | null>(null);
  const [myWork, setMyWork] = useState<MyWorkDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState<string>('');

  useEffect(() => {
    branchApi.list().then(setBranches).catch(() => {});
  }, []);

  const fetchAll = useCallback(() => {
    setLoading(true);
    setError(null);

    const branchParam = branchFilter ? { branchId: branchFilter } : undefined;

    Promise.all([
      dashboardApi.getWorkQueue(branchParam),
      dashboardApi.getAlerts(branchParam),
      dashboardApi.getActivityFeed({ ...branchParam, limit: 20 }),
      dashboardApi.getTeamPerformance(branchParam),
      dashboardApi.getPipelineDashboard(branchParam),
      dashboardApi.getMyWork(branchParam),
    ])
      .then(([wqRes, alertsRes, actRes, tpRes, pipeRes, workRes]: any[]) => {
        setWorkQueue(wqRes.data?.data ?? wqRes.data ?? wqRes);
        setAlerts(alertsRes.data?.data ?? alertsRes.data ?? alertsRes);
        setActivity(actRes.data?.data ?? actRes.data ?? actRes);
        setTeamPerf(tpRes.data?.data ?? tpRes.data ?? tpRes);
        setPipeline(pipeRes.data?.data ?? pipeRes.data ?? pipeRes);
        setMyWork(workRes.data?.data ?? workRes.data ?? workRes);
      })
      .catch((err: any) => {
        console.error(err);
        toast.error(friendlyMessage(err, 'Failed to load dashboard'));
        setError(err.message ?? 'Failed to load dashboard');
      })
      .finally(() => setLoading(false));
  }, [branchFilter]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="credit-module" style={{ padding: '24px 32px 64px' }}>
        <div style={{ height: 32, background: 'var(--cr-surface-container)', borderRadius: 'var(--cr-radius)', marginBottom: 24, width: 280 }} />
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ flex: 1, height: 100, background: 'var(--cr-surface-container)', borderRadius: 'var(--cr-radius-lg)' }} />
          ))}
        </div>
        <div style={{ height: 80, background: 'var(--cr-surface-container)', borderRadius: 'var(--cr-radius-lg)', marginBottom: 24 }} />
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 2, height: 300, background: 'var(--cr-surface-container)', borderRadius: 'var(--cr-radius-lg)' }} />
          <div style={{ flex: 1, height: 300, background: 'var(--cr-surface-container)', borderRadius: 'var(--cr-radius-lg)' }} />
            </div>
      </div>
    );
  }

  // ── Error state ──
  if (error && !workQueue) {
    return (
      <div className="credit-module" style={{ padding: '24px 32px 64px' }}>
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--cr-on-surface-variant)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--cr-error)', marginBottom: 16 }}>error</span>
          <p style={{ fontSize: 16, marginBottom: 8 }}>{error}</p>
          <button
            onClick={fetchAll}
            style={{
              fontFamily: 'var(--cr-font-display)',
              fontSize: 13,
              fontWeight: 600,
              background: 'var(--cr-on-surface)',
              color: 'var(--cr-surface-container-lowest)',
              border: 'none',
              borderRadius: 'var(--cr-radius)',
              padding: '8px 20px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const buckets = workQueue?.buckets ?? [];
  const findBucket = (key: string) => buckets.find(b => b.key === key);
  const myAssigned = myWork?.recentAssigned ?? [];

  return (
    <div className="credit-module" style={{ padding: '24px 32px 64px' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--cr-font-display, Geist, sans-serif)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--cr-on-surface)', marginBottom: 4 }}>
            Credit Assessment Dashboard
          </h1>
          <p style={{ fontSize: 13, color: 'var(--cr-on-surface-variant)' }}>
            {new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
            {branchFilter && branches.find(b => b.id === branchFilter) ? ` · ${branches.find(b => b.id === branchFilter)!.name}` : ' · All Branches'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {branches.length > 0 && (
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              style={{
                fontFamily: 'var(--cr-font-body)',
                fontSize: 13,
                padding: '8px 12px',
                border: '1px solid var(--cr-outline-variant)',
                borderRadius: 'var(--cr-radius)',
                background: 'var(--cr-surface-container-lowest)',
                color: 'var(--cr-on-surface)',
                cursor: 'pointer',
              }}
            >
              <option value="">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => navigate('/credit/applications/new')}
            style={{
              fontFamily: 'var(--cr-font-display)',
              fontSize: 13,
              fontWeight: 600,
              background: 'var(--cr-on-surface)',
              color: 'var(--cr-surface-container-lowest)',
              border: 'none',
              borderRadius: 'var(--cr-radius)',
              padding: '8px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            New Application
          </button>
        </div>
      </div>

      {/* ── KPI Cards Row ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {(['pendingReview', 'inProgress', 'pendingDocs', 'returned', 'overdue', 'pendingApproval'] as const).map(key => {
          const bucket = findBucket(key) ?? { key, label: key, count: 0, slaCompliancePct: null, states: [] };
          return <KpiCard key={key} bucket={bucket} isCritical={key === 'overdue'} />;
        })}
      </div>

      {/* ── Pipeline Funnel ── */}
      <div
        style={{
          background: 'var(--cr-surface-container-lowest)',
          border: '1px solid var(--cr-outline-variant)',
          borderRadius: 'var(--cr-radius-lg, 0.5rem)',
          padding: 20,
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--cr-font-display)', fontSize: 14, fontWeight: 600, color: 'var(--cr-on-surface)' }}>
            Application Pipeline
          </h2>
          <span style={{ fontSize: 12, color: 'var(--cr-on-surface-variant)' }}>{pipeline?.totalApplications ?? 0} total</span>
        </div>
        <PipelineFunnel pipeline={pipeline} />
      </div>

      {/* ── Split Section: Left (table + alerts) / Right (team perf + activity) ── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* Left column — 2/3 width */}
        <div style={{ flex: '2 1 600px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* My Assigned Applications Table */}
          <div
            style={{
              background: 'var(--cr-surface-container-lowest)',
              border: '1px solid var(--cr-outline-variant)',
              borderRadius: 'var(--cr-radius-lg, 0.5rem)',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--cr-outline-variant)' }}>
              <h2 style={{ fontFamily: 'var(--cr-font-display)', fontSize: 14, fontWeight: 600, color: 'var(--cr-on-surface)' }}>
                My Assigned Applications
              </h2>
              <Link to="/credit/applications?assignedToMe=true" style={{ fontSize: 12, fontWeight: 600, color: 'var(--cr-secondary)', textDecoration: 'none' }}>
                View All
              </Link>
            </div>

            {myAssigned.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--cr-on-surface-variant)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--cr-outline-variant)', marginBottom: 8 }}>inbox</span>
                <p style={{ fontSize: 13 }}>No applications assigned to you</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--cr-surface-container-low)' }}>
                      {['App ID', 'Borrower', 'Product', 'Amount', 'Status', 'SLA', 'Priority', ''].map(h => (
                        <th
                          key={h}
                          style={{
                            textAlign: h === 'Amount' ? 'right' : 'left',
                            padding: '8px 12px',
                            fontFamily: 'var(--cr-font-display)',
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            color: 'var(--cr-on-surface-variant)',
                            borderBottom: '1px solid var(--cr-outline-variant)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {myAssigned.map((app, i) => {
                      const slaCol = SLA_STATUS_COLORS[app.slaStatus] ?? SLA_STATUS_COLORS.OK;
                      const prioCol = PRIORITY_COLORS[app.priority] ?? PRIORITY_COLORS.LOW;
                      return (
                        <tr
                          key={app.id}
                          onClick={() => navigate(`/credit/applications/${app.id}`)}
                          style={{
                            cursor: 'pointer',
                            background: i % 2 === 1 ? 'var(--cr-surface-container-low)' : 'transparent',
                            borderBottom: '1px solid var(--cr-outline-variant)',
                          }}
                        >
                          <td style={{ padding: '8px 12px', fontFamily: 'var(--cr-font-display)', fontWeight: 600, color: 'var(--cr-secondary)', whiteSpace: 'nowrap' }}>
                            {app.applicationNo}
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--cr-on-surface)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                            {app.borrowerName}
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--cr-on-surface-variant)', whiteSpace: 'nowrap' }}>
                            {app.productType}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--cr-on-surface)', whiteSpace: 'nowrap' }}>
                            {formatMYR(app.requestedAmount)}
                          </td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                            <span
                              className="cr-status-pill"
                              style={{ background: slaCol.bg, color: slaCol.text }}
                            >
                              {STATE_LABELS[app.state] ?? app.state}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', fontSize: 12, color: slaCol.text, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                            {formatSlaRemaining(app.slaRemainingHours)}
                          </td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: prioCol.dot }} />
                              <span style={{ fontSize: 12, color: prioCol.text, fontWeight: 600 }}>{app.priority}</span>
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--cr-on-surface-variant)' }}>chevron_right</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Alert Tiles */}
          <div style={{ display: 'flex', gap: 12 }}>
            {alerts && (
              <>
                <AlertTile
                  title="High DSR"
                  icon="trending_up"
                  count={alerts.highDsr.count}
                  description={`cases exceeding ${alerts.highDsr.thresholdPct}% DSR threshold. Manual override required.`}
                  actionLabel="View Cases"
                  filterUrl={alerts.highDsr.filterUrl}
                  variant="danger"
                />
                <AlertTile
                  title="Expired Bureau"
                  icon="schedule"
                  count={alerts.expiredBureau.count}
                  description={`bureau reports older than ${alerts.expiredBureau.maxAgeDays} days need refresh.`}
                  actionLabel="Refresh All"
                  filterUrl={alerts.expiredBureau.filterUrl}
                  variant="warning"
                />
                <AlertTile
                  title="AML Review"
                  icon="shield"
                  count={alerts.amlReview.count}
                  description="high-risk matches detected in AML screening."
                  actionLabel="Open AML Case"
                  filterUrl={alerts.amlReview.filterUrl}
                  variant="info"
                />
              </>
            )}
          </div>
        </div>

        {/* Right column — 1/3 width */}
        <div style={{ flex: '1 1 320px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Team Performance */}
          <div
            style={{
              background: 'var(--cr-surface-container-lowest)',
              border: '1px solid var(--cr-outline-variant)',
              borderRadius: 'var(--cr-radius-lg, 0.5rem)',
              padding: 20,
            }}
          >
            <h2 style={{ fontFamily: 'var(--cr-font-display)', fontSize: 14, fontWeight: 600, color: 'var(--cr-on-surface)', marginBottom: 16 }}>
              Team Performance
            </h2>
            <TeamPerformance data={teamPerf} loading={false} />
          </div>

          {/* Recent Activities */}
          <div
            style={{
              background: 'var(--cr-surface-container-lowest)',
              border: '1px solid var(--cr-outline-variant)',
              borderRadius: 'var(--cr-radius-lg, 0.5rem)',
              padding: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--cr-font-display)', fontSize: 14, fontWeight: 600, color: 'var(--cr-on-surface)' }}>
                Recent Activities
              </h2>
              <Link to="/credit/audit" style={{ fontSize: 12, fontWeight: 600, color: 'var(--cr-secondary)', textDecoration: 'none' }}>
                View Audit Log
              </Link>
            </div>
            <ActivityTimeline items={activity?.items ?? []} loading={false} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditDashboard;