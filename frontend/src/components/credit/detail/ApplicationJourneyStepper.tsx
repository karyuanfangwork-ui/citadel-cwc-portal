import React, { useState } from 'react';
import {
  ApplicationLifecycleState,
  APPLICATION_LIFECYCLE_STAGES,
} from '../../../../pages/credit/creditUtils';

interface ApplicationJourneyStepperProps {
  /** Compatibility input for callers that only have the stage index. */
  currentStageIndex?: number;
  /** Optional compatibility callback; lifecycle stages are intentionally not navigable. */
  onStageClick?: () => void;
  lifecycleState?: ApplicationLifecycleState;
  /** Compact Overview presentation; the full journey remains available on demand. */
  compact?: boolean;
  blockerCount?: number;
}

const ApplicationJourneyStepper: React.FC<ApplicationJourneyStepperProps> = ({
  currentStageIndex = 0,
  lifecycleState,
  compact = false,
  blockerCount,
}) => {
  const [showFullJourney, setShowFullJourney] = useState(false);
  const stageIndex = lifecycleState?.stage.index ?? currentStageIndex;
  const isException = Boolean(lifecycleState?.isException);
  const statusLabel = lifecycleState?.status === 'on-hold'
    ? 'On hold'
    : lifecycleState?.status === 'returned'
      ? 'Returned for rework'
      : lifecycleState?.status === 'rejected'
        ? 'Rejected'
        : lifecycleState?.status === 'withdrawn'
          ? 'Withdrawn'
          : lifecycleState?.status === 'complete'
            ? 'Complete'
            : 'In progress';

  if (compact) {
    return (
      <section
        aria-label="Application progress"
        className="px-1 py-1"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Current stage</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">{lifecycleState?.stage.label ?? 'Current stage'}</h2>
            <p className="mt-1 text-sm text-slate-600">{statusLabel}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {blockerCount !== undefined && blockerCount > 0 && (
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-800">
                {blockerCount} blocker{blockerCount === 1 ? '' : 's'}
              </span>
            )}
            <button
              type="button"
              className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
              aria-expanded={showFullJourney}
              onClick={() => setShowFullJourney(value => !value)}
            >
              {showFullJourney ? 'Hide application journey' : 'View application journey'}
            </button>
          </div>
        </div>
        {lifecycleState?.explanation && (
          <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${isException ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-700'}`}>
            {lifecycleState.explanation}
          </p>
        )}
        {showFullJourney && (
          <ol className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-4 lg:grid-cols-7" aria-label="Lifecycle stages">
            {APPLICATION_LIFECYCLE_STAGES.map(stage => {
              const completed = stage.index < stageIndex || (lifecycleState?.status === 'complete' && stage.index <= stageIndex);
              const current = stage.index === stageIndex;
              const stageStatus = current ? statusLabel : completed ? 'Complete' : 'Upcoming';
              return <li key={stage.key} role="listitem" aria-current={current ? 'step' : undefined} aria-label={`${stage.label} — ${stageStatus}`} className="rounded-lg p-2 text-xs font-semibold" style={{ background: current ? (isException ? '#fffbeb' : 'var(--cr-action-container, rgba(0,81,213,0.08))') : 'transparent' }}>{stage.label}</li>;
            })}
          </ol>
        )}
      </section>
    );
  }

  return (
    <section
      aria-label="Application progress"
      className="rounded-xl"
      style={{
        background: 'var(--cr-surface-container-lowest)',
        border: '1px solid var(--cr-outline-variant)',
        borderRadius: 'var(--cr-radius-lg)',
        padding: 20,
      }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">Application Progress</h2>
        <span role="status" className={`rounded-full px-2.5 py-1 text-xs font-bold ${isException ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
          {lifecycleState?.stage.label ?? 'Current stage'} · {statusLabel}
        </span>
      </div>

      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7" aria-label="Lifecycle stages">
        {APPLICATION_LIFECYCLE_STAGES.map(stage => {
          const completed = stage.index < stageIndex || (lifecycleState?.status === 'complete' && stage.index <= stageIndex);
          const current = stage.index === stageIndex;
          const stageStatus = current ? statusLabel : completed ? 'Complete' : 'Upcoming';
          return (
            <li
              key={stage.key}
              role="listitem"
              aria-current={current ? 'step' : undefined}
              aria-label={`${stage.label} — ${stageStatus}`}
              className="flex items-center gap-2 rounded-lg p-2 sm:block sm:text-center"
              style={{
                background: current ? (isException ? '#fffbeb' : 'var(--cr-action-container, rgba(0,81,213,0.08))') : 'transparent',
                color: current ? 'var(--cr-on-surface)' : completed ? 'var(--cr-secondary)' : 'var(--cr-outline)',
              }}
            >
              <span
                aria-hidden="true"
                className="material-symbols-outlined mx-0 shrink-0 rounded-full p-1 text-[18px] sm:mx-auto"
                style={{
                  background: current ? (isException ? '#f59e0b' : 'var(--cr-primary)') : completed ? 'var(--cr-secondary)' : 'var(--cr-outline-variant)',
                  color: current || completed ? 'white' : 'var(--cr-on-surface-variant)',
                }}
              >
                {completed ? 'check' : current && isException ? 'warning' : current ? 'radio_button_checked' : 'radio_button_unchecked'}
              </span>
              <span className="mt-1 block text-xs font-semibold leading-tight">{stage.label}</span>
            </li>
          );
        })}
      </ol>

      {lifecycleState?.explanation && (
        <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${isException ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-700'}`}>
          {lifecycleState.explanation}
        </p>
      )}
    </section>
  );
};

export default ApplicationJourneyStepper;
