/**
 * ApplicationWorkspaceHeader — Sticky 56px global header of the Application 360 Workspace.
 *
 * Compact bar: left (breadcrumb + appNo + borrowerName + segment badge),
 * center (state badge + transition buttons),
 * right (actions: export, clone/renew, more menu).
 *
 * Uses Financial Core design tokens (--cr-*).
 */
import React, { useState } from 'react';
import { CreditApplication, ApplicationTransition, ApplicationState, ApplicationSignoff } from '../../../services/credit.service';
import { STATE_LABELS, BorrowerSegment, SEGMENT_LABELS, SEGMENT_COLORS } from '../../../../pages/credit/creditUtils';
import { getBorrowerDisplayName } from '../BorrowerSummaryCard';

interface ApplicationWorkspaceHeaderProps {
  app: CreditApplication;
  currentState: ApplicationState;
  transitions: ApplicationTransition[];
  canWrite: boolean;
  canAdmin: boolean;
  allSigned: boolean;
  signoffs: ApplicationSignoff[];
  esignReady: { ready: boolean; signedLoo: { id: string; fileName: string; verificationStatus: string } | null } | null;
  segment: BorrowerSegment;
  onShowTransitionDialog: (action: string) => void;
  onExportCaMemo: () => void;
  onExportSummaryPdf?: () => void;
  isOverview?: boolean;
  contextOpen?: boolean;
  onToggleContext?: () => void;
}

const ApplicationWorkspaceHeader: React.FC<ApplicationWorkspaceHeaderProps> = ({
  app,
  currentState,
  transitions,
  canWrite,
  canAdmin,
  allSigned,
  signoffs,
  esignReady,
  segment,
  onShowTransitionDialog,
  onExportCaMemo,
  onExportSummaryPdf,
  isOverview = false,
  contextOpen = false,
  onToggleContext,
}) => {
  const [showMore, setShowMore] = useState(false);
  // Categorize transitions for the action bar
  const positiveTransitions = transitions.filter(t =>
    !['close', 'reject', 'withdraw', 'return_to_draft'].includes(t.action) &&
    t.toState !== 'REJECTED' && t.toState !== 'KYC_REJECTED' && t.toState !== 'WITHDRAWN'
  );
  const negativeTransitions = transitions.filter(t =>
    t.toState === 'REJECTED' || t.toState === 'KYC_REJECTED' || t.toState === 'WITHDRAWN'
  );
  const neutralTransitions = transitions.filter(t =>
    ['hold', 'return_to_draft'].includes(t.action)
  );
  const closeTransition = transitions.find(t => t.action === 'close');

  const statusLabel = STATE_LABELS[currentState] || currentState.replace(/_/g, ' ');
  const segmentColor = SEGMENT_COLORS[segment];
  const borrowerTypeLabel: Record<string, string> = {
    INDIVIDUAL: 'Individual',
    JOINT: 'Joint',
    SOLE_PROPRIETOR: 'Sole Proprietor',
    CORPORATE: 'Corporate',
  };
  const displaySegmentLabel = borrowerTypeLabel[app.borrowerProfile?.borrowerType ?? ''] || SEGMENT_LABELS[segment];
  const borrowerName = getBorrowerDisplayName(app.borrowerProfile) || app.id.slice(0, 8);
  const appNo = app.applicationNo || app.id.slice(0, 8);

  return (
    <div
      className="sticky top-0 z-30 flex items-center gap-3 px-5"
      style={{
        height: 56,
        backgroundColor: 'var(--cr-surface-container-lowest)',
        borderBottom: '1px solid var(--cr-outline-variant)',
      }}
    >
      {/* ── Left: Breadcrumb + Identity ── */}
      <div className="flex items-center gap-2 shrink-0 min-w-0">
        <span
          style={{
            fontFamily: 'var(--cr-font-body)',
            fontSize: 11,
            color: 'var(--cr-outline)',
          }}
          className="truncate"
        >
          {appNo}
        </span>
        <span style={{ fontSize: 11, color: 'var(--cr-outline-variant)' }}>·</span>
        <span
          style={{
            fontFamily: 'var(--cr-font-display)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--cr-on-surface)',
          }}
          className="truncate"
        >
          {borrowerName}
        </span>
        {/* Segment badge */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '1px 8px',
            borderRadius: 12,
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'var(--cr-font-display)',
            backgroundColor: segmentColor.bg,
            color: segmentColor.text,
            whiteSpace: 'nowrap',
          }}
        >
          {displaySegmentLabel}
        </span>
      </div>

      {/* ── Center: State + Actions ── */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Current state pill */}
        <span
          style={{
            fontFamily: 'var(--cr-font-display)',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--cr-on-surface-variant)',
            padding: '2px 10px',
            borderRadius: 'var(--cr-radius)',
            backgroundColor: 'var(--cr-surface-container-high)',
            whiteSpace: 'nowrap',
          }}
        >
          {statusLabel}
        </span>

        {/* Sign-off gate warning */}
        {currentState === 'CREDIT_ASSESSMENT' && !allSigned && (
          <span
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold"
            style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fbbf24', whiteSpace: 'nowrap' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
            Sign-off required
          </span>
        )}

        {/* Transition buttons — compact pill style */}
        {canWrite && transitions.length > 0 && (
          <>
            {neutralTransitions.map(t => (
              <button
                key={t.action}
                onClick={() => onShowTransitionDialog(t.action)}
                style={{
                  fontSize: 12,
                  fontFamily: 'var(--cr-font-body)',
                  backgroundColor: 'var(--cr-surface-container-high)',
                  color: 'var(--cr-on-surface-variant)',
                  border: '1px solid var(--cr-outline-variant)',
                  borderRadius: 'var(--cr-radius)',
                  padding: '4px 12px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.label || t.action.replace(/_/g, ' ')}
              </button>
            ))}
            {negativeTransitions.map(t => (
              <button
                key={t.action}
                onClick={() => onShowTransitionDialog(t.action)}
                style={{
                  fontSize: 12,
                  fontFamily: 'var(--cr-font-body)',
                  backgroundColor: isOverview ? 'transparent' : 'var(--cr-error)',
                  color: isOverview ? 'var(--cr-error)' : 'var(--cr-on-error)',
                  border: isOverview ? '1px solid var(--cr-error)' : 'none',
                  borderRadius: 'var(--cr-radius)',
                  padding: '4px 12px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.label || t.action.replace(/_/g, ' ')}
              </button>
            ))}
            {closeTransition && canAdmin && (
              <button
                onClick={() => onShowTransitionDialog('close')}
                style={{
                  fontSize: 12,
                  fontFamily: 'var(--cr-font-body)',
                  backgroundColor: '#fffbeb',
                  color: '#92400e',
                  border: '1px solid #f59e0b',
                  borderRadius: 'var(--cr-radius)',
                  padding: '4px 12px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Close Loan
              </button>
            )}
            {positiveTransitions.slice(0, 2).map((t, index) => {
              const isSignoffBlocked = t.action === 'submit_to_committee' && !allSigned;
              const isEsignBlocked = t.action === 'accept_offer' && esignReady !== null && !esignReady.ready;
              const isBlocked = isSignoffBlocked || isEsignBlocked;
              return (
                <button
                  key={t.action}
                  onClick={() => !isBlocked && onShowTransitionDialog(t.action)}
                  disabled={isBlocked}
                  style={{
                    fontSize: 12,
                    fontFamily: 'var(--cr-font-display)',
                    fontWeight: 700,
                    backgroundColor: isBlocked || (isOverview && index > 0) ? 'var(--cr-surface-container-high)' : 'var(--cr-secondary-container)',
                    color: isBlocked || (isOverview && index > 0) ? 'var(--cr-outline)' : 'var(--cr-on-secondary-container)',
                    border: isOverview && index > 0 ? '1px solid var(--cr-outline-variant)' : 'none',
                    borderRadius: 'var(--cr-radius)',
                    padding: '4px 12px',
                    cursor: isBlocked ? 'not-allowed' : 'pointer',
                    opacity: isBlocked ? 0.5 : 1,
                    whiteSpace: 'nowrap',
                  }}
                  title={isSignoffBlocked ? 'Complete all CA Memo sign-offs first' : isEsignBlocked ? 'Upload signed Letter of Offer first' : undefined}
                >
                  {t.label || t.action.replace(/_/g, ' ')}
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* ── Right: Utility actions ── */}
      <div className="relative flex items-center shrink-0">
        {onToggleContext && <button type="button" onClick={onToggleContext} aria-expanded={contextOpen} aria-controls="application-context-panel-responsive" className="mr-1 hidden items-center gap-1 rounded border px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 md:flex xl:hidden" style={{ borderColor: 'var(--cr-outline-variant)' }}>
          <span className="material-symbols-outlined text-sm" aria-hidden="true">tune</span>Context
        </button>}
        <button type="button" onClick={() => setShowMore(value => !value)} aria-expanded={showMore} aria-haspopup="menu" className="flex items-center gap-1 rounded border px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50" style={{ borderColor: 'var(--cr-outline-variant)' }}>
          More <span className="material-symbols-outlined text-sm" aria-hidden="true">expand_more</span>
        </button>
        {showMore && (
          <div role="menu" className="absolute right-0 top-full z-40 mt-1 min-w-48 rounded-lg border bg-white p-1 shadow-lg" style={{ borderColor: 'var(--cr-outline-variant)' }}>
            <button type="button" role="menuitem" onClick={() => { setShowMore(false); onExportCaMemo(); }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"><span className="material-symbols-outlined text-base" aria-hidden="true">description</span>Export CA Memo</button>
            {onExportSummaryPdf && <button type="button" role="menuitem" onClick={() => { setShowMore(false); onExportSummaryPdf(); }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"><span className="material-symbols-outlined text-base" aria-hidden="true">picture_as_pdf</span>Export Summary PDF</button>}
          </div>
        )}
      </div>
    </div>
  );
};

export default ApplicationWorkspaceHeader;
