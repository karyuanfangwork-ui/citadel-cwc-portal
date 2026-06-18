import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardApi, branchApi, Branch, ExposureSummary, SlaBreachItem, MyWorkDashboard } from '../../src/services/credit.service';
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
      Promise.all([
        dashboardApi.getMyWork(branchFilter ? { branchId: branchFilter } : undefined),
        dashboardApi.getPipelineDashboard(branchFilter ? { branchId: branchFilter } : undefined),
      ])
        .then(([workRes, pipeRes]: any[]) => {
          setMyWork(workRes.data?.data ?? workRes.data ?? workRes);
          setPipeline(pipeRes.data?.data ?? pipeRes.data ?? pipeRes);
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
        dashboardApi.getExposureSummary(branchFilter ? { branchId: branchFilter } : undefined),
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
    <div className="credit-module" style={{ maxWidth: 1680, margin: '0 auto', paddingBottom: 'var(--space-16, 64px)' }}>
      <div className="px-4 sm:px-8 py-4 sm:py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 style={{ fontFamily: 'var(--cr-font-display, Geist, sans-serif)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--cr-on-surface, #191c1e)' }}>Credit Dashboard</h1>
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
              className="flex items-center gap-1.5 text-white font-semibold px-4 py-2 text-sm transition-opacity cursor-pointer border-none"
              style={{ fontFamily: 'var(--cr-font-display, Geist, sans-serif)', background: 'var(--cr-secondary, #0051d5)', borderRadius: 'var(--cr-rounded, 0.25rem)' }}
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              New Application
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 mb-6 overflow-x-auto" role="tablist" style={{ background: 'var(--cr-surface-container, #eceef0)', borderRadius: 'var(--cr-rounded-lg, 0.5rem)' }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold whitespace-nowrap transition-all border-none cursor-pointer ${
                activeTab === tab.key
                  ? 'shadow-sm'
                  : 'hover:opacity-80'
              }`}
              style={{
                fontFamily: 'var(--cr-font-display, Geist, sans-serif)',
                borderRadius: 'var(--cr-rounded, 0.25rem)',
                background: activeTab === tab.key ? 'var(--cr-surface-container-lowest, #ffffff)' : 'transparent',
                color: activeTab === tab.key ? 'var(--cr-on-surface, #191c1e)' : 'var(--cr-on-surface-variant, #45464d)',
              }}
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
          <MyWorkSection data={myWork} pipeline={pipeline} setActiveTab={setActiveTab} />
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
    </div>
  );
};

// ---------------------------------------------------------------------------
// My Work Section
// ---------------------------------------------------------------------------

// Returns inline style for a status pill based on application state
function getStatusPillStyle(state: string): React.CSSProperties {
  const assessmentGroup = ['KYC_REVIEW', 'COMPLIANCE_HOLD', 'KYC_APPROVED', 'UNDERWRITING', 'CREDIT_ASSESSMENT'];
  const pendingGroup = ['OFFER', 'SUBMITTED'];
  const committeeGroup = ['COMMITTEE_REVIEW', 'APPROVED', 'ACCEPTED'];
  const alertGroup = ['KYC_REJECTED', 'REJECTED', 'WITHDRAWN'];

  if (assessmentGroup.includes(state))
    return { background: 'var(--cr-secondary-fixed, #dbe1ff)', color: 'var(--cr-on-secondary-fixed-variant, #003ea8)' };
  if (pendingGroup.includes(state))
    return { background: '#fef3c7', color: '#92400e' };
  if (committeeGroup.includes(state))
    return { background: '#e8f5e9', color: '#1b5e20' };
  if (alertGroup.includes(state))
    return { background: 'var(--cr-error-container, #ffdad6)', color: 'var(--cr-on-error-container, #93000a)' };
  return { background: 'var(--cr-surface-container, #eceef0)', color: 'var(--cr-on-surface-variant, #45464d)' };
}

function getRiskGradeStyle(grade: string | null): { barColor: string; labelColor: string; barWidth: string } {
  if (!grade) return { barColor: 'var(--cr-outline-variant)', labelColor: 'var(--cr-on-surface-variant)', barWidth: '0%' };
  const highRisk = ['CCC', 'CC', 'C', 'D'];
  const medRisk = ['BB', 'B', 'BBB'];
  if (highRisk.includes(grade)) return { barColor: 'var(--cr-error, #ba1a1a)', labelColor: 'var(--cr-error, #ba1a1a)', barWidth: '85%' };
  if (medRisk.includes(grade)) return { barColor: '#d97706', labelColor: '#d97706', barWidth: '55%' };
  return { barColor: '#16a34a', labelColor: '#16a34a', barWidth: '30%' };
}

const MyWorkSection: React.FC<{ data: MyWorkDashboard; pipeline: PipelineDashboard | null; setActiveTab: (tab: TabKey) => void }> = ({ data, pipeline, setActiveTab }) => {
  // Derive pipeline KPIs — sum states for "In Assessment"
  const assessmentStates = ['CREDIT_ASSESSMENT', 'UNDERWRITING', 'KYC_REVIEW', 'COMPLIANCE_HOLD', 'KYC_APPROVED'];
  const inAssessmentCount = pipeline
    ? pipeline.states
        .filter(s => assessmentStates.includes(s.state))
        .reduce((sum, s) => sum + s.count, 0)
    : null;
  const totalActive = pipeline?.totalApplications ?? null;
  const allSlaBreaches = pipeline?.slaBreachCount ?? null;

  return (
    <div className="space-y-6">
      {/* 6-KPI Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* My Cases */}
        <div style={{ background: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg, 0.5rem)', padding: 16 }}>
          <p style={{ fontFamily: 'var(--cr-font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)', marginBottom: 6 }}>My Cases</p>
          <p style={{ fontFamily: 'var(--cr-font-display)', fontSize: 28, fontWeight: 700, color: 'var(--cr-on-surface)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{data.myAssignedCount}</p>
          <p style={{ fontSize: 11, color: 'var(--cr-on-surface-variant)', marginTop: 4 }}>Assigned to me</p>
        </div>

        {/* Pending Approval — blue left border */}
        <div style={{ background: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)', borderLeft: '3px solid var(--cr-secondary, #0051d5)', borderRadius: 'var(--cr-radius-lg, 0.5rem)', padding: 16 }}>
          <p style={{ fontFamily: 'var(--cr-font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)', marginBottom: 6 }}>Pending Approval</p>
          <p style={{ fontFamily: 'var(--cr-font-display)', fontSize: 28, fontWeight: 700, color: 'var(--cr-secondary, #0051d5)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{data.myApprovalCount}</p>
          <p style={{ fontSize: 11, color: 'var(--cr-on-surface-variant)', marginTop: 4 }}>Awaiting decision</p>
        </div>

        {/* SLA Breaches (mine) — red left border */}
        <div style={{ background: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)', borderLeft: '3px solid var(--cr-error, #ba1a1a)', borderRadius: 'var(--cr-radius-lg, 0.5rem)', padding: 16 }}>
          <p style={{ fontFamily: 'var(--cr-font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)', marginBottom: 6 }}>My SLA Breaches</p>
          <p style={{ fontFamily: 'var(--cr-font-display)', fontSize: 28, fontWeight: 700, color: 'var(--cr-error, #ba1a1a)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{data.mySlaBreaches}</p>
          <p style={{ fontSize: 11, color: 'var(--cr-error, #ba1a1a)', marginTop: 4 }}>Overdue</p>
        </div>

        {/* In Assessment — derived from pipeline */}
        <div style={{ background: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg, 0.5rem)', padding: 16 }}>
          <p style={{ fontFamily: 'var(--cr-font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)', marginBottom: 6 }}>In Assessment</p>
          <p style={{ fontFamily: 'var(--cr-font-display)', fontSize: 28, fontWeight: 700, color: 'var(--cr-on-surface)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{inAssessmentCount ?? '—'}</p>
          <p style={{ fontSize: 11, color: 'var(--cr-on-surface-variant)', marginTop: 4 }}>Pipeline stage</p>
        </div>

        {/* Total Active */}
        <div style={{ background: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg, 0.5rem)', padding: 16 }}>
          <p style={{ fontFamily: 'var(--cr-font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)', marginBottom: 6 }}>Total Active</p>
          <p style={{ fontFamily: 'var(--cr-font-display)', fontSize: 28, fontWeight: 700, color: 'var(--cr-on-surface)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{totalActive ?? '—'}</p>
          <p style={{ fontSize: 11, color: 'var(--cr-on-surface-variant)', marginTop: 4 }}>All applications</p>
        </div>

        {/* All SLA Breaches — red left border */}
        <div style={{ background: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)', borderLeft: '3px solid var(--cr-error, #ba1a1a)', borderRadius: 'var(--cr-radius-lg, 0.5rem)', padding: 16 }}>
          <p style={{ fontFamily: 'var(--cr-font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)', marginBottom: 6 }}>All SLA Breaches</p>
          <p style={{ fontFamily: 'var(--cr-font-display)', fontSize: 28, fontWeight: 700, color: 'var(--cr-error, #ba1a1a)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{allSlaBreaches ?? '—'}</p>
          <p style={{ fontSize: 11, color: 'var(--cr-on-surface-variant)', marginTop: 4 }}>Active breaches</p>
        </div>
      </div>

      {/* Recent Assigned Cases */}
      {data.recentAssigned.length > 0 && (
        <div style={{ background: 'var(--cr-surface-container-lowest, #ffffff)', border: '1px solid var(--cr-outline-variant, #c6c6cd)', borderRadius: 'var(--cr-rounded-lg, 0.5rem)', padding: 20 }}>
          <h3 style={{ fontFamily: 'var(--cr-font-display, Geist)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant, #45464d)', marginBottom: 16 }}>My Recent Cases</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-2 py-2" style={{ fontFamily: 'var(--cr-font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)' }}>App No</th>
                  <th className="text-left px-2 py-2" style={{ fontFamily: 'var(--cr-font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)' }}>Borrower</th>
                  <th className="text-left px-2 py-2" style={{ fontFamily: 'var(--cr-font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)' }}>Status</th>
                  <th className="text-left px-2 py-2" style={{ fontFamily: 'var(--cr-font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)' }}>Product</th>
                  <th className="text-right px-2 py-2" style={{ fontFamily: 'var(--cr-font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)' }}>Amount (RM)</th>
                  <th className="text-left px-2 py-2" style={{ fontFamily: 'var(--cr-font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)' }}>Risk Grade</th>
                  <th className="text-left px-2 py-2" style={{ fontFamily: 'var(--cr-font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)' }}>SLA</th>
                  <th className="text-right px-2 py-2" style={{ fontFamily: 'var(--cr-font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)' }}>Updated</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.recentAssigned.map(item => (
                  <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface-muted transition-colors">
                    <td className="px-2 py-2.5">
                      <span style={{ fontFamily: 'var(--cr-font-display)', fontSize: 12, fontWeight: 700, color: 'var(--cr-secondary)', letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums' }}>
                        {item.applicationNo || '—'}
                      </span>
                    </td>
                    <td className="px-2 py-2.5" style={{ fontWeight: 600, fontSize: 13, color: 'var(--cr-on-surface)' }}>{item.borrowerName}</td>
                    <td className="px-2 py-2.5">
                      <span style={{ ...getStatusPillStyle(item.state), fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--cr-radius-full, 9999px)', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap', display: 'inline-block' }}>
                        {STATE_LABELS[item.state] ?? item.state}
                      </span>
                    </td>
                    <td className="px-2 py-2.5" style={{ fontSize: 13, color: 'var(--cr-on-surface-variant)' }}>{item.productType || '—'}</td>
                    {/* Amount */}
                    <td className="px-2 py-2.5 text-right">
                      <span style={{ fontFamily: 'var(--cr-font-display)', fontSize: 12, fontWeight: 700, color: 'var(--cr-on-surface)', fontVariantNumeric: 'tabular-nums' }}>
                        {item.requestedAmount != null
                          ? new Intl.NumberFormat('en-MY', { maximumFractionDigits: 0 }).format(item.requestedAmount)
                          : '—'}
                      </span>
                    </td>
                    {/* Risk Grade */}
                    <td className="px-2 py-2.5">
                      {item.riskGrade ? (() => {
                        const { barColor, labelColor, barWidth } = getRiskGradeStyle(item.riskGrade);
                        return (
                          <div>
                            <div style={{ width: 56, height: 5, background: 'var(--cr-surface-container-highest, #e2e2e9)', borderRadius: 9999, overflow: 'hidden', marginBottom: 3 }}>
                              <div style={{ height: '100%', width: barWidth, background: barColor, borderRadius: 9999 }} />
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: labelColor, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{item.riskGrade}</span>
                          </div>
                        );
                      })() : <span style={{ fontSize: 12, color: 'var(--cr-on-surface-variant)' }}>—</span>}
                    </td>
                    {/* SLA */}
                    <td className="px-2 py-2.5">
                      {item.slaStatus === 'OVERDUE'
                        ? <span style={{ background: 'var(--cr-error-container, #ffdad6)', color: 'var(--cr-on-error-container, #93000a)', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--cr-radius-full, 9999px)', textTransform: 'uppercase', letterSpacing: '0.02em', display: 'inline-block' }}>OVERDUE</span>
                        : <span style={{ fontSize: 12, color: 'var(--cr-on-surface-variant)' }}>On Track</span>
                      }
                    </td>
                    <td className="px-2 py-2.5 text-right" style={{ fontSize: 12, color: 'var(--cr-on-surface-variant)' }}>
                      {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <Link to={`/credit/applications/${item.id}`} style={{ color: 'var(--cr-secondary)', fontSize: 16, fontWeight: 700, textDecoration: 'none' }}>→</Link>
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
        <div style={{ background: 'var(--cr-surface-container-lowest, #ffffff)', border: '1px solid var(--cr-outline-variant, #c6c6cd)', borderRadius: 'var(--cr-rounded-lg, 0.5rem)', padding: 20 }}>
          <h3 style={{ fontFamily: 'var(--cr-font-display, Geist)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant, #45464d)', marginBottom: 16 }}>Pending Approvals</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-2 py-2" style={{ fontFamily: 'var(--cr-font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)' }}>App No</th>
                  <th className="text-left px-2 py-2" style={{ fontFamily: 'var(--cr-font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)' }}>Borrower</th>
                  <th className="text-left px-2 py-2" style={{ fontFamily: 'var(--cr-font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)' }}>Status</th>
                  <th className="text-left px-2 py-2" style={{ fontFamily: 'var(--cr-font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)' }}>Product</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.recentApprovals.map(item => (
                  <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface-muted transition-colors">
                    <td className="px-2 py-2.5">
                      <span style={{ fontFamily: 'var(--cr-font-display)', fontSize: 12, fontWeight: 700, color: 'var(--cr-secondary)', letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums' }}>
                        {item.applicationNo || '—'}
                      </span>
                    </td>
                    <td className="px-2 py-2.5" style={{ fontWeight: 600, fontSize: 13, color: 'var(--cr-on-surface)' }}>{item.borrowerName}</td>
                    <td className="px-2 py-2.5">
                      <span style={{ ...getStatusPillStyle(item.state), fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--cr-radius-full, 9999px)', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap', display: 'inline-block' }}>
                        {STATE_LABELS[item.state] ?? item.state}
                      </span>
                    </td>
                    <td className="px-2 py-2.5" style={{ fontSize: 13, color: 'var(--cr-on-surface-variant)' }}>{item.productType || '—'}</td>
                    <td className="px-2 py-2.5 text-right">
                      <Link to={`/credit/applications/${item.id}`} style={{ color: 'var(--cr-secondary)', fontSize: 16, fontWeight: 700, textDecoration: 'none' }}>→</Link>
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
        <div style={{ background: 'var(--cr-surface-container-lowest, #ffffff)', border: '1px solid var(--cr-outline-variant, #c6c6cd)', borderRadius: 'var(--cr-rounded-lg, 0.5rem)', padding: 32, textAlign: 'center' }}>
          <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--cr-on-surface-variant, #45464d)', marginBottom: 8 }}>check_circle</span>
          <p style={{ fontFamily: 'var(--cr-font-body, Inter)', fontSize: 14, color: 'var(--cr-on-surface-variant, #45464d)' }}>No pending work items. You're all caught up!</p>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Pipeline Section
// ---------------------------------------------------------------------------

// Maps display stage labels to the raw `state` values that belong to each
const PIPELINE_STAGE_GROUPS: { label: string; states: string[] }[] = [
  { label: 'New',         states: ['DRAFT', 'SUBMITTED'] },
  { label: 'Assessment',  states: ['KYC_REVIEW', 'COMPLIANCE_HOLD', 'KYC_APPROVED', 'UNDERWRITING', 'CREDIT_ASSESSMENT'] },
  { label: 'Approval',    states: ['COMMITTEE_REVIEW'] },
  { label: 'Offer Letter', states: ['OFFER', 'ACCEPTED'] },
  { label: 'Disbursement', states: ['DISBURSED'] },
  { label: 'Completed',   states: ['ACTIVE', 'CLOSED'] },
];

const PipelineSection: React.FC<{ data: PipelineDashboard }> = ({ data }) => {
  return (
    <div className="space-y-6">
      {/* Active States summary — Total Applications removed (duplicated in My Work KPI row as "Total Active") */}
      <div style={{ background: 'var(--cr-surface-container-lowest, #ffffff)', border: '1px solid var(--cr-outline-variant, #c6c6cd)', borderRadius: 'var(--cr-rounded-lg, 0.5rem)', padding: 20 }}>
        <p style={{ fontFamily: 'var(--cr-font-display, Geist)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant, #45464d)', marginBottom: 8 }}>Active States</p>
        <p style={{ fontFamily: 'var(--cr-font-display, Geist)', fontSize: 24, fontWeight: 700, color: 'var(--cr-on-surface, #191c1e)', fontVariantNumeric: 'tabular-nums' }}>{data.states.filter(s => s.count > 0).length}</p>
      </div>

      {/* SLA Breach Widget */}
      <SlaBreachWidget
        breaches={data.slaBreaches ?? []}
        totalCount={data.slaBreachCount}
        filterMode="all"
      />

      {/* Horizontal chevron pipeline */}
      <div style={{ background: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg, 0.5rem)', padding: 20 }}>
        <h3 style={{ fontFamily: 'var(--cr-font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)', marginBottom: 16 }}>Application Pipeline</h3>
        <div className="flex items-stretch gap-0 overflow-x-auto cr-scroll">
          {PIPELINE_STAGE_GROUPS.map((group, idx) => {
            const count = data.states
              .filter(s => group.states.includes(s.state))
              .reduce((sum, s) => sum + s.count, 0);
            const maxCount = Math.max(
              ...PIPELINE_STAGE_GROUPS.map(g =>
                data.states.filter(s => g.states.includes(s.state)).reduce((sum, s) => sum + s.count, 0)
              ),
              1
            );
            const barWidth = `${Math.max((count / maxCount) * 100, 4)}%`;
            const isCompleted = group.label === 'Completed';
            const isLast = idx === PIPELINE_STAGE_GROUPS.length - 1;

            return (
              <React.Fragment key={group.label}>
                <div style={{ flex: '1 1 0', minWidth: 90, padding: '12px 10px', background: 'var(--cr-surface-container-low)', borderRadius: 'var(--cr-radius, 0.25rem)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontFamily: 'var(--cr-font-display)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)' }}>{group.label}</p>
                  {/* Progress bar */}
                  <div style={{ height: 4, background: 'var(--cr-surface-container-highest, #e2e2e9)', borderRadius: 9999, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: barWidth,
                      background: isCompleted ? 'var(--cr-secondary-fixed-dim, #5e6070)' : 'var(--cr-secondary, #0051d5)',
                      borderRadius: 9999,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                  <p style={{ fontFamily: 'var(--cr-font-display)', fontSize: 22, fontWeight: 700, color: isCompleted ? 'var(--cr-on-surface-variant)' : 'var(--cr-on-surface)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{count}</p>
                </div>
                {!isLast && (
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0 2px', color: 'var(--cr-outline-variant)', fontSize: 18, flexShrink: 0 }}>›</div>
                )}
              </React.Fragment>
            );
          })}
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
      <div style={{ background: 'var(--cr-surface-container-lowest, #ffffff)', border: '1px solid var(--cr-outline-variant, #c6c6cd)', borderRadius: 'var(--cr-rounded-lg, 0.5rem)', padding: 20 }}>
        <p style={{ fontFamily: 'var(--cr-font-display, Geist)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant, #45464d)', marginBottom: 8 }}>Pending Approvals</p>
        <p style={{ fontFamily: 'var(--cr-font-display, Geist)', fontSize: 24, fontWeight: 700, color: 'var(--cr-on-surface, #191c1e)', fontVariantNumeric: 'tabular-nums' }}>{data.totalPending}</p>
      </div>

      {allItems.length === 0 ? (
        <div style={{ background: 'var(--cr-surface-container-lowest, #ffffff)', border: '1px solid var(--cr-outline-variant, #c6c6cd)', borderRadius: 'var(--cr-rounded-lg, 0.5rem)', padding: 32, textAlign: 'center' }}>
          <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--cr-on-surface-variant, #45464d)', marginBottom: 8 }}>check_circle</span>
          <p style={{ fontFamily: 'var(--cr-font-body, Inter)', fontSize: 14, color: 'var(--cr-on-surface-variant, #45464d)' }}>No pending approvals.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--cr-surface-container-lowest, #ffffff)', border: '1px solid var(--cr-outline-variant, #c6c6cd)', borderRadius: 'var(--cr-rounded-lg, 0.5rem)', overflow: 'hidden' }}>
          <table className="w-full text-sm" style={{ fontFamily: 'var(--cr-font-body, Inter, sans-serif)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--cr-outline-variant, #c6c6cd)', background: 'var(--cr-surface-container, #eceef0)' }}>
                <th className="text-left px-4 py-3" style={{ fontFamily: 'var(--cr-font-display, Geist)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant, #45464d)' }}>Urgency</th>
                <th className="text-left px-4 py-3" style={{ fontFamily: 'var(--cr-font-display, Geist)', fontSize: 12, fontWeight: 600, letterSpacing: '00.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant, #45464d)' }}>Borrower</th>
                <th className="text-left px-4 py-3" style={{ fontFamily: 'var(--cr-font-display, Geist)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant, #45464d)' }}>Product</th>
                <th className="text-right px-4 py-3" style={{ fontFamily: 'var(--cr-font-display, Geist)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant, #45464d)' }}>Amount</th>
                <th className="text-left px-4 py-3" style={{ fontFamily: 'var(--cr-font-display, Geist)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant, #45464d)' }}>State</th>
                <th className="text-right px-4 py-3" style={{ fontFamily: 'var(--cr-font-display, Geist)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant, #45464d)' }}>Waiting</th>
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
      <div style={{ background: 'var(--cr-surface-container-lowest, #ffffff)', border: '1px solid var(--cr-outline-variant, #c6c6cd)', borderRadius: 'var(--cr-rounded-lg, 0.5rem)', padding: 20 }}>
        <p style={{ fontFamily: 'var(--cr-font-display, Geist)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant, #45464d)', marginBottom: 8 }}>Total Portfolio Exposure</p>
        <p style={{ fontFamily: 'var(--cr-font-display, Geist)', fontSize: 24, fontWeight: 700, color: 'var(--cr-on-surface, #191c1e)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(summary?.totalPortfolioExposure ?? data.totalPortfolio)}</p>
      </div>

      {/* §2.6 — Exposure Limit Alerts */}
      {summary && (summary.approachingLimit.length > 0 || summary.breachedLimit.length > 0) && (
        <div className="space-y-3">
          {summary.breachedLimit.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--cr-rounded-lg, 0.5rem)', padding: 20 }}>
              <h3 style={{ fontFamily: 'var(--cr-font-display, Geist)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#991b1b', marginBottom: 12 }} className="flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ color: '#dc2626' }}>error</span>
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
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--cr-rounded-lg, 0.5rem)', padding: 20 }}>
              <h3 style={{ fontFamily: 'var(--cr-font-display, Geist)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#92400e', marginBottom: 12 }} className="flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ color: '#d97706' }}>warning</span>
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
      <div style={{ background: 'var(--cr-surface-container-lowest, #ffffff)', border: '1px solid var(--cr-outline-variant, #c6c6cd)', borderRadius: 'var(--cr-rounded-lg, 0.5rem)', padding: 20 }}>
        <h3 style={{ fontFamily: 'var(--cr-font-display, Geist)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant, #45464d)', marginBottom: 16 }}>Top Borrowers by Exposure</h3>
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
      <div style={{ background: 'var(--cr-surface-container-lowest, #ffffff)', border: '1px solid var(--cr-outline-variant, #c6c6cd)', borderRadius: 'var(--cr-rounded-lg, 0.5rem)', padding: 20 }}>
        <h3 style={{ fontFamily: 'var(--cr-font-display, Geist)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant, #45464d)', marginBottom: 16 }}>Sector Breakdown</h3>
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
      <div style={{ background: 'var(--cr-surface-container-lowest, #ffffff)', border: '1px solid var(--cr-outline-variant, #c6c6cd)', borderRadius: 'var(--cr-rounded-lg, 0.5rem)', padding: 20 }}>
        <h3 style={{ fontFamily: 'var(--cr-font-display, Geist)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant, #45464d)', marginBottom: 16 }}>Rating Distribution</h3>
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
        <div style={{ background: 'var(--cr-surface-container-lowest, #ffffff)', border: '1px solid var(--cr-outline-variant, #c6c6cd)', borderRadius: 'var(--cr-rounded-lg, 0.5rem)', padding: 20 }}>
          <h3 style={{ fontFamily: 'var(--cr-font-display, Geist)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant, #45464d)', marginBottom: 16 }}>Exposure by Product Type</h3>
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
      <div style={{ background: 'var(--cr-surface-container-lowest, #ffffff)', border: '1px solid var(--cr-outline-variant, #c6c6cd)', borderRadius: 'var(--cr-rounded-lg, 0.5rem)', padding: 20 }}>
        <p style={{ fontFamily: 'var(--cr-font-display, Geist)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant, #45464d)', marginBottom: 8 }}>Upcoming Meetings</p>
        <p style={{ fontFamily: 'var(--cr-font-display, Geist)', fontSize: 24, fontWeight: 700, color: 'var(--cr-on-surface, #191c1e)', fontVariantNumeric: 'tabular-nums' }}>{data.totalUpcoming}</p>
      </div>

      {data.meetings.length === 0 ? (
        <div style={{ background: 'var(--cr-surface-container-lowest, #ffffff)', border: '1px solid var(--cr-outline-variant, #c6c6cd)', borderRadius: 'var(--cr-rounded-lg, 0.5rem)', padding: 32, textAlign: 'center' }}>
          <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--cr-on-surface-variant, #45464d)', marginBottom: 8 }}>event_busy</span>
          <p style={{ fontFamily: 'var(--cr-font-body, Inter)', fontSize: 14, color: 'var(--cr-on-surface-variant, #45464d)' }}>No upcoming committee meetings.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.meetings.map(m => (
            <div key={m.meetingId} style={{ background: 'var(--cr-surface-container-lowest, #ffffff)', border: '1px solid var(--cr-outline-variant, #c6c6cd)', borderRadius: 'var(--cr-rounded-lg, 0.5rem)', padding: 16 }} className="flex items-center gap-4">
              <div className="w-12 h-12 flex items-center justify-center flex-shrink-0" style={{ borderRadius: 'var(--cr-rounded, 0.25rem)', background: 'var(--cr-secondary-fixed, #dbe1ff)' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--cr-secondary, #0051d5)' }}>calendar_month</span>
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