/**
 * ApplicationOverviewTab — Enterprise-grade overview dashboard for the credit
 * application detail page (Application 360 Workspace).
 *
 * Sections:
 *   1. Executive Summary — Top KPI cards (borrowed from ApplicationKpiRow)
 *   2. Application Journey — Horizontal workflow stepper
 *   3. Credit Risk Snapshot — 4+1 risk metric cards
 *   4. Financial Trend Analysis — Mini bar charts from financial statements
 *   5. Approval Workflow — Connected approval matrix nodes
 *   6. Recent Activities — Enhanced activity feed with avatars and icons
 *   7. Borrower Profile (existing)
 *   8. Documents (existing)
 *   9. Tasks / Next Actions (existing)
 *  10. Health Summary (existing 3-bar)
 *
 * Uses Financial Core design tokens (--cr-*).
 */
import React, { useEffect, useMemo, useState } from 'react';
import creditService, {
  CreditApplication,
  CreditFacility,
  CreditAuditEvent,
  ApplicationTransition,
  ApplicationState,
  CreditApproval,
  FinancialStatement,
  ApprovalDecision,
} from '../../../services/credit.service';
import {
  DetailTab,
  formatCurrency,
  PRODUCT_LABELS,
  STEPPER_STAGES,
  TAB_GROUPS,
  BorrowerSegment,
  SEGMENT_LABELS,
} from '../../../../pages/credit/creditUtils';
import { getBorrowerDisplayName } from '../BorrowerSummaryCard';
import CreditDecisionSummaryCard from './CreditDecisionSummaryCard';

// ── Readiness field → human-readable label mapping ──────────────────────

const FIELD_LABELS: Record<string, string> = {
  application: 'Application Details',
  facilities: 'Facility Details',
  borrowerProfile: 'Borrower Profile',
  documents: 'Supporting Documents',
  scoreOverride: 'Risk Score Override',
  collateral: 'Collateral & Security',
  parties: 'Directors & UBOs',
  financials: 'Financial Statements',
  bureauChecks: 'Bureau Checks',
  bureauChecklist: 'Bureau Checklist',
  retailIncome: 'Retail Income Verification',
  exposureLimit: 'Exposure Limit',
  fatcaCrs: 'FATCA/CRS Declaration',
};

const FIELD_CATEGORY: Record<string, string> = {
  application: 'Business',
  facilities: 'Business',
  borrowerProfile: 'Identity',
  documents: 'Identity',
  scoreOverride: 'Risk',
  collateral: 'Security',
  parties: 'Identity',
  financials: 'Financial',
  bureauChecks: 'Compliance',
  bureauChecklist: 'Compliance',
  retailIncome: 'Financial',
  exposureLimit: 'Risk',
  fatcaCrs: 'Compliance',
};

const CATEGORY_ORDER = ['Business', 'Identity', 'Financial', 'Risk', 'Security', 'Compliance', 'Other'] as const;
const CATEGORY_ICON: Record<string, string> = {
  Business: 'business',
  Identity: 'badge',
  Risk: 'assessment',
  Security: 'shield',
  Financial: 'account_balance',
  Compliance: 'fact_check',
};

// Map readiness fields to tabs for navigation
const FIELD_TO_TAB: Record<string, DetailTab> = {
  application: 'loan-request',
  facilities: 'facilities',
  borrowerProfile: 'borrower-profile',
  documents: 'documents',
  scoreOverride: 'risk-score',
  collateral: 'collateral',
  parties: 'parties',
  financials: 'financials',
  bureauChecks: 'credit-checks-risk',
  bureauChecklist: 'credit-checks-risk',
  retailIncome: 'sme-financials',
  exposureLimit: 'risk-score',
  fatcaCrs: 'borrower-profile',
};

const BORROWER_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: 'Individual',
  SOLE_PROPRIETOR: 'Sole Proprietor',
  CORPORATE: 'Corporate',
  JOINT: 'Joint',
};

// Map stepper stage key to first tab in the corresponding TAB_GROUP
const STAGE_TO_TAB: Record<string, DetailTab> = {
  draft: 'loan-request',
  kyc: 'borrower-profile',
  assessment: 'financials',
  referred: 'loan-request',
  decision: 'approvals',
  offer: 'approvals',
  active: 'approvals',
};

// ── Approval decision display helpers ────────────────────────────────────

const DECISION_STYLES: Record<string, { bg: string; color: string; icon: string; label: string }> = {
  APPROVED: { bg: '#f0fdf4', color: '#16a34a', icon: 'check_circle', label: 'Approved' },
  REJECTED: { bg: '#fef2f2', color: '#dc2626', icon: 'cancel', label: 'Rejected' },
  PENDING: { bg: '#fffbeb', color: '#d97706', icon: 'schedule', label: 'Pending' },
  CONCURRED: { bg: '#eff6ff', color: '#2563eb', icon: 'thumb_up', label: 'Concurred' },
};

const AUTHORITY_LABELS: Record<string, string> = {
  RM: 'Relationship Manager',
  ANALYST: 'Credit Analyst',
  MANAGER: 'Credit Manager',
  HEAD_OF_CREDIT: 'Head of Credit',
  COMMITTEE: 'Credit Committee',
  COMMITTEE_CHAIR: 'Committee Chair',
};

// ── Types ──────────────────────────────────────────────────────────────

type DocStatus = 'UPLOADED' | 'MISSING' | 'PENDING';

interface DocItem {
  field: string;
  label: string;
  category: string;
  message: string;
  status: DocStatus;
}

interface CommentPreview {
  id: string;
  author: string;
  content: string;
  timeAgo: string;
}

interface ApplicationOverviewTabProps {
  app: CreditApplication;
  facilities: CreditFacility[];
  readiness: {
    ready: boolean;
    errors: { field: string; message: string; severity: string }[];
    warnings: { field: string; message: string; severity: string }[];
    satisfied: { field: string; message: string; severity: string }[];
  } | null;
  slaDaysLeft: number | null;
  formatTimeAgo: (date: Date) => string;
  onNavigate: (tab: DetailTab) => void;
  transitions: ApplicationTransition[];
  currentState: ApplicationState;
  phaseCompletion: Record<string, string>;
  commentPreviews: CommentPreview[];
  onAddNote: (text: string) => void;
  onOpenComments: () => void;
  nextTab: DetailTab | null;
  nextGroupLabel: string;
  nextTabLabel: string;
  assigneeName?: string;
  dueDate?: string;
  urgency: 'urgent' | 'warning' | 'normal';
  progressPct: number;
  documentReadinessPct: number;
  workflowVelocityPct: number;
  /** Current journey stage index (mapped from app state) */
  currentJourneyIndex?: number;
  /** Segment for KPI row traffic-light gating */
  segment?: BorrowerSegment;
}

// ── Reusable sub-components ────────────────────────────────────────────

const SectionCard: React.FC<{
  icon: string;
  title: string;
  onGoTo?: () => void;
  goToLabel?: string;
  children: React.ReactNode;
}> = ({ icon, title, onGoTo, goToLabel, children }) => (
  <div
    className="rounded overflow-hidden"
    style={{
      backgroundColor: 'var(--cr-surface-container-lowest)',
      border: '1px solid var(--cr-outline-variant)',
      borderRadius: 'var(--cr-radius, 4px)',
    }}
  >
    <div
      className="flex items-center justify-between px-4 py-2.5 border-b"
      style={{ borderColor: 'var(--cr-outline-variant)' }}
    >
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--cr-primary)' }}>
          {icon}
        </span>
        <span
          className="text-xs font-bold uppercase tracking-tight"
          style={{ color: 'var(--cr-on-surface-variant)', fontFamily: 'var(--cr-font-display)' }}
        >
          {title}
        </span>
      </div>
      {onGoTo && (
        <button
          onClick={onGoTo}
          className="text-xs font-semibold hover:underline"
          style={{ color: 'var(--cr-primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--cr-font-display)' }}
        >
          {goToLabel || 'Go to →'}
        </button>
      )}
    </div>
    <div className="px-4 py-3">{children}</div>
  </div>
);

const InfoRow: React.FC<{
  label: string;
  value: React.ReactNode;
}> = ({ label, value }) => (
  <div className="flex items-center justify-between py-1">
    <span className="text-sm" style={{ color: 'var(--cr-outline)', fontFamily: 'var(--cr-font-body)' }}>
      {label}
    </span>
    <span className="text-sm font-semibold text-right" style={{ color: 'var(--cr-on-surface)', fontFamily: 'var(--cr-font-display)' }}>
      {value || '—'}
    </span>
  </div>
);

const StatusPill: React.FC<{
  label: string;
  color: string;
  bg: string;
}> = ({ label, color, bg }) => (
  <span
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase"
    style={{ backgroundColor: bg, color, border: `1px solid ${color}30` }}
  >
    {label}
  </span>
);

// ── Mini Bar Chart for Financial Trends ─────────────────────────────────

const MiniBarChart: React.FC<{
  label: string;
  data: { year: string; value: number }[];
  color: string;
  currency: string;
}> = ({ label, data, color, currency }) => {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="font-bold uppercase"
        style={{ fontSize: 11, color: 'var(--cr-outline)', fontFamily: 'var(--cr-font-display)', letterSpacing: '0.08em' }}
      >
        {label}
      </span>
      <div className="flex items-end gap-2" style={{ height: 72 }}>
        {data.map((d, i) => {
          const pct = maxVal > 0 ? (d.value / maxVal) * 100 : 0;
          return (
            <div key={i} className="flex flex-col items-center gap-1 flex-1">
              <span style={{ fontSize: 10, fontFamily: 'var(--cr-font-display)', fontWeight: 600, color: 'var(--cr-on-surface)' }}>
                {d.value >= 1_000_000 ? `${(d.value / 1_000_000).toFixed(1)}M` : d.value >= 1_000 ? `${(d.value / 1_000).toFixed(0)}K` : `${d.value}`}
              </span>
              <div
                style={{
                  width: '100%',
                  minWidth: 16,
                  height: `${Math.max(pct, 8)}%`,
                  backgroundColor: color,
                  borderRadius: '2px 2px 0 0',
                  transition: 'height 0.3s ease',
                }}
              />
              <span style={{ fontSize: 9, color: 'var(--cr-outline)', fontFamily: 'var(--cr-font-body)' }}>
                {d.year}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Section 1: Credit Risk Snapshot ──────────────────────────────────────

const RiskSnapshotSection: React.FC<{
  app: CreditApplication;
  onNavigate: (tab: DetailTab) => void;
}> = ({ app, onNavigate }) => {
  const bp = app.borrowerProfile;
  const _app = app as any;

  // Derive risk metrics — prefer the flattened score run fields from getApplication
  const riskGrade = app.riskRating || bp?.creditRiskRating || null;
  const snapshot = (app as any).inputSnapshot;
  const dscr = snapshot?.dsrPercent != null
    ? Number(snapshot.dsrPercent) >= 100
      ? Number((Number(snapshot.dsrPercent) / 100).toFixed(2))
      : null
    : _app.dscr ?? null;
  const debtToEquity = _app.debtToEquity ?? null;
  const collateralCoverage = _app.collateralCoverage ?? null;
  const internalRating = app.riskRating ?? _app.internalRating ?? null;

  const riskColor = (() => {
    if (!riskGrade) return 'var(--cr-outline)';
    if (['AAA', 'AA', 'A'].includes(riskGrade)) return '#16a34a';
    if (['BBB', 'BB'].includes(riskGrade)) return '#d97706';
    return '#dc2626';
  })();

  const dscrColor = (() => {
    if (dscr == null) return 'var(--cr-outline)';
    if (dscr >= 1.5) return '#16a34a';
    if (dscr >= 1.25) return '#d97706';
    return '#dc2626';
  })();

  const deColor = (() => {
    if (debtToEquity == null) return 'var(--cr-outline)';
    if (debtToEquity <= 1) return '#16a34a';
    if (debtToEquity <= 2) return '#d97706';
    return '#dc2626';
  })();

  const ccColor = (() => {
    if (collateralCoverage == null) return 'var(--cr-outline)';
    if (collateralCoverage >= 150) return '#16a34a';
    if (collateralCoverage >= 100) return '#d97706';
    return '#dc2626';
  })();

  type RiskCardProps = { label: string; value: string; sublabel?: string; color: string };
  const RiskCard: React.FC<RiskCardProps> = ({ label, value, sublabel, color }) => (
    <div
      className="flex flex-col gap-1 p-3 rounded"
      style={{
        backgroundColor: 'var(--cr-surface-container-lowest)',
        border: '1px solid var(--cr-outline-variant)',
        borderRadius: 'var(--cr-radius)',
      }}
    >
      <span
        className="font-bold uppercase"
        style={{ fontSize: 10, color: 'var(--cr-outline)', fontFamily: 'var(--cr-font-display)', letterSpacing: '0.1em' }}
      >
        {label}
      </span>
      <span className="font-bold" style={{ fontSize: 24, color, fontFamily: 'var(--cr-font-display)', lineHeight: 1.2 }}>
        {value}
      </span>
      {sublabel && (
        <span style={{ fontSize: 11, color: 'var(--cr-outline)', fontFamily: 'var(--cr-font-body)' }}>
          {sublabel}
        </span>
      )}
    </div>
  );

  return (
    <SectionCard icon="shield" title="Credit Risk Snapshot" onGoTo={() => onNavigate('risk-score')} goToLabel="Go to Risk →">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <RiskCard label="Risk Grade" value={riskGrade || 'NR'} sublabel={riskGrade ? 'Internal scorecard rating' : 'Not rated'} color={riskColor} />
        <RiskCard label="DSCR" value={dscr != null ? `${dscr}x` : '—'} sublabel={dscr != null ? (dscr >= 1.5 ? 'Healthy' : dscr >= 1.25 ? 'Adequate' : 'Below threshold') : undefined} color={dscrColor} />
        <RiskCard label="Debt-to-Equity" value={debtToEquity != null ? `${debtToEquity}x` : '—'} sublabel={debtToEquity != null ? (debtToEquity <= 1 ? 'Low leverage' : debtToEquity <= 2 ? 'Moderate' : 'High leverage') : undefined} color={deColor} />
        <RiskCard label="Collateral Coverage" value={collateralCoverage != null ? `${collateralCoverage}%` : '—'} sublabel={collateralCoverage != null ? (collateralCoverage >= 150 ? 'Well covered' : collateralCoverage >= 100 ? 'Adequate' : 'Under-collateralised') : undefined} color={ccColor} />
        <RiskCard label="Internal Rating" value={internalRating || '—'} sublabel={internalRating ? 'Internal assessment' : 'Pending'} color={internalRating ? '#2563eb' : 'var(--cr-outline)'} />
      </div>
    </SectionCard>
  );
};

// ── Section 2: Financial Trend Analysis ──────────────────────────────────

const FinancialTrendSection: React.FC<{
  app: CreditApplication;
}> = ({ app }) => {
  const [financials, setFinancials] = useState<FinancialStatement[]>([]);

  useEffect(() => {
    if (!app.borrowerProfileId) return;
    let mounted = true;
    creditService.listFinancialStatements(app.borrowerProfileId)
      .then(data => { if (mounted) setFinancials(data); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [app.borrowerProfileId]);

  // Extract revenue/profit/EBITDA/cashflow trends from financial statements
  const trends = useMemo(() => {
    if (!financials.length) return null;

    // Get PL statements sorted by fiscalYearEnd
    const plStmts = financials
      .filter(s => s.statementType === 'PL')
      .sort((a, b) => a.fiscalYearEnd.localeCompare(b.fiscalYearEnd));

    // Get CF statements
    const cfStmts = financials
      .filter(s => s.statementType === 'CF')
      .sort((a, b) => a.fiscalYearEnd.localeCompare(b.fiscalYearEnd));

    const extractLineValue = (items: any[], key: string): number | null => {
      const item = items?.find((li: any) => li.lineKey === key || li.lineKey?.toLowerCase().includes(key.toLowerCase()));
      return item ? Number(item.amount) || null : null;
    };

    const revenueData: { year: string; value: number }[] = [];
    const profitData: { year: string; value: number }[] = [];
    const ebitdaData: { year: string; value: number }[] = [];

    for (const stmt of plStmts) {
      const year = stmt.fiscalYearEnd?.slice(0, 4) || '';
      if (!year) continue;
      const items = stmt.lineItems || [];
      const revenue = extractLineValue(items, 'revenue') ?? extractLineValue(items, 'totalRevenue');
      const profit = extractLineValue(items, 'netProfit') ?? extractLineValue(items, 'netIncome');
      const ebitda = extractLineValue(items, 'ebitda');
      if (revenue != null) revenueData.push({ year, value: revenue });
      if (profit != null) profitData.push({ year, value: profit });
      if (ebitda != null) ebitdaData.push({ year, value: ebitda });
    }

    const cashflowData: { year: string; value: number }[] = [];
    for (const stmt of cfStmts) {
      const year = stmt.fiscalYearEnd?.slice(0, 4) || '';
      if (!year) continue;
      const items = stmt.lineItems || [];
      const opCash = extractLineValue(items, 'operatingCashFlow') ?? extractLineValue(items, 'netCashFromOperating');
      if (opCash != null) cashflowData.push({ year, value: opCash });
    }

    return { revenueData, profitData, ebitdaData, cashflowData };
  }, [financials]);

  if (!trends || (
    trends.revenueData.length === 0 &&
    trends.profitData.length === 0 &&
    trends.ebitdaData.length === 0 &&
    trends.cashflowData.length === 0
  )) {
    return (
      <SectionCard icon="trending_up" title="Financial Trend Analysis" onGoTo={() => {}} goToLabel="">
        <div className="text-center py-6">
          <span className="material-symbols-outlined text-3xl mb-2 block" style={{ color: 'var(--cr-outline)' }}>
            bar_chart
          </span>
          <p className="text-sm" style={{ color: 'var(--cr-on-surface-variant)' }}>
            Financial statements not yet uploaded. Upload data in the Financial Profile tab.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard icon="trending_up" title="Financial Trend Analysis">
      <div className="grid grid-cols-2 gap-6">
        <MiniBarChart label="Revenue Trend" data={trends.revenueData} color="#2563eb" currency={app.currency} />
        <MiniBarChart label="Net Profit Trend" data={trends.profitData} color="#16a34a" currency={app.currency} />
        <MiniBarChart label="EBITDA Trend" data={trends.ebitdaData} color="#7c3aed" currency={app.currency} />
        <MiniBarChart label="Cash Flow Trend" data={trends.cashflowData} color="#d97706" currency={app.currency} />
      </div>
    </SectionCard>
  );
};

// ── Section 3: Approval Workflow ────────────────────────────────────────

const ApprovalWorkflowSection: React.FC<{
  app: CreditApplication;
  onNavigate: (tab: DetailTab) => void;
}> = ({ app, onNavigate }) => {
  const [approvals, setApprovals] = useState<CreditApproval[]>([]);

  useEffect(() => {
    let mounted = true;
    creditService.listApprovals(app.id)
      .then(data => { if (mounted) setApprovals(data); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [app.id]);

  // Define the standard approval chain (authoritative levels)
  const approvalChain = useMemo(() => {
    const levels = [
      { authorityLevel: 'RM', label: 'Relationship Manager', icon: 'person' },
      { authorityLevel: 'ANALYST', label: 'Credit Analyst', icon: 'analytics' },
      { authorityLevel: 'MANAGER', label: 'Credit Manager', icon: 'supervisor_account' },
      { authorityLevel: 'HEAD_OF_CREDIT', label: 'Head of Credit', icon: 'verified_user' },
      { authorityLevel: 'COMMITTEE', label: 'Credit Committee', icon: 'groups' },
    ];

    return levels.map(level => {
      const matchingApproval = approvals.find(a =>
        a.authorityLevel === level.authorityLevel ||
        a.authorityLevel?.toUpperCase() === level.authorityLevel
      );
      return {
        ...level,
        approval: matchingApproval,
        status: matchingApproval?.decision || 'PENDING' as ApprovalDecision,
      };
    });
  }, [approvals]);

  const getDecisionStyle = (status: string) => {
    if (status === 'APPROVED' || status === 'CONCURRED') return DECISION_STYLES.APPROVED;
    if (status === 'REJECTED') return DECISION_STYLES.REJECTED;
    return DECISION_STYLES.PENDING;
  };

  return (
    <SectionCard icon="how_to_reg" title="Approval Workflow" onGoTo={() => onNavigate('approvals')} goToLabel="Go to Approvals →">
      <div className="flex flex-col gap-0">
        {approvalChain.map((level, idx) => {
          const style = getDecisionStyle(level.status);
          const approverName = level.approval?.approver
            ? `${level.approval.approver.firstName} ${level.approval.approver.lastName}`
            : null;
          const decidedAt = level.approval?.decidedAt;

          return (
            <div key={level.authorityLevel}>
              <div className="flex items-center gap-3 py-2">
                {/* Node circle */}
                <div className="relative flex flex-col items-center">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: style.bg, border: `2px solid ${style.color}` }}
                  >
                    <span className="material-symbols-outlined text-[18px]" style={{ color: style.color }}>
                      {level.approval ? style.icon : level.icon}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--cr-on-surface)', fontFamily: 'var(--cr-font-display)' }}>
                        {level.label}
                      </span>
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase"
                        style={{ backgroundColor: style.bg, color: style.color }}
                      >
                        {style.label}
                      </span>
                    </div>
                    {approverName && (
                      <span className="text-xs" style={{ color: 'var(--cr-outline)', fontFamily: 'var(--cr-font-body)' }}>
                        {approverName}
                      </span>
                    )}
                  </div>
                  {decidedAt && (
                    <span className="text-[11px]" style={{ color: 'var(--cr-outline)', fontFamily: 'var(--cr-font-body)' }}>
                      {new Date(decidedAt).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {idx < approvalChain.length - 1 && (
                <div className="ml-[17px] w-0.5 h-3" style={{ backgroundColor: 'var(--cr-outline-variant)' }} />
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
};

// ── Section 4: Recent Activities (Enhanced) ─────────────────────────────

const ACTIVITY_ICON_MAP: Record<string, string> = {
  STATE_TRANSITION: 'swap_horiz',
  DOCUMENT_UPLOADED: 'upload_file',
  DOCUMENT_VERIFIED: 'verified',
  COMMENT_ADDED: 'chat_bubble',
  SCORE_UPDATED: 'assessment',
  APPROVAL_DECISION: 'how_to_reg',
  APPLICATION_CREATED: 'note_add',
  APPLICATION_SUBMITTED: 'send',
  ASSIGNMENT_CHANGED: 'person_add',
};

const ACTIVITY_LABEL_MAP: Record<string, string> = {
  STATE_TRANSITION: 'State changed',
  DOCUMENT_UPLOADED: 'Document uploaded',
  DOCUMENT_VERIFIED: 'Document verified',
  COMMENT_ADDED: 'Comment added',
  SCORE_UPDATED: 'Risk score updated',
  APPROVAL_DECISION: 'Approval decision',
  APPLICATION_CREATED: 'Application created',
  APPLICATION_SUBMITTED: 'Application submitted',
  ASSIGNMENT_CHANGED: 'Assignment changed',
};

const SEVERITY_ICON_MAP: Record<string, { icon: string; color: string }> = {
  error: { icon: 'error', color: '#dc2626' },
  warning: { icon: 'warning', color: '#d97706' },
  info: { icon: 'info', color: '#2563eb' },
};

const RecentActivitiesSection: React.FC<{
  applicationId: string;
  formatTimeAgo: (date: Date) => string;
  onNavigate: (tab: DetailTab) => void;
}> = ({ applicationId, formatTimeAgo, onNavigate }) => {
  const [events, setEvents] = useState<CreditAuditEvent[]>([]);

  useEffect(() => {
    let mounted = true;
    creditService.getApplicationAudit(applicationId)
      .then(data => { if (mounted) setEvents(data.slice(0, 8)); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [applicationId]);

  if (events.length === 0) {
    return (
      <SectionCard icon="history" title="Recent Activities" onGoTo={() => onNavigate('audit')} goToLabel="Go to Audit Trail →">
        <div className="text-center py-3">
          <span className="material-symbols-outlined text-2xl mb-1 block" style={{ color: 'var(--cr-outline)' }}>
            event_note
          </span>
          <p className="text-sm" style={{ color: 'var(--cr-on-surface-variant)' }}>No recent activity</p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard icon="history" title="Recent Activities" onGoTo={() => onNavigate('audit')} goToLabel="Go to Audit Trail →">
      <div className="flex flex-col gap-0">
        {events.map((event, idx) => {
          const icon = ACTIVITY_ICON_MAP[event.eventType] || 'circle';
          const label = ACTIVITY_LABEL_MAP[event.eventType] || event.action || event.eventType;
          const actor = event.actor ? `${event.actor.firstName} ${event.actor.lastName}` : 'System';
          const initials = actor.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
          const timeAgo = event.createdAt ? formatTimeAgo(new Date(event.createdAt)) : '';
          const isLatest = idx === 0;

          return (
            <div key={event.id} className="flex items-start gap-3 relative">
              {/* Timeline connector + avatar */}
              <div className="flex flex-col items-center shrink-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                  style={{
                    backgroundColor: isLatest ? 'var(--cr-primary-container)' : 'var(--cr-surface-container-high)',
                    color: isLatest ? 'var(--cr-on-primary-container)' : 'var(--cr-on-surface-variant)',
                  }}
                >
                  {event.actor ? initials : (
                    <span className="material-symbols-outlined text-[16px]">{icon}</span>
                  )}
                </div>
                {idx < events.length - 1 && (
                  <div className="w-0.5 h-6" style={{ backgroundColor: 'var(--cr-outline-variant)' }} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold" style={{ color: 'var(--cr-on-surface)' }}>
                    {label}
                  </span>
                  {event.newState && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--cr-secondary-container)', color: 'var(--cr-on-secondary-container)' }}>
                      {event.newState.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--cr-on-surface-variant)' }}>
                    {actor}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--cr-outline)' }}>•</span>
                  <span className="text-[11px]" style={{ color: 'var(--cr-outline)' }}>{timeAgo}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
};

// ── Section 5: Borrower Profile ─────────────────────────────────────────

const BorrowerProfileSection: React.FC<{
  app: CreditApplication;
  onNavigate: (tab: DetailTab) => void;
}> = ({ app, onNavigate }) => {
  const bp = app.borrowerProfile;
  const displayName = bp ? getBorrowerDisplayName(bp) : 'Unnamed Borrower';
  const typeLabel = bp?.borrowerType ? (BORROWER_TYPE_LABELS[bp.borrowerType] || bp.borrowerType) : '—';

  const riskColor = (() => {
    const r = bp?.creditRiskRating;
    if (!r) return 'var(--cr-outline)';
    if (['AAA', 'AA', 'A'].includes(r)) return '#16a34a';
    if (['BBB', 'BB'].includes(r)) return '#d97706';
    return '#dc2626';
  })();

  const amlColor = (() => {
    const t = bp?.amlRiskTier;
    if (!t) return 'var(--cr-outline)';
    if (['LOW'].includes(t.toUpperCase())) return '#16a34a';
    if (['MEDIUM', 'MEDIUM'].includes(t.toUpperCase())) return '#d97706';
    return '#dc2626';
  })();

  return (
    <SectionCard icon="person" title="Borrower Profile" onGoTo={() => onNavigate('borrower-profile')} goToLabel="Go to Profile →">
      <div className="flex flex-col gap-2">
        {/* Name + Type */}
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: 'var(--cr-primary-container)', color: 'var(--cr-on-primary-container)' }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold" style={{ color: 'var(--cr-on-surface)', fontFamily: 'var(--cr-font-display)' }}>
              {displayName}
            </span>
            <span className="text-xs" style={{ color: 'var(--cr-on-surface-variant)' }}>
              {typeLabel}
            </span>
          </div>
        </div>

        {/* Contact info */}
        {bp?.contact && (
          <>
            <InfoRow label="Email" value={bp.contact.email || '—'} />
            <InfoRow label="Phone" value={bp.contact.phone || bp.contact.mobile || '—'} />
          </>
        )}

        {/* Risk & AML */}
        <div className="flex items-center gap-3 mt-1">
          {bp?.creditRiskRating && (
            <div className="flex items-center gap-1">
              <span className="text-xs" style={{ color: 'var(--cr-outline)' }}>Risk:</span>
              <StatusPill label={bp.creditRiskRating} color={riskColor} bg={`${riskColor}15`} />
            </div>
          )}
          {bp?.amlRiskTier && (
            <div className="flex items-center gap-1">
              <span className="text-xs" style={{ color: 'var(--cr-outline)' }}>AML:</span>
              <StatusPill label={bp.amlRiskTier} color={amlColor} bg={`${amlColor}15`} />
            </div>
          )}
        </div>

        {/* Exposure */}
        {(bp?.totalExposure != null || bp?.exposureLimit != null) && (
          <div className="flex items-center gap-4 mt-1 pt-1" style={{ borderTop: '1px solid var(--cr-outline-variant)' }}>
            {bp.totalExposure != null && (
              <div className="flex flex-col">
                <span className="text-[11px] uppercase" style={{ color: 'var(--cr-outline)' }}>Total Exposure</span>
                <span className="text-sm font-bold" style={{ color: 'var(--cr-on-surface)', fontFamily: 'var(--cr-font-display)' }}>
                  {formatCurrency(Number(bp.totalExposure), app.currency)}
                </span>
              </div>
            )}
            {bp.exposureLimit != null && (
              <div className="flex flex-col">
                <span className="text-[11px] uppercase" style={{ color: 'var(--cr-outline)' }}>Exposure Limit</span>
                <span className="text-sm font-bold" style={{ color: 'var(--cr-on-surface)', fontFamily: 'var(--cr-font-display)' }}>
                  {formatCurrency(Number(bp.exposureLimit), app.currency)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Key identifiers */}
        {app.cifNo && <InfoRow label="CIF No." value={app.cifNo} />}
        {app.customerGroupName && <InfoRow label="Customer Group" value={app.customerGroupName} />}
      </div>
    </SectionCard>
  );
};

// ── Section 6: Documents ────────────────────────────────────────────────

const STATUS_STYLES: Record<DocStatus, { bg: string; text: string; border: string; icon: string }> = {
  UPLOADED: { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0', icon: 'check_circle' },
  MISSING: { bg: 'var(--cr-error-container)', text: 'var(--cr-on-error-container)', border: 'var(--cr-outline-variant)', icon: 'error' },
  PENDING: { bg: '#fffbeb', text: '#d97706', border: '#fde68a', icon: 'schedule' },
};

const DocumentsSection: React.FC<{
  readiness: ApplicationOverviewTabProps['readiness'];
  documentReadinessPct: number;
  onNavigate: (tab: DetailTab) => void;
}> = ({ readiness, documentReadinessPct, onNavigate }) => {
  if (!readiness) {
    return (
      <SectionCard icon="folder_open" title="Documents" onGoTo={() => onNavigate('documents')} goToLabel="Go to Documents →">
        <div className="text-center py-4">
          <span className="material-symbols-outlined text-3xl mb-2 block" style={{ color: 'var(--cr-outline)' }}>
            hourglass_empty
          </span>
          <p className="text-sm" style={{ color: 'var(--cr-on-surface-variant)' }}>
            Submit the application to generate a document checklist.
          </p>
        </div>
      </SectionCard>
    );
  }

  // Build checklist items from readiness data
  const items: DocItem[] = [
    ...readiness.satisfied.map(s => ({
      field: s.field,
      label: FIELD_LABELS[s.field] || s.field,
      category: FIELD_CATEGORY[s.field] || 'Other',
      message: s.message,
      status: 'UPLOADED' as DocStatus,
    })),
    ...readiness.errors.map(e => ({
      field: e.field,
      label: FIELD_LABELS[e.field] || e.field,
      category: FIELD_CATEGORY[e.field] || 'Other',
      message: e.message,
      status: 'MISSING' as DocStatus,
    })),
    ...readiness.warnings.map(w => ({
      field: w.field,
      label: FIELD_LABELS[w.field] || w.field,
      category: FIELD_CATEGORY[w.field] || 'Other',
      message: w.message,
      status: 'PENDING' as DocStatus,
    })),
  ];

  const uploadedCount = items.filter(i => i.status === 'UPLOADED').length;
  const missingCount = items.filter(i => i.status === 'MISSING').length;
  const totalCount = items.length;

  // Group by category
  const grouped = CATEGORY_ORDER
    .filter(cat => items.some(i => i.category === cat))
    .map(cat => ({ category: cat, items: items.filter(i => i.category === cat) }));

  // Add "Other" category if any
  const otherItems = items.filter(i => !CATEGORY_ORDER.includes(i.category as any));
  if (otherItems.length > 0) {
    grouped.push({ category: 'Other', items: otherItems });
  }

  return (
    <SectionCard icon="folder_open" title="Documents" onGoTo={() => onNavigate('documents')} goToLabel="Go to Documents →">
      <div className="flex flex-col gap-3">
        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div
            className="flex-1 h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--cr-surface-container-highest)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${documentReadinessPct}%`,
                backgroundColor: documentReadinessPct >= 80 ? '#16a34a' : documentReadinessPct >= 50 ? '#d97706' : '#dc2626',
              }}
            />
          </div>
          <span className="text-xs font-bold" style={{ color: 'var(--cr-on-surface-variant)', fontFamily: 'var(--cr-font-display)' }}>
            {documentReadinessPct}% ({uploadedCount}/{totalCount})
          </span>
        </div>

        {/* Summary pills */}
        <div className="flex items-center gap-2">
          {uploadedCount > 0 && <StatusPill label={`${uploadedCount} Uploaded`} color="#16a34a" bg="#f0fdf4" />}
          {missingCount > 0 && <StatusPill label={`${missingCount} Missing`} color="#dc2626" bg="#fef2f2" />}
          {(totalCount - uploadedCount - missingCount > 0) && (
            <StatusPill label={`${totalCount - uploadedCount - missingCount} Pending`} color="#d97706" bg="#fffbeb" />
          )}
        </div>

        {/* Grouped checklist */}
        {grouped.map(group => (
          <div key={group.category} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 mt-1">
              <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--cr-outline)' }}>
                {CATEGORY_ICON[group.category] || 'description'}
              </span>
              <span className="text-[11px] font-bold uppercase" style={{ color: 'var(--cr-on-surface-variant)', fontFamily: 'var(--cr-font-display)' }}>
                {group.category}
              </span>
            </div>
            {group.items.map(item => {
              const style = STATUS_STYLES[item.status];
              const navTab = FIELD_TO_TAB[item.field];
              return (
                <div
                  key={item.field}
                  className="flex items-center justify-between py-1 px-2 rounded cursor-pointer transition-colors"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--cr-surface-container-high)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  onClick={() => navTab && onNavigate(navTab)}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]" style={{ color: style.text }}>
                      {style.icon}
                    </span>
                    <span className="text-sm" style={{ color: 'var(--cr-on-surface)' }}>
                      {item.label}
                    </span>
                  </div>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                    style={{ backgroundColor: style.bg, color: style.text, border: `1px solid ${style.border}` }}
                  >
                    {item.status}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </SectionCard>
  );
};

// ── Section 7: Tasks (Next Actions) ────────────────────────────────────

const urgencyConfig: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  urgent: { color: '#dc2626', bg: '#fef2f2', icon: 'priority_high', label: 'Urgent' },
  warning: { color: '#d97706', bg: '#fffbeb', icon: 'schedule', label: 'Due Soon' },
  normal: { color: '#16a34a', bg: '#f0fdf4', icon: 'check_circle', label: 'On Track' },
};

const TasksSection: React.FC<{
  app: CreditApplication;
  readiness: ApplicationOverviewTabProps['readiness'];
  nextTab: DetailTab | null;
  nextGroupLabel: string;
  nextTabLabel: string;
  assigneeName?: string;
  dueDate?: string;
  urgency: 'urgent' | 'warning' | 'normal';
  onNavigate: (tab: DetailTab) => void;
}> = ({ app, readiness, nextTab, nextGroupLabel, nextTabLabel, assigneeName, dueDate, urgency, onNavigate }) => {
  const cfg = urgencyConfig[urgency] || urgencyConfig.normal;
  const errorCount = readiness?.errors?.length ?? 0;
  const warningCount = readiness?.warnings?.length ?? 0;

  return (
    <SectionCard icon="task_alt" title="Tasks">
      <div className="flex flex-col gap-3">
        {/* Priority next action */}
        {nextTab && (
          <div
            className="flex items-center gap-3 p-3 rounded"
            style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.color}30` }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: cfg.color }}>
              {cfg.icon}
            </span>
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{ color: 'var(--cr-on-surface)', fontFamily: 'var(--cr-font-display)' }}>
                  {nextTabLabel}
                </span>
                <StatusPill label={cfg.label} color={cfg.color} bg={cfg.bg} />
              </div>
              <span className="text-xs" style={{ color: 'var(--cr-outline)' }}>
                {nextGroupLabel}
              </span>
              {(assigneeName || dueDate) && (
                <div className="flex items-center gap-3 mt-1">
                  {assigneeName && (
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--cr-outline)' }}>person</span>
                      <span className="text-xs" style={{ color: 'var(--cr-on-surface-variant)' }}>{assigneeName}</span>
                    </div>
                  )}
                  {dueDate && (
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--cr-outline)' }}>schedule</span>
                      <span className="text-xs" style={{ color: 'var(--cr-on-surface-variant)' }}>{dueDate}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => onNavigate(nextTab)}
              className="shrink-0 px-3 py-1.5 rounded text-xs font-bold"
              style={{ backgroundColor: 'var(--cr-primary)', color: 'var(--cr-on-primary)', border: 'none', cursor: 'pointer' }}
            >
              Go →
            </button>
          </div>
        )}

        {/* Error / Warning counts */}
        {(errorCount > 0 || warningCount > 0) && (
          <div className="flex flex-col gap-1.5">
            {errorCount > 0 && (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ backgroundColor: '#fef2f2' }}>
                <span className="material-symbols-outlined text-[16px]" style={{ color: '#dc2626' }}>error</span>
                <span className="text-xs font-semibold" style={{ color: '#dc2626' }}>
                  {errorCount} section{errorCount !== 1 ? 's' : ''} incomplete
                </span>
              </div>
            )}
            {warningCount > 0 && (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ backgroundColor: '#fffbeb' }}>
                <span className="material-symbols-outlined text-[16px]" style={{ color: '#d97706' }}>warning</span>
                <span className="text-xs font-semibold" style={{ color: '#d97706' }}>
                  {warningCount} section{warningCount !== 1 ? 's' : ''} with warnings
                </span>
              </div>
            )}
          </div>
        )}

        {/* Empty state when no tasks */}
        {!nextTab && errorCount === 0 && warningCount === 0 && (
          <div className="text-center py-3">
            <span className="material-symbols-outlined text-2xl mb-1 block" style={{ color: '#16a34a' }}>check_circle</span>
            <p className="text-sm" style={{ color: 'var(--cr-on-surface-variant)' }}>All tasks completed</p>
          </div>
        )}
      </div>
    </SectionCard>
  );
};

// ── Main Component ──────────────────────────────────────────────────────

const ApplicationOverviewTab: React.FC<ApplicationOverviewTabProps> = ({
  app,
  facilities,
  readiness,
  slaDaysLeft,
  formatTimeAgo,
  onNavigate,
  transitions,
  currentState,
  phaseCompletion,
  commentPreviews,
  onAddNote,
  onOpenComments,
  nextTab,
  nextGroupLabel,
  nextTabLabel,
  assigneeName,
  dueDate,
  urgency,
  progressPct,
  documentReadinessPct,
  workflowVelocityPct,
  currentJourneyIndex,
  segment,
}) => {
  return (
    <div className="p-6 flex flex-col gap-6">
      {/* ── Section 1: Credit Risk Snapshot ── */}
      <RiskSnapshotSection app={app} onNavigate={onNavigate} />

      {/* ── Section 1b: Credit Decision Summary (Phase 4 explainability) ── */}
      <CreditDecisionSummaryCard application={app} />

      {/* ── Section 2: Financial Trend Analysis ── */}
      <FinancialTrendSection app={app} />

      {/* ── Section 3: Approval Workflow ── */}
      <ApprovalWorkflowSection app={app} onNavigate={onNavigate} />

      {/* ── Section 4: Recent Activities ── */}
      <RecentActivitiesSection
        applicationId={app.id}
        formatTimeAgo={formatTimeAgo}
        onNavigate={onNavigate}
      />

      {/* ── Two-column layout for lower sections ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Section 5: Borrower Profile ── */}
        <BorrowerProfileSection app={app} onNavigate={onNavigate} />

        {/* ── Section 6: Documents ── */}
        <DocumentsSection readiness={readiness} documentReadinessPct={documentReadinessPct} onNavigate={onNavigate} />
      </div>

      {/* ── Health Summary Bar ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1 p-3 rounded" style={{ backgroundColor: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)' }}>
          <span className="text-[11px] font-bold uppercase" style={{ color: 'var(--cr-outline)', fontFamily: 'var(--cr-font-display)', letterSpacing: 'var(--cr-tracking-label)' }}>
            Completion
          </span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold" style={{ color: progressPct >= 80 ? '#16a34a' : progressPct >= 50 ? '#d97706' : '#dc2626', fontFamily: 'var(--cr-font-display)' }}>
              {progressPct}%
            </span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--cr-surface-container-highest)' }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, backgroundColor: progressPct >= 80 ? '#16a34a' : progressPct >= 50 ? '#d97706' : '#dc2626' }} />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1 p-3 rounded" style={{ backgroundColor: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)' }}>
          <span className="text-[11px] font-bold uppercase" style={{ color: 'var(--cr-outline)', fontFamily: 'var(--cr-font-display)', letterSpacing: 'var(--cr-tracking-label)' }}>
            Doc Readiness
          </span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold" style={{ color: documentReadinessPct >= 80 ? '#16a34a' : documentReadinessPct >= 50 ? '#d97706' : '#dc2626', fontFamily: 'var(--cr-font-display)' }}>
              {documentReadinessPct}%
            </span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--cr-surface-container-highest)' }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${documentReadinessPct}%`, backgroundColor: documentReadinessPct >= 80 ? '#16a34a' : documentReadinessPct >= 50 ? '#d97706' : '#dc2626' }} />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1 p-3 rounded" style={{ backgroundColor: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)' }}>
          <span className="text-[11px] font-bold uppercase" style={{ color: 'var(--cr-outline)', fontFamily: 'var(--cr-font-display)', letterSpacing: 'var(--cr-tracking-label)' }}>
            Velocity
          </span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold" style={{ color: workflowVelocityPct >= 60 ? '#16a34a' : workflowVelocityPct >= 30 ? '#d97706' : '#dc2626', fontFamily: 'var(--cr-font-display)' }}>
              {workflowVelocityPct}%
            </span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--cr-surface-container-highest)' }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${workflowVelocityPct}%`, backgroundColor: workflowVelocityPct >= 60 ? '#16a34a' : workflowVelocityPct >= 30 ? '#d97706' : '#dc2626' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplicationOverviewTab;