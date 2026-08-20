import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, branchApi, Branch, type ApprovalDecision, type PipelineDashboard } from '../../src/services/credit.service';
import type { ApprovalInbox } from '../../src/services/credit.types';
import type { ApprovalDecisionInput } from '../../src/components/credit/approvalDecision';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../src/utils/errorMessages';
import { useAuth } from '../../src/context/AuthContext';
import { hasPermission } from '../../src/utils/permissions';
import AttentionStrip from '../../src/components/credit/dashboard/AttentionStrip';
import { useCreditLane } from '../../src/components/credit/dashboard/useCreditLane';
import LaneSwitcher from '../../src/components/credit/dashboard/LaneSwitcher';
import RmLane from '../../src/components/credit/dashboard/RmLane';
import ApproverLane from '../../src/components/credit/dashboard/ApproverLane';
import ManagerLane from '../../src/components/credit/dashboard/ManagerLane';

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
  oldState: string | null;
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

interface SlaBreachItem {
  id: string;
  applicationId: string;
  applicationNo: string;
  borrowerName: string;
  currentState: string;
  breachedAt: string;
  daysOverdue: number;
  policyName: string;
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
  blocker: string;
  currentTask: string;
  nextAction: { label: string; route: string };
}

interface MyWorkDashboard {
  myApprovalCount: number;
  myAssignedCount: number;
  mySlaBreaches: number;
  mySlaBreachItems: SlaBreachItem[];
  recentAssigned: MyWorkItem[];
  recentApprovals: MyWorkItem[];
  attention: { overdue: number; dueSoon: number; informationRequired: number; returned: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatMYR = (val: number | null | undefined) =>
  val != null
    ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val)
    : '—';

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const CreditDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = hasPermission(user, 'credit:create');
  const canAdminister = hasPermission(user, 'credit:admin');
  const { lane, lanes, setLane } = useCreditLane(user);
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
  const [approvalInbox, setApprovalInbox] = useState<ApprovalInbox | null>(null);
  const [quickFilter, setQuickFilter] = useState<keyof MyWorkDashboard['attention'] | null>(null);

  useEffect(() => {
    branchApi.list().then(setBranches).catch(() => {});
  }, []);

  useEffect(() => {
    if (lane !== 'approver') {
      setApprovalInbox(null);
      return;
    }
    dashboardApi.getApprovalInbox()
      .then(response => setApprovalInbox(response.data.data))
      .catch(err => {
        toast.error(friendlyMessage(err, 'Failed to load approval inbox'));
        setApprovalInbox({ high: [], medium: [], low: [], totalPending: 0, excluded: [] });
      });
  }, [lane]);

  const handleDecision = useCallback((applicationId: string, _decision: ApprovalDecision, _input: ApprovalDecisionInput) => {
    setApprovalInbox(current => current ? {
      ...current,
      high: current.high.filter(item => item.applicationId !== applicationId),
      medium: current.medium.filter(item => item.applicationId !== applicationId),
      low: current.low.filter(item => item.applicationId !== applicationId),
      totalPending: Math.max(0, current.totalPending - 1),
    } : current);
  }, []);

  const fetchAll = useCallback(() => {
    setLoading(true);
    setError(null);

    const branchParam = branchFilter ? { branchId: branchFilter } : undefined;

    Promise.all([
      dashboardApi.getWorkQueue(branchParam),
      dashboardApi.getAlerts(branchParam),
      dashboardApi.getActivityFeed({ ...branchParam, limit: 20 }),
      canAdminister ? dashboardApi.getTeamPerformance(branchParam) : Promise.resolve(null),
      dashboardApi.getPipelineDashboard(branchParam),
      dashboardApi.getMyWork(branchParam),
    ])
      .then(([wqRes, alertsRes, actRes, tpRes, pipeRes, workRes]: any[]) => {
        setWorkQueue(wqRes.data?.data ?? wqRes.data ?? wqRes);
        setAlerts(alertsRes.data?.data ?? alertsRes.data ?? alertsRes);
        setActivity(actRes.data?.data ?? actRes.data ?? actRes);
        setTeamPerf(tpRes ? (tpRes.data?.data ?? tpRes.data ?? tpRes) : null);
        setPipeline(pipeRes.data?.data ?? pipeRes.data ?? pipeRes);
        setMyWork(workRes.data?.data ?? workRes.data ?? workRes);
      })
      .catch((err: any) => {
        console.error(err);
        toast.error(friendlyMessage(err, 'Failed to load dashboard'));
        setError(err.message ?? 'Failed to load dashboard');
      })
      .finally(() => setLoading(false));
  }, [branchFilter, canAdminister]);

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

  const myAssigned = myWork?.recentAssigned ?? [];
  const attention = myWork?.attention ?? { overdue: 0, dueSoon: 0, informationRequired: 0, returned: 0 };

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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
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
          <LaneSwitcher lane={lane} lanes={lanes} onChange={setLane} />
          {canCreate && <button
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
          </button>}
        </div>
      </div>

      <AttentionStrip
        attention={attention}
        active={lane === 'rm' ? quickFilter : undefined}
        onSelect={lane === 'rm' ? key => setQuickFilter(current => current === key ? null : key) : undefined}
      />

      {lane === 'rm' && (
        <RmLane
          items={quickFilter ? myAssigned.filter(item => {
            if (quickFilter === 'overdue') return item.slaStatus === 'OVERDUE';
            if (quickFilter === 'dueSoon') return item.slaStatus === 'WARNING';
            if (quickFilter === 'informationRequired') return item.state === 'COMPLIANCE_HOLD';
            return item.state === 'KYC_REJECTED' || item.state === 'REFERRED_BACK';
          }) : myAssigned}
          formatAmount={formatMYR}
        />
      )}
      {lane === 'approver' && approvalInbox && (
        <ApproverLane inbox={approvalInbox} onDecision={handleDecision} formatAmount={formatMYR} />
      )}
      {lane === 'manager' && (
        <ManagerLane
          pipeline={pipeline}
          teamPerf={teamPerf}
          activity={activity?.items ?? []}
          alerts={alerts}
        />
      )}

    </div>
  );
};

export default CreditDashboard;
