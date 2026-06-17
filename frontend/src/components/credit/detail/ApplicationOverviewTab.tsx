/**
 * ApplicationOverviewTab — 6-section overview dashboard for the credit application detail page.
 *
 * Sections: Borrower Profile, Documents, Tasks, Workflow, Communications, Timeline.
 * Uses Financial Core design tokens (--cr-*).
 */
import React, { useEffect, useState } from 'react';
import creditService, {
  CreditApplication,
  CreditFacility,
  CreditAuditEvent,
  ApplicationTransition,
  ApplicationState,
} from '../../../services/credit.service';
import {
  DetailTab,
  formatCurrency,
  PRODUCT_LABELS,
  STEPPER_STAGES,
  TAB_GROUPS,
} from '../../../../pages/credit/creditUtils';
import { getBorrowerDisplayName } from '../BorrowerSummaryCard';

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

// ── Section 1: Borrower Profile ────────────────────────────────────────

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

// ── Section 2: Documents ───────────────────────────────────────────────

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

// ── Section 3: Tasks (Next Actions) ────────────────────────────────────

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

// ── Section 4: Workflow (Pipeline Stepper) ──────────────────────────────

const WorkflowSection: React.FC<{
  currentState: ApplicationState;
  phaseCompletion: Record<string, string>;
  slaDaysLeft: number | null;
  onNavigate: (tab: DetailTab) => void;
}> = ({ currentState, phaseCompletion, slaDaysLeft, onNavigate }) => {
  const currentStageIdx = STEPPER_STAGES.findIndex(s => s.states.includes(currentState));

  return (
    <SectionCard icon="account_tree" title="Workflow">
      <div className="flex flex-col gap-2">
        {STEPPER_STAGES.map((stage, idx) => {
          const isComplete = idx < currentStageIdx;
          const isCurrent = idx === currentStageIdx;
          const isFuture = idx > currentStageIdx;
          const phaseStatus = phaseCompletion[stage.key];
          const isOptional = phaseStatus === 'optional';

          // Color coding
          let circleBg: string, circleColor: string, icon: string, labelColor: string;
          if (isComplete) {
            circleBg = '#16a34a';
            circleColor = '#fff';
            icon = 'check';
            labelColor = 'var(--cr-on-surface)';
          } else if (isCurrent) {
            circleBg = 'var(--cr-primary)';
            circleColor = 'var(--cr-on-primary)';
            icon = 'hourglass_top';
            labelColor = 'var(--cr-on-surface)';
          } else {
            circleBg = 'var(--cr-surface-container-high)';
            circleColor = 'var(--cr-outline)';
            icon = `${idx + 1}`;
            labelColor = 'var(--cr-outline)';
          }

          const navTab = STAGE_TO_TAB[stage.key];
          const isClickable = isComplete || isCurrent;

          return (
            <div
              key={stage.key}
              className="flex items-start gap-3 py-1.5"
            >
              {/* Circle + connector */}
              <div className="flex flex-col items-center">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: circleBg, color: circleColor }}
                >
                  {typeof icon === 'number' ? (
                    <span className="text-xs font-bold">{icon}</span>
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">{icon}</span>
                  )}
                </div>
                {idx < STEPPER_STAGES.length - 1 && (
                  <div className="w-0.5 h-3" style={{ backgroundColor: isComplete ? '#16a34a' : 'var(--cr-outline-variant)' }} />
                )}
              </div>

              {/* Content */}
              <div
                className="flex-1 flex items-center justify-between cursor-pointer"
                onClick={() => isClickable && navTab && onNavigate(navTab)}
                style={{ opacity: isFuture && !isOptional ? 0.5 : 1 }}
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: labelColor, fontFamily: 'var(--cr-font-display)' }}>
                      {stage.label}
                    </span>
                    {isOptional && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--cr-surface-container-high)', color: 'var(--cr-outline)' }}>
                        Optional
                      </span>
                    )}
                    {isCurrent && slaDaysLeft !== null && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{
                          backgroundColor: slaDaysLeft <= 2 ? '#fef2f2' : slaDaysLeft <= 5 ? '#fffbeb' : '#f0fdf4',
                          color: slaDaysLeft <= 2 ? '#dc2626' : slaDaysLeft <= 5 ? '#d97706' : '#16a34a',
                        }}
                      >
                        {slaDaysLeft <= 0 ? 'Overdue' : `${slaDaysLeft}d left`}
                      </span>
                    )}
                  </div>
                  {/* Show phase completion status for current */}
                  {isCurrent && phaseStatus && (
                    <span className="text-[11px]" style={{ color: 'var(--cr-on-surface-variant)' }}>
                      {phaseStatus === 'complete' ? 'Complete' : phaseStatus === 'incomplete' ? 'In progress' : 'Optional'}
                    </span>
                  )}
                </div>
                {isClickable && navTab && (
                  <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--cr-primary)' }}>
                    north_east
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
};

// ── Section 5: Communications ───────────────────────────────────────────

const CommunicationsSection: React.FC<{
  commentPreviews: CommentPreview[];
  onAddNote: (text: string) => void;
  onOpenComments: () => void;
}> = ({ commentPreviews, onAddNote, onOpenComments }) => {
  const [noteText, setNoteText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (noteText.trim()) {
      onAddNote(noteText.trim());
      setNoteText('');
    }
  };

  return (
    <SectionCard icon="forum" title="Communications" onGoTo={onOpenComments} goToLabel="Go to Comments →">
      <div className="flex flex-col gap-3">
        {commentPreviews.length === 0 ? (
          <div className="text-center py-3">
            <span className="material-symbols-outlined text-2xl mb-1 block" style={{ color: 'var(--cr-outline)' }}>
              chat_bubble_outline
            </span>
            <p className="text-sm" style={{ color: 'var(--cr-on-surface-variant)' }}>No comments yet</p>
          </div>
        ) : (
          commentPreviews.slice(0, 3).map(comment => (
            <div
              key={comment.id}
              className="flex gap-2.5 p-2 rounded cursor-pointer transition-colors"
              style={{ backgroundColor: 'transparent' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--cr-surface-container-high)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              onClick={onOpenComments}
            >
              <div
                className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs"
                style={{ backgroundColor: 'var(--cr-primary-container)', color: 'var(--cr-on-primary-container)' }}
              >
                {comment.author.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold truncate" style={{ color: 'var(--cr-on-surface)' }}>
                    {comment.author}
                  </span>
                  <span className="text-[11px] shrink-0" style={{ color: 'var(--cr-outline)' }}>
                    {comment.timeAgo}
                  </span>
                </div>
                <p className="text-xs truncate" style={{ color: 'var(--cr-on-surface-variant)' }}>
                  {comment.content}
                </p>
              </div>
            </div>
          ))
        )}

        {/* Add note input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Add a note…"
            className="flex-1 text-sm px-3 py-2 rounded"
            style={{
              backgroundColor: 'var(--cr-surface-container-high)',
              border: '1px solid var(--cr-outline-variant)',
              color: 'var(--cr-on-surface)',
              outline: 'none',
              fontFamily: 'var(--cr-font-body)',
            }}
          />
          <button
            type="submit"
            disabled={!noteText.trim()}
            className="px-3 py-2 rounded text-xs font-bold"
            style={{
              backgroundColor: noteText.trim() ? 'var(--cr-primary)' : 'var(--cr-surface-container-high)',
              color: noteText.trim() ? 'var(--cr-on-primary)' : 'var(--cr-outline)',
              border: 'none',
              cursor: noteText.trim() ? 'pointer' : 'default',
            }}
          >
            Send
          </button>
        </form>
      </div>
    </SectionCard>
  );
};

// ── Section 6: Timeline ─────────────────────────────────────────────────

const TimelineSection: React.FC<{
  applicationId: string;
  currentState: ApplicationState;
  formatTimeAgo: (date: Date) => string;
  onNavigate: (tab: DetailTab) => void;
}> = ({ applicationId, currentState, formatTimeAgo, onNavigate }) => {
  const [events, setEvents] = useState<CreditAuditEvent[]>([]);

  useEffect(() => {
    let mounted = true;
    creditService.getApplicationAudit(applicationId)
      .then(data => {
        if (mounted) setEvents(data.slice(0, 5));
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [applicationId]);

  const eventTypeIcon: Record<string, string> = {
    STATE_TRANSITION: 'swap_horiz',
    DOCUMENT_UPLOADED: 'upload_file',
    DOCUMENT_VERIFIED: 'verified',
    COMMENT_ADDED: 'chat_bubble',
    SCORE_UPDATED: 'assessment',
    APPROVAL_DECISION: 'how_to_reg',
  };

  const eventTypeLabel: Record<string, string> = {
    STATE_TRANSITION: 'State changed',
    DOCUMENT_UPLOADED: 'Document uploaded',
    DOCUMENT_VERIFIED: 'Document verified',
    COMMENT_ADDED: 'Comment added',
    SCORE_UPDATED: 'Score updated',
    APPROVAL_DECISION: 'Approval decision',
  };

  if (events.length === 0) {
    return (
      <SectionCard icon="history" title="Timeline" onGoTo={() => onNavigate('audit')} goToLabel="Go to Audit Trail →">
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
    <SectionCard icon="history" title="Timeline" onGoTo={() => onNavigate('audit')} goToLabel="Go to Audit Trail →">
      <div className="flex flex-col gap-0">
        {events.map((event, idx) => {
          const icon = eventTypeIcon[event.eventType] || 'circle';
          const label = eventTypeLabel[event.eventType] || event.action || event.eventType;
          const actor = event.actor ? `${event.actor.firstName} ${event.actor.lastName}` : 'System';
          const timeAgo = event.createdAt ? formatTimeAgo(new Date(event.createdAt)) : '';

          return (
            <div key={event.id} className="flex items-start gap-3 relative">
              {/* Dot + connector */}
              <div className="flex flex-col items-center">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: idx === 0 ? 'var(--cr-primary-container)' : 'var(--cr-surface-container-high)',
                    color: idx === 0 ? 'var(--cr-on-primary-container)' : 'var(--cr-outline)',
                  }}
                >
                  <span className="material-symbols-outlined text-[14px]">{icon}</span>
                </div>
                {idx < events.length - 1 && (
                  <div className="w-0.5 h-4" style={{ backgroundColor: 'var(--cr-outline-variant)' }} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-3">
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
                  <span className="text-[11px]" style={{ color: 'var(--cr-outline)' }}>{actor}</span>
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
}) => {
  return (
    <div className="p-6">
      {/* Health Summary Bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
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

      {/* 6-section grid: 2 columns on lg+, 1 on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BorrowerProfileSection app={app} onNavigate={onNavigate} />
        <DocumentsSection readiness={readiness} documentReadinessPct={documentReadinessPct} onNavigate={onNavigate} />
        <TasksSection
          app={app}
          readiness={readiness}
          nextTab={nextTab}
          nextGroupLabel={nextGroupLabel}
          nextTabLabel={nextTabLabel}
          assigneeName={assigneeName}
          dueDate={dueDate}
          urgency={urgency}
          onNavigate={onNavigate}
        />
        <WorkflowSection
          currentState={currentState}
          phaseCompletion={phaseCompletion}
          slaDaysLeft={slaDaysLeft}
          onNavigate={onNavigate}
        />
        <CommunicationsSection
          commentPreviews={commentPreviews}
          onAddNote={onAddNote}
          onOpenComments={onOpenComments}
        />
        <TimelineSection
          applicationId={app.id}
          currentState={currentState}
          formatTimeAgo={formatTimeAgo}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
};

export default ApplicationOverviewTab;