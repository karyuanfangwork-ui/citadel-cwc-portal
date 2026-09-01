import React, { useState } from 'react';
import { ApplicationWorkspaceArea } from './applicationWorkspaceAreas';
import {
  ApplicationReadinessItem,
  ApplicationReadinessViewModel,
} from './applicationReadinessViewModel';

interface ApplicationReadinessPanelProps {
  viewModel: ApplicationReadinessViewModel;
  onNavigate: (area: ApplicationWorkspaceArea, tab: string) => void;
  onRetry?: () => void;
  onSubmit?: () => void;
}

const AREA_LABELS: Record<ApplicationWorkspaceArea, string> = {
  overview: 'Overview',
  'application-parties': 'Application & Parties',
  financials: 'Financials',
  'risk-compliance': 'Risk & Compliance',
  'assessment-recommendation': 'Assessment & Recommendation',
  'decision-completion': 'Decision & Completion',
  documents: 'Documents',
  'activity-audit': 'Activity & Audit',
};

const itemActionLabel = (item: ApplicationReadinessItem): string => {
  if (item.utility === 'documents') return 'Open Documents';
  if (item.targetArea) return `Go to ${AREA_LABELS[item.targetArea]}`;
  return 'Review Requirement';
};

const ReadinessItemRow: React.FC<{
  item: ApplicationReadinessItem;
  onNavigate: (area: ApplicationWorkspaceArea, tab: string) => void;
}> = ({ item, onNavigate }) => {
  const isBlocker = item.severity === 'blocker';
  const isWarning = item.severity === 'warning';
  const canNavigate = Boolean(item.targetArea && item.targetLocalTab);
  return (
    <li
      className="flex items-start gap-3 rounded-lg px-3 py-3"
      style={{ backgroundColor: isBlocker ? '#fef2f2' : isWarning ? '#fffbeb' : '#eff6ff' }}
    >
      <span
        className="material-symbols-outlined text-[18px] mt-0.5 shrink-0"
        aria-label={isBlocker ? 'Blocker' : isWarning ? 'Warning' : 'Complete'}
        style={{ color: isBlocker ? '#dc2626' : isWarning ? '#d97706' : '#2563eb' }}
      >
        {isBlocker ? 'cancel' : isWarning ? 'warning' : 'verified'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: isBlocker ? '#991b1b' : isWarning ? '#92400e' : '#1e40af' }}>
          {item.title}
        </p>
        {item.description && <p className="mt-1 text-xs leading-5" style={{ color: 'var(--cr-on-surface-variant)' }}>{item.description}</p>}
      </div>
      {canNavigate && (
        <button
          type="button"
          className="shrink-0 text-xs font-bold underline underline-offset-2"
          style={{ color: 'var(--cr-primary)', background: 'none', border: 0, cursor: 'pointer' }}
          onClick={() => onNavigate(item.targetArea!, item.targetLocalTab!)}
        >
          {itemActionLabel(item)}
        </button>
      )}
    </li>
  );
};

const ApplicationReadinessPanel: React.FC<ApplicationReadinessPanelProps> = ({
  viewModel,
  onNavigate,
  onRetry,
  onSubmit,
}) => {
  const [showSatisfied, setShowSatisfied] = useState(false);

  if (viewModel.status === 'loading') {
    return (
      <section aria-busy="true" aria-live="polite" className="rounded-xl p-4" style={{ backgroundColor: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)' }}>
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined animate-spin text-blue-700" aria-hidden="true">progress_activity</span>
          <div><h2 className="text-sm font-bold">Checking application readiness…</h2><p className="mt-1 text-xs" style={{ color: 'var(--cr-on-surface-variant)' }}>Verifying the latest server requirements.</p></div>
        </div>
      </section>
    );
  }

  if (viewModel.status === 'unavailable') {
    return (
      <section aria-live="polite" className="rounded-xl p-4" style={{ backgroundColor: '#fefce8', border: '1px solid #fde68a' }}>
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-600" aria-hidden="true">sync_problem</span>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-amber-900">Submission readiness could not be verified</h2>
            <p className="mt-1 text-xs text-amber-800">The server readiness check is unavailable. No ready state has been assumed.</p>
          </div>
          {onRetry && <button type="button" onClick={onRetry} className="text-xs font-bold underline text-amber-900">Retry</button>}
        </div>
      </section>
    );
  }

  const isReady = viewModel.status === 'ready' || viewModel.status === 'warning';
  const hasPrimaryNextAction = Boolean(viewModel.nextAction?.targetArea && viewModel.nextAction.targetTab);
  const secondaryBlockers = hasPrimaryNextAction ? viewModel.blockers.slice(1) : viewModel.blockers;
  return (
    <section aria-labelledby="application-readiness-heading" className="rounded-xl p-4" style={{ backgroundColor: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)' }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--cr-outline)', fontFamily: 'var(--cr-font-display)' }}>Application Readiness</p>
          {viewModel.status === 'blocked' && <p className="mt-1 text-sm font-semibold text-slate-700">What needs your attention</p>}
          <h2 id="application-readiness-heading" className="mt-1 text-lg font-bold" style={{ color: 'var(--cr-on-surface)' }}>
            {viewModel.status === 'blocked'
              ? viewModel.blockers.length > 0
                ? `${viewModel.blockers.length} item${viewModel.blockers.length === 1 ? ' is' : 's are'} preventing submission`
                : 'Readiness checks are incomplete'
              : viewModel.status === 'warning' ? 'Ready with warnings' : 'Ready for submission'}
          </h2>
        </div>
        {viewModel.totalCount > 0 && viewModel.status !== 'blocked' && (
          <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: isReady ? '#166534' : '#991b1b', backgroundColor: isReady ? '#dcfce7' : '#fee2e2' }}>
            {viewModel.completedCount} of {viewModel.totalCount} checks complete
          </span>
        )}
      </div>

      {viewModel.nextAction?.targetArea && viewModel.nextAction.targetTab && (
        <section aria-label="Next application item" className="mt-2 sm:mt-4 rounded-lg bg-blue-50 px-3 py-3">
          <div className="mt-0 sm:mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-blue-950">{viewModel.nextAction.title}</p>
              {viewModel.nextAction.description && <p className="mt-1 text-xs text-blue-800">{viewModel.nextAction.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => onNavigate(viewModel.nextAction!.targetArea!, viewModel.nextAction!.targetTab!)}
              className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800"
            >
              Open next item
            </button>
          </div>
        </section>
      )}

      {viewModel.blockers.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-red-700">{hasPrimaryNextAction ? 'Other blockers' : 'Blockers'} <span className="sr-only">requiring action</span></h3>
          {secondaryBlockers.length > 0 ? (
            <ul className="space-y-2">
              {secondaryBlockers.map(item => <ReadinessItemRow key={item.id} item={item} onNavigate={onNavigate} />)}
            </ul>
          ) : (
            <p className="text-xs text-slate-600">The next item above is the only blocker.</p>
          )}
        </div>
      )}

      {viewModel.warnings.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-700">Warnings</h3>
          <ul className="space-y-2">
            {viewModel.warnings.map(item => <ReadinessItemRow key={item.id} item={item} onNavigate={onNavigate} />)}
          </ul>
        </div>
      )}

      {viewModel.satisfied.length > 0 && (
        <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--cr-outline-variant)' }}>
          <button type="button" className="text-xs font-bold" style={{ color: 'var(--cr-primary)', background: 'none', border: 0, cursor: 'pointer' }} onClick={() => setShowSatisfied(value => !value)} aria-expanded={showSatisfied}>
            {showSatisfied ? 'Hide' : 'Show'} completed checks ({viewModel.satisfied.length})
          </button>
          {showSatisfied && <ul className="mt-2 space-y-2">{viewModel.satisfied.map(item => <ReadinessItemRow key={item.id} item={item} onNavigate={onNavigate} />)}</ul>}
        </div>
      )}

      {isReady && viewModel.blockers.length === 0 && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-green-50 px-3 py-3 text-sm text-green-800">
          <span>All required server checks are satisfied.</span>
          {onSubmit && <button type="button" onClick={onSubmit} className="rounded-lg bg-green-700 px-3 py-2 text-xs font-bold text-white hover:bg-green-800">Submit Application</button>}
        </div>
      )}
    </section>
  );
};

export default ApplicationReadinessPanel;
