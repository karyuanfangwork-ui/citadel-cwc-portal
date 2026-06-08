import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardApi, branchApi, Branch, ExposureSummary, SlaBreachItem, MyWorkDashboard } from '../../src/services/credit.service';
import CreditNav from '../../src/components/CreditNav';
import SlaBreachWidget from '../../src/components/credit/SlaBreachWidget';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../src/utils/errorMessages';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PipelineStateCount {
  state: string;
  count: number;
  avgDaysInState: number;
}

interface PipelineDashboard {
  states: PipelineStateCount[];
  totalApplications: number;
  slaBreachCount: number;
  slaBreaches: SlaBreachItem[];
}

interface ApprovalInboxItem {
  applicationId: string;
  applicationNo: string;
  borrowerName: string;
  productType: string;
  requestedAmount: number;
  currency: string;
  currentState: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  submittedAt: string | null;
  daysWaiting: number;
}

interface ApprovalInbox {
  high: ApprovalInboxItem[];
  medium: ApprovalInboxItem[];
  low: ApprovalInboxItem[];
  totalPending: number;
}

interface ExposureByBorrower {
  borrowerProfileId: string;
  borrowerName: string;
  industry: string | null;
  totalExposure: number;
  rating: string | null;
}

interface SectorBreakdown {
  sector: string;
  totalExposure: number;
  count: number;
}

interface RatingDistribution {
  rating: string;
  count: number;
  totalExposure: number;
}

interface ExposureDashboard {
  topBorrowers: ExposureByBorrower[];
  sectorBreakdown: SectorBreakdown[];
  ratingDistribution: RatingDistribution[];
  totalPortfolio: number;
}

interface CommitteeCalendarItem {
  meetingId: string;
  title: string;
  scheduledAt: string;
  location: string | null;
  status: string;
  meetingType: string;
  agendaCount: number;
}

interface CommitteeCalendar {
  meetings: CommitteeCalendarItem[];
  totalUpcoming: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatCurrency = (val: number | null) =>
  val != null
    ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val)
    : '—';

const URGENCY_COLORS: Record<string, { bg: string; text: string }> = {
  HIGH: { bg: '#fef2f2', text: '#dc2626' },
  MEDIUM: { bg: '#fffbeb', text: '#d97706' },
  LOW: { bg: '#f0fdf4', text: '#16a34a' },
};

const STATE_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  KYC_REVIEW: 'KYC Review',
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
};

const RATING_ORDER = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D', 'NR'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type TabKey = 'myWork' | 'pipeline' | 'approval' | 'exposure' | 'calendar';

const CreditDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('myWork');
  const [pipeline, setPipeline] = useState<PipelineDashboard | null>(null);
  const [approvalInbox, setApprovalInbox] = useState<ApprovalInbox | null>(null);
  const [exposure, setExposure] = useState<ExposureDashboard | null>(null);
  const [exposureSummary, setExposureSummary] = useState<ExposureSummary | null>(null);
  const [calendar, setCalendar] = useState<CommitteeCalendar | null>(null);
  const [myWork, setMyWork] = useState<MyWorkDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // §3.1 — Multi-branch support: branch filter dropdown (visible to Admin)
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState<string>('');

  useEffect(() => {
    branchApi.list().then(setBranches).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (activeTab === 'myWork') {
      dashboardApi.getMyWork(branchFilter ? { branchId: branchFilter } : undefined)
        .then((res: any) => {
          const payload = res.data?.data ?? res.data ?? res;
          setMyWork(payload);
        })
        .catch((err: any) => {
          console.error(err);
          toast.error(friendlyMessage(err, 'Failed to load My Work data'));
          setError(err.message ?? 'Failed to load My Work data');
        })
        .finally(() => setLoading(false));
      return;
    }

    if (activeTab === 'exposure') {
      Promise.all([
        dashboardApi.getExposureDashboard(branchFilter ? { branchId: branchFilter } : undefined),
        dashboardApi.getExposureSummary(),
      ])
        .then(([dashboard, summary]: any[]) => {
          setExposure(dashboard.data?.data ?? dashboard.data ?? dashboard);
          setExposureSummary(summary);
        })
        .catch((err: any) => {
          console.error(err);
          toast.error(friendlyMessage(err, 'Failed to load exposure data'));
          setError(err.message ?? 'Failed to load exposure data');
        })
        .finally(() => setLoading(false));
      return;
    }

    const fetcher =
      activeTab === 'pipeline'
        ? () => dashboardApi.getPipelineDashboard(branchFilter ? { branchId: branchFilter } : undefined)
        : activeTab === 'approval'
          ? () => dashboardApi.getApprovalInbox()
          : () => dashboardApi.getCommitteeCalendar();

    fetcher()
      .then((res: any) => {
        const payload = res.data?.data ?? res.data ?? res;
        if (activeTab === 'pipeline') setPipeline(payload);
        else if (activeTab === 'approval') setApprovalInbox(payload);
        else setCalendar(payload);
      })
      .catch((err: any) => {
        console.error(err);
        toast.error(friendlyMessage(err, 'Failed to load dashboard data'));
        setError(err.message ?? 'Failed to load dashboard data');
      })
      .finally(() => setLoading(false));
  }, [activeTab, branchFilter]);

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'myWork', label: 'My Work', icon: 'assignment_ind' },
    { key: 'pipeline', label: 'Pipeline', icon: 'water' },
    { key: 'approval', label: 'Approval Inbox', icon: 'approval' },
    { key: 'exposure', label: 'Exposure', icon: 'account_balance_wallet' },
    { key: 'calendar', label: 'Committee Calendar', icon: 'calendar_month' },
  ];

  return (
    <>
      <CreditNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-2xl font-black text-text-primary">Credit Dashboard</h1>
          <div className="flex items-center gap-3 flex-wrap">
            {/* §3.1 — Branch filter */}
            {branches.length > 0 && (
              <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
                aria-label="Filter dashboard by branch"
                className="px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary outline-none cursor-pointer" style={{ fontFamily: 'var(--font-sans)' }}>
                <option value="">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
              </select>
            )}
            {/* §8.4 — New Application CTA */}
            <button
              type="button"
              onClick={() => navigate('/credit/applications/new')}
              className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors cursor-pointer border-none"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              New Application
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-surface-muted rounded-xl p-1 mb-6 overflow-x-auto" role="tablist">
          {tabs.map(tab => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'bg-bg-surface text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading && <p className="text-sm text-text-secondary">Loading...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && activeTab === 'myWork' && myWork && (
          <MyWorkSection data={myWork} />
        )}
        {!loading && !error && activeTab === 'pipeline' && pipeline && (
          <PipelineSection data={pipeline} />
        )}
        {!loading && !error && activeTab === 'approval' && approvalInbox && (
          <ApprovalInboxSection data={approvalInbox} />
        )}
        {!loading && !error && activeTab === 'exposure' && exposure && (
          <ExposureSection data={exposure} summary={exposureSummary} />
        )}
        {!loading && !error && activeTab === 'calendar' && calendar && (
          <CalendarSection data={calendar} />
        )}
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// My Work Section
// ---------------------------------------------------------------------------

const MyWorkSection: React.FC<{ data: MyWorkDashboard }> = ({ data }) => {
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/credit/dashboard" onClick={() => {}} className="bg-amber-50 border border-amber-200 rounded-xl p-5 hover:shadow-sm transition-shadow cursor-pointer">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-amber-600">approval</span>
            <div>
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Pending Approvals</p>
              <p className="text-2xl font-black text-amber-700">{data.myApprovalCount}</p>
            </div>
          </div>
        </Link>
        <Link to="/credit/dashboard" onClick={() => {}} className="bg-blue-50 border border-blue-200 rounded-xl p-5 hover:shadow-sm transition-shadow cursor-pointer">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-blue-600">assignment_ind</span>
            <div>
              <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">My Cases</p>
              <p className="text-2xl font-black text-blue-700">{data.myAssignedCount}</p>
            </div>
          </div>
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-red-600">schedule</span>
            <div>
              <p className="text-xs font-bold text-red-800 uppercase tracking-wider">SLA Breaches</p>
              <p className="text-2xl font-black text-red-700">{data.mySlaBreaches}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Assigned Cases */}
      {data.recentAssigned.length > 0 && (
        <div className="bg-bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">My Recent Cases</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-2 py-2 text-xs font-bold text-text-secondary uppercase tracking-wider">App No</th>
                  <th className="text-left px-2 py-2 text-xs font-bold text-text-secondary uppercase tracking-wider">Borrower</th>
                  <th className="text-left px-2 py-2 text-xs font-bold text-text-secondary uppercase tracking-wider">State</th>
                  <th className="text-left px-2 py-2 text-xs font-bold text-text-secondary uppercase tracking-wider">Product</th>
                  <th className="text-right px-2 py-2 text-xs font-bold text-text-secondary uppercase tracking-wider">Updated</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.recentAssigned.map(item => (
                  <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface-muted transition-colors">
                    <td className="px-2 py-2 font-semibold text-text-primary">{item.applicationNo || '—'}</td>
                    <td className="px-2 py-2 text-text-secondary">{item.borrowerName}</td>
                    <td className="px-2 py-2">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700">
                        {STATE_LABELS[item.state] ?? item.state}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-text-secondary">{item.productType || '—'}</td>
                    <td className="px-2 py-2 text-right text-xs text-text-secondary">
                      {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Link to={`/credit/applications/${item.id}`} className="text-brand-700 text-xs font-bold hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Approvals */}
      {data.recentApprovals.length > 0 && (
        <div className="bg-bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Pending Approvals</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-2 py-2 text-xs font-bold text-text-secondary uppercase tracking-wider">App No</th>
                  <th className="text-left px-2 py-2 text-xs font-bold text-text-secondary uppercase tracking-wider">Borrower</th>
                  <th className="text-left px-2 py-2 text-xs font-bold text-text-secondary uppercase tracking-wider">State</th>
                  <th className="text-left px-2 py-2 text-xs font-bold text-text-secondary uppercase tracking-wider">Product</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.recentApprovals.map(item => (
                  <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface-muted transition-colors">
                    <td className="px-2 py-2 font-semibold text-text-primary">{item.applicationNo || '—'}</td>
                    <td className="px-2 py-2 text-text-secondary">{item.borrowerName}</td>
                    <td className="px-2 py-2">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700">
                        {STATE_LABELS[item.state] ?? item.state}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-text-secondary">{item.productType || '—'}</td>
                    <td className="px-2 py-2 text-right">
                      <Link to={`/credit/applications/${item.id}`} className="text-brand-700 text-xs font-bold hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* My SLA Breaches */}
      {data.mySlaBreachItems.length > 0 && (
        <SlaBreachWidget
          breaches={data.mySlaBreachItems}
          totalCount={data.mySlaBreaches}
          filterMode="mine"
        />
      )}

      {/* Empty state */}
      {data.myApprovalCount === 0 && data.myAssignedCount === 0 && data.mySlaBreaches === 0 && (
        <div className="bg-bg-surface border border-border rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-4xl text-text-secondary mb-2">check_circle</span>
          <p className="text-sm text-text-secondary">No pending work items. You're all caught up!</p>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Pipeline Section
// ---------------------------------------------------------------------------

const PipelineSection: React.FC<{ data: PipelineDashboard }> = ({ data }) => {
  const maxCount = Math.max(...data.states.map(s => s.count), 1);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-bg-surface border border-border rounded-xl p-5">
          <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Total Applications</p>
          <p className="text-2xl font-black text-text-primary">{data.totalApplications}</p>
        </div>
        <div className="bg-bg-surface border border-border rounded-xl p-5">
          <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Active States</p>
          <p className="text-2xl font-black text-text-primary">{data.states.filter(s => s.count > 0).length}</p>
        </div>
      </div>

      {/* SLA Breach Widget */}
      <SlaBreachWidget
        breaches={data.slaBreaches ?? []}
        totalCount={data.slaBreachCount}
        filterMode="all"
      />

      {/* Bar chart */}
      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Applications by State</h3>
        <div className="space-y-2">
          {data.states
            .filter(s => s.count > 0)
            .sort((a, b) => b.count - a.count)
            .map(s => (
              <div key={s.state} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-text-secondary w-36 truncate" title={STATE_LABELS[s.state] ?? s.state}>
                  {STATE_LABELS[s.state] ?? s.state}
                </span>
                <div className="flex-1 h-6 bg-surface-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-700 rounded-full transition-all"
                    style={{ width: `${(s.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-text-primary w-8 text-right">{s.count}</span>
                <span className="text-xs text-text-secondary w-20 text-right">{s.avgDaysInState}d avg</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Approval Inbox Section
// ---------------------------------------------------------------------------

const ApprovalInboxSection: React.FC<{ data: ApprovalInbox }> = ({ data }) => {
  const allItems = [...data.high, ...data.medium, ...data.low];

  return (
    <div className="space-y-6">
      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Pending Approvals</p>
        <p className="text-2xl font-black text-text-primary">{data.totalPending}</p>
      </div>

      {allItems.length === 0 ? (
        <div className="bg-bg-surface border border-border rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-4xl text-text-secondary mb-2">check_circle</span>
          <p className="text-sm text-text-secondary">No pending approvals.</p>
        </div>
      ) : (
        <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted">
                <th className="text-left px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-wider">Urgency</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-wider">Borrower</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-wider">Product</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-wider">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-wider">State</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-wider">Waiting</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {allItems.map(item => (
                <tr key={item.applicationId} className="border-b border-border last:border-0 hover:bg-surface-muted transition-colors">
                  <td className="px-4 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{
                        backgroundColor: URGENCY_COLORS[item.urgency]?.bg ?? '#f5f5f5',
                        color: URGENCY_COLORS[item.urgency]?.text ?? '#666',
                      }}
                    >
                      {item.urgency}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-text-primary">{item.borrowerName}</td>
                  <td className="px-4 py-3 text-text-secondary">{item.productType}</td>
                  <td className="px-4 py-3 text-right font-semibold text-text-primary">{formatCurrency(item.requestedAmount)}</td>
                  <td className="px-4 py-3 text-text-secondary">{STATE_LABELS[item.currentState] ?? item.currentState}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold ${item.daysWaiting >= 5 ? 'text-red-600' : item.daysWaiting >= 3 ? 'text-amber-600' : 'text-green-600'}`}>
                      {item.daysWaiting}d
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/credit/applications/${item.applicationId}`}
                      className="text-brand-700 text-xs font-bold hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Exposure Section
// ---------------------------------------------------------------------------

const ExposureSection: React.FC<{ data: ExposureDashboard; summary?: ExposureSummary | null }> = ({ data, summary }) => {
  const maxExposure = Math.max(...data.topBorrowers.map(b => b.totalExposure), 1);

  return (
    <div className="space-y-6">
      {/* Total portfolio */}
      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Total Portfolio Exposure</p>
        <p className="text-2xl font-black text-text-primary">{formatCurrency(summary?.totalPortfolioExposure ?? data.totalPortfolio)}</p>
      </div>

      {/* §2.6 — Exposure Limit Alerts */}
      {summary && (summary.approachingLimit.length > 0 || summary.breachedLimit.length > 0) && (
        <div className="space-y-3">
          {summary.breachedLimit.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-red-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600">error</span>
                Limit Breached ({summary.breachedLimit.length})
              </h3>
              <div className="space-y-2">
                {summary.breachedLimit.map(b => (
                  <Link key={b.borrowerProfileId} to={`/credit/borrowers/${b.borrowerProfileId}`}
                    className="flex items-center justify-between bg-white rounded-lg px-3 py-2 hover:shadow-sm transition-shadow">
                    <span className="text-sm font-semibold text-red-900">{b.borrowerName}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-red-700">{formatCurrency(b.totalExposure)} / {formatCurrency(b.exposureLimit)}</span>
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white">{b.utilisationPct}%</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {summary.approachingLimit.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">warning</span>
                Approaching Limit ({summary.approachingLimit.length})
              </h3>
              <div className="space-y-2">
                {summary.approachingLimit.map(b => (
                  <Link key={b.borrowerProfileId} to={`/credit/borrowers/${b.borrowerProfileId}`}
                    className="flex items-center justify-between bg-white rounded-lg px-3 py-2 hover:shadow-sm transition-shadow">
                    <span className="text-sm font-semibold text-amber-900">{b.borrowerName}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-amber-700">{formatCurrency(b.totalExposure)} / {formatCurrency(b.exposureLimit)}</span>
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500 text-white">{b.utilisationPct}%</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top borrowers */}
      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Top Borrowers by Exposure</h3>
        <div className="space-y-2">
          {data.topBorrowers.length === 0 && (
            <p className="text-sm text-text-secondary">No exposure data available.</p>
          )}
          {data.topBorrowers.map(b => (
            <div key={b.borrowerProfileId} className="flex items-center gap-3">
              <span className="text-xs font-semibold text-text-secondary w-36 truncate" title={b.borrowerName}>
                {b.borrowerName}
              </span>
              <div className="flex-1 h-5 bg-surface-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${(b.totalExposure / maxExposure) * 100}%` }}
                />
              </div>
              <span className="text-xs font-bold text-text-primary w-28 text-right">{formatCurrency(b.totalExposure)}</span>
              <span className="text-xs text-text-secondary w-8 text-center">{b.rating ?? 'NR'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sector breakdown */}
      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Sector Breakdown</h3>
        {data.sectorBreakdown.length === 0 ? (
          <p className="text-sm text-text-secondary">No sector data available.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-2 py-2 text-xs font-bold text-text-secondary uppercase tracking-wider">Sector</th>
                <th className="text-right px-2 py-2 text-xs font-bold text-text-secondary uppercase tracking-wider">Exposure</th>
                <th className="text-right px-2 py-2 text-xs font-bold text-text-secondary uppercase tracking-wider"># Borrowers</th>
              </tr>
            </thead>
            <tbody>
              {data.sectorBreakdown.map(s => (
                <tr key={s.sector} className="border-b border-border last:border-0">
                  <td className="px-2 py-2 font-semibold text-text-primary">{s.sector}</td>
                  <td className="px-2 py-2 text-right font-semibold">{formatCurrency(s.totalExposure)}</td>
                  <td className="px-2 py-2 text-right text-text-secondary">{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Rating distribution */}
      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Rating Distribution</h3>
        {data.ratingDistribution.length === 0 ? (
          <p className="text-sm text-text-secondary">No rating data available.</p>
        ) : (
          <div className="flex items-end gap-2 h-32">
            {RATING_ORDER.filter(r => data.ratingDistribution.some(d => d.rating === r))
              .map(rating => {
                const d = data.ratingDistribution.find(d => d.rating === rating)!;
                const maxCount = Math.max(...data.ratingDistribution.map(d => d.count), 1);
                const heightPct = (d.count / maxCount) * 100;
                const colorMap: Record<string, string> = {
                  AAA: '#16a34a', AA: '#22c55e', A: '#4ade80',
                  BBB: '#facc15', BB: '#f59e0b', B: '#f97316',
                  CCC: '#ef4444', CC: '#dc2626', C: '#b91c1c',
                  D: '#7f1d1d', NR: '#9ca3af',
                };
                return (
                  <div key={rating} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-bold text-text-primary">{d.count}</span>
                    <div
                      className="w-full rounded-t transition-all"
                      style={{
                        height: `${heightPct}%`,
                        backgroundColor: colorMap[rating] ?? '#6b7280',
                        minHeight: d.count > 0 ? '4px' : '0',
                      }}
                    />
                    <span className="text-xs font-bold text-text-secondary">{rating}</span>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* §2.6 — Product Type Breakdown */}
      {summary && Object.keys(summary.byProductType).length > 0 && (
        <div className="bg-bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Exposure by Product Type</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-2 py-2 text-xs font-bold text-text-secondary uppercase tracking-wider">Product Type</th>
                <th className="text-right px-2 py-2 text-xs font-bold text-text-secondary uppercase tracking-wider">Exposure</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(summary.byProductType)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([type, amount]) => (
                  <tr key={type} className="border-b border-border last:border-0">
                    <td className="px-2 py-2 font-semibold text-text-primary">{type}</td>
                    <td className="px-2 py-2 text-right font-semibold">{formatCurrency(amount as number)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Committee Calendar Section
// ---------------------------------------------------------------------------

const CalendarSection: React.FC<{ data: CommitteeCalendar }> = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Upcoming Meetings</p>
        <p className="text-2xl font-black text-text-primary">{data.totalUpcoming}</p>
      </div>

      {data.meetings.length === 0 ? (
        <div className="bg-bg-surface border border-border rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-4xl text-text-secondary mb-2">event_busy</span>
          <p className="text-sm text-text-secondary">No upcoming committee meetings.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.meetings.map(m => (
            <div key={m.meetingId} className="bg-bg-surface border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-brand-700/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-brand-700">calendar_month</span>
              </div>
              <div className="flex-1 min-w-0">
                <Link to={`/credit/committee`} className="text-sm font-bold text-text-primary hover:text-brand-700">
                  {m.title}
                </Link>
                <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                  <span>{new Date(m.scheduledAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <span>{new Date(m.scheduledAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                  {m.location && <span>{m.location}</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                  m.status === 'IN_PROGRESS' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {m.status === 'IN_PROGRESS' ? 'In Progress' : 'Scheduled'}
                </span>
                <p className="text-xs text-text-secondary mt-1">{m.agendaCount} agenda item{m.agendaCount !== 1 ? 's' : ''}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CreditDashboard;