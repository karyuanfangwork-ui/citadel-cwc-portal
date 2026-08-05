/**
 * ApplicationSummaryPanel — Left sidebar of the Application 360 Workspace.
 *
 * Displays: App ID + completion %, borrower, amount, product, RM/Analyst,
 * risk rating, SLA timer, quick actions, and primary CTA.
 *
 * Uses Financial Core design tokens (--cr-*).
 */
import React from 'react';
import { CreditApplication, CreditFacility, ApplicationTransition, ApplicationState } from '../../../services/credit.service';
import { formatCurrency, PRODUCT_LABELS } from '../../../../pages/credit/creditUtils';
import StateBadge from '../StateBadge';
import UserAssignChip from '../UserAssignChip';
import { getBorrowerDisplayName } from '../BorrowerSummaryCard';

// ── Percentage pill badge (replaces ProgressRing) ──
// Displayed next to the app number in the summary panel header.

interface ApplicationSummaryPanelProps {
  app: CreditApplication;
  facilities: CreditFacility[];
  progressPct: number;
  completedPhases: number;
  totalPhases: number;
  currentState: ApplicationState;
  transitions: ApplicationTransition[];
  canWrite: boolean;
  canAdmin: boolean;
  onNavigate: (tab: string) => void;
}

const ApplicationSummaryPanel: React.FC<ApplicationSummaryPanelProps> = ({
  app,
  facilities,
  progressPct,
  completedPhases,
  totalPhases,
  currentState,
  transitions,
  canWrite,
  canAdmin,
  onNavigate,
}) => {
  const borrowerName = getBorrowerDisplayName(app.borrowerProfile);

  const borrowerInitials = borrowerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  // Primary CTA: first available positive transition
  const primaryTransition = transitions.find(t =>
    !['close', 'reject', 'withdraw', 'return_to_draft'].includes(t.action) &&
    t.toState !== 'REJECTED' && t.toState !== 'KYC_REJECTED' && t.toState !== 'WITHDRAWN'
  );
  const rejectTransition = transitions.find(t =>
    t.toState === 'REJECTED' || t.toState === 'KYC_REJECTED' || t.toState === 'WITHDRAWN'
  );
  const closeTransition = transitions.find(t => t.action === 'close');

  // SLA timer calculation
  const slaDaysLeft = (() => {
    if (!app.createdAt) return null;
    const created = new Date(app.createdAt);
    // Default SLA: 14 days from creation (configurable per product in future)
    const slaTarget = new Date(created.getTime() + 14 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const diffMs = slaTarget.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays;
  })();

  const slaColor = slaDaysLeft === null ? 'var(--cr-outline)'
    : slaDaysLeft <= 0 ? 'var(--cr-error)'
    : slaDaysLeft <= 3 ? '#d97706'
    : '#16a34a';

  return (
    <aside
      className="hidden lg:flex flex-col w-72 shrink-0 overflow-y-auto cr-scroll"
      style={{
        backgroundColor: 'var(--cr-surface-container-lowest)',
        borderRight: '1px solid var(--cr-outline-variant)',
      }}
    >
      <div className="flex flex-col gap-4 p-4">
        {/* ── App ID + Completion Pill ── */}
        <div>
          <div className="flex justify-between items-center">
            <p
              className="uppercase tracking-wider font-bold"
              style={{ fontFamily: 'var(--cr-font-display)', fontSize: 'var(--cr-text-label-md)', color: 'var(--cr-on-tertiary-container)', letterSpacing: 'var(--cr-tracking-label)' }}
            >
              {app.applicationNo || `#${app.id?.slice(-8) ?? ''}`}
            </p>
            <span
              className="px-2 py-0.5 rounded font-bold border"
              style={{
                fontSize: 11,
                backgroundColor: 'rgba(49, 107, 243, 0.1)',
                color: 'var(--cr-secondary-container)',
                borderColor: 'rgba(49, 107, 243, 0.2)',
                fontFamily: 'var(--cr-font-display)',
              }}
              title={`${progressPct}% complete`}
            >
              {progressPct}%
            </span>
          </div>
          <h2
            className="mt-1 font-bold leading-tight"
            style={{ fontFamily: 'var(--cr-font-display)', fontSize: 'var(--cr-text-headline-md)', color: 'var(--cr-on-surface)' }}
          >
            {borrowerName}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <StateBadge state={currentState} size="sm" />
          </div>
        </div>

        {/* ── Key Financials ── */}
        <div
          className="grid grid-cols-1 gap-3 py-3"
          style={{ borderTop: '1px solid var(--cr-outline-variant)', borderBottom: '1px solid var(--cr-outline-variant)' }}
        >
          <div className="flex flex-col">
            <span className="font-bold uppercase" style={{ fontFamily: 'var(--cr-font-display)', fontSize: 'var(--cr-text-label-md)', color: 'var(--cr-outline)', letterSpacing: 'var(--cr-tracking-label)' }}>
              Requested Amount
            </span>
            <span className="font-bold" style={{ fontFamily: 'var(--cr-font-body)', fontSize: 'var(--cr-text-body-md)', color: 'var(--cr-on-surface)' }}>
              {formatCurrency(app.requestedAmount, app.currency)}
            </span>
          </div>
          {app.requestedTenor != null && (
            <div className="flex flex-col">
              <span className="font-bold uppercase" style={{ fontFamily: 'var(--cr-font-display)', fontSize: 'var(--cr-text-label-md)', color: 'var(--cr-outline)', letterSpacing: 'var(--cr-tracking-label)' }}>
                Tenure
              </span>
              <span style={{ fontFamily: 'var(--cr-font-body)', fontSize: 'var(--cr-text-body-sm)', color: 'var(--cr-on-surface)' }}>
                {app.requestedTenor} months
              </span>
            </div>
          )}
          {app.productType && (
            <div className="flex flex-col">
              <span className="font-bold uppercase" style={{ fontFamily: 'var(--cr-font-display)', fontSize: 'var(--cr-text-label-md)', color: 'var(--cr-outline)', letterSpacing: 'var(--cr-tracking-label)' }}>
                Product Type
              </span>
              <span style={{ fontFamily: 'var(--cr-font-body)', fontSize: 'var(--cr-text-body-sm)', color: 'var(--cr-on-surface)' }}>
                {PRODUCT_LABELS[app.productType] || app.productName || app.productType}
              </span>
            </div>
          )}
        </div>

        {/* ── Personnel ── */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col">
            <span className="font-bold uppercase" style={{ fontFamily: 'var(--cr-font-display)', fontSize: 'var(--cr-text-label-md)', color: 'var(--cr-outline)', letterSpacing: 'var(--cr-tracking-label)' }}>
              Relationship Manager
            </span>
            <UserAssignChip
              label="RM"
              value={app.rm ?? null}
              applicationId={app.id}
              field="assignedRmId"
              roleFilters={['CREDIT_RM', 'CREDIT_MANAGER', 'ADMIN']}
              disabled={['CLOSED', 'WITHDRAWN', 'ACTIVE', 'DISBURSED'].includes(app.state ?? '')}
              onUpdated={() => {}}
            />
          </div>
          <div className="flex flex-col">
            <span className="font-bold uppercase" style={{ fontFamily: 'var(--cr-font-display)', fontSize: 'var(--cr-text-label-md)', color: 'var(--cr-outline)', letterSpacing: 'var(--cr-tracking-label)' }}>
              Analyst
            </span>
            <UserAssignChip
              label="Analyst"
              value={app.analyst ?? null}
              applicationId={app.id}
              field="assignedAnalystId"
              roleFilters={['CREDIT_ANALYST', 'CREDIT_MANAGER', 'ADMIN']}
              disabled={['CLOSED', 'WITHDRAWN', 'ACTIVE', 'DISBURSED'].includes(app.state ?? '')}
              onUpdated={() => {}}
            />
          </div>
        </div>

        {/* ── Risk & SLA ── */}
        <div className="flex flex-col gap-1.5 pt-1">
          {app.riskRating && (
            <div className="flex justify-between items-center" style={{ fontSize: 'var(--cr-text-body-sm)' }}>
              <span style={{ color: 'var(--cr-outline)' }}>Risk Level</span>
              <span className="font-bold" style={{
                color: ['AAA', 'AA', 'A'].includes(app.riskRating) ? '#16a34a'
                  : ['BBB', 'BB'].includes(app.riskRating) ? '#d97706'
                  : 'var(--cr-error)'
              }}>
                {app.riskRating}
              </span>
            </div>
          )}
          {slaDaysLeft !== null && (
            <div className="flex justify-between items-center" style={{ fontSize: 'var(--cr-text-body-sm)' }}>
              <span style={{ color: 'var(--cr-outline)' }}>SLA Timer</span>
              <span className="font-bold" style={{ color: slaColor }}>
                {slaDaysLeft <= 0 ? 'Overdue' : slaDaysLeft === 1 ? '1 Day Remaining' : `${slaDaysLeft} Days Remaining`}
              </span>
            </div>
          )}
        </div>

        {/* ── Quick Actions ── */}
        <div className="flex flex-col gap-1.5 pt-1">
          <p
            className="uppercase pb-1 font-bold"
            style={{ fontFamily: 'var(--cr-font-display)', fontSize: 'var(--cr-text-label-md)', color: 'var(--cr-outline)', letterSpacing: 'var(--cr-tracking-label)' }}
          >
            Quick Actions
          </p>
          <button
            onClick={() => onNavigate('approvals')}
            className="w-full flex items-center gap-3 px-3 py-2 text-left border transition-colors"
            style={{
              fontSize: 'var(--cr-text-body-sm)',
              color: 'var(--cr-on-surface-variant)',
              borderColor: 'rgba(198, 198, 205, 0.3)',
              borderRadius: 'var(--cr-radius)',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'var(--cr-font-body)',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--cr-surface-container-high)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person_add</span>
            Assign Officer
          </button>
          <button
            onClick={() => onNavigate('comments')}
            className="w-full flex items-center gap-3 px-3 py-2 text-left border transition-colors"
            style={{
              fontSize: 'var(--cr-text-body-sm)',
              color: 'var(--cr-on-surface-variant)',
              borderColor: 'rgba(198, 198, 205, 0.3)',
              borderRadius: 'var(--cr-radius)',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'var(--cr-font-body)',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--cr-surface-container-high)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>mail</span>
            Request Information
          </button>
          <button
            onClick={() => onNavigate('documents')}
            className="w-full flex items-center gap-3 px-3 py-2 text-left border transition-colors"
            style={{
              fontSize: 'var(--cr-text-body-sm)',
              color: 'var(--cr-on-surface-variant)',
              borderColor: 'rgba(198, 198, 205, 0.3)',
              borderRadius: 'var(--cr-radius)',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'var(--cr-font-body)',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--cr-surface-container-high)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>upload_file</span>
            Request Documents
          </button>
          <button
            onClick={() => onNavigate('documents')}
            className="w-full flex items-center gap-3 px-3 py-2 text-left border transition-colors"
            style={{
              fontSize: 'var(--cr-text-body-sm)',
              color: 'var(--cr-on-surface-variant)',
              borderColor: 'rgba(198, 198, 205, 0.3)',
              borderRadius: 'var(--cr-radius)',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'var(--cr-font-body)',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--cr-surface-container-high)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>checklist</span>
            Generate Checklist
          </button>
          <button
            onClick={() => onNavigate('audit')}
            className="w-full flex items-center gap-3 px-3 py-2 text-left border transition-colors"
            style={{
              fontSize: 'var(--cr-text-body-sm)',
              color: 'var(--cr-on-surface-variant)',
              borderColor: 'rgba(198, 198, 205, 0.3)',
              borderRadius: 'var(--cr-radius)',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'var(--cr-font-body)',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--cr-surface-container-high)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>history</span>
            View Audit Trail
          </button>
        </div>

        {/* ── Primary CTA ── */}
        {primaryTransition && canWrite && (
          <div className="pt-2">
            <button
              onClick={() => onNavigate('approvals')}
              className="w-full flex items-center justify-center gap-2 py-2.5 font-bold transition-all hover:opacity-90 active:scale-[0.98]"
              style={{
                background: 'var(--cr-primary)',
                color: 'var(--cr-on-primary)',
                borderRadius: 'var(--cr-radius-lg)',
                fontSize: 'var(--cr-text-body-sm)',
                fontFamily: 'var(--cr-font-display)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>assessment</span>
              {currentState === 'CREDIT_ASSESSMENT' ? 'Open Credit Assessment' : 'Proceed'}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default ApplicationSummaryPanel;