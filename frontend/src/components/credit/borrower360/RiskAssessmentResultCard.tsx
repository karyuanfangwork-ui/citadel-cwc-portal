import React from 'react';
import type { BorrowerRiskAssessment, BorrowerRiskAssessmentTarget } from '../../../services/credit.service';
import { OutlinedCard, StatusPill } from './primitives';

interface Props {
  assessment: BorrowerRiskAssessment | null;
  canWrite: boolean;
  recalculating: boolean;
  recalculationError?: string | null;
  onRecalculate: () => void;
  onAction: (target: BorrowerRiskAssessmentTarget) => void;
}

const statusCopy: Record<BorrowerRiskAssessment['ratingStatus'], { label: string; tone: 'pos' | 'warn' | 'neg' | 'neutral'; meaning: string }> = {
  NOT_CALCULATED: { label: 'Not calculated', tone: 'neutral', meaning: 'Calculate a borrower risk rating before continuing assessment.' },
  CALCULATED: { label: 'Calculated', tone: 'warn', meaning: 'A rating exists, but the assessment still needs confirmation before decisioning.' },
  INCOMPLETE: { label: 'Incomplete', tone: 'warn', meaning: 'The rating is provisional and is not decision-ready until the outstanding inputs are resolved.' },
  DECISION_READY: { label: 'Decision-ready', tone: 'pos', meaning: 'The governed rating and required assessment inputs are current.' },
};

const RiskAssessmentResultCard: React.FC<Props> = ({ assessment, canWrite, recalculating, recalculationError, onRecalculate, onAction }) => {
  const current = assessment ?? {
    ratingStatus: 'NOT_CALCULATED' as const,
    effectiveRating: null,
    baseRating: null,
    score: null,
    scorecardVersion: null,
    calculatedAt: null,
    missingInputs: [],
    reasonCodes: [],
    bureauCaps: [],
    nextAction: { target: 'risk' as const, label: 'Calculate risk rating' },
    applicationImpact: 'BLOCKED' as const,
    assessmentImpact: 'NOT_CALCULATED' as const,
  };
  const state = statusCopy[current.ratingStatus];
  const firstInput = current.missingInputs[0];

  return (
    <div className="space-y-4">
      <div aria-live="polite" role="status" className="sr-only">
        {recalculating ? 'Risk rating recalculation in progress.' : recalculationError ?? ''}
      </div>
      {recalculationError ? (
        <div role="alert" className="rounded-fc border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-bold">Risk rating could not be recalculated</p>
          <p className="mt-1">{recalculationError} The previous result remains visible and should be treated as stale until recalculation succeeds.</p>
          {canWrite ? <button type="button" onClick={onRecalculate} className="mt-2 font-bold underline">Try again</button> : null}
        </div>
      ) : null}
      <section aria-labelledby="risk-assessment-heading" className="rounded-fc border border-fc-outline bg-fc-surface p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-fc-on-variant">Governed borrower result</p>
            <h3 id="risk-assessment-heading" className="mt-1 flex items-center gap-3 text-3xl font-bold text-fc-primary">
              {current.effectiveRating ?? '—'}
              <StatusPill label={state.label} tone={state.tone} />
            </h3>
            <p className="mt-2 max-w-2xl text-sm text-fc-on-variant"><strong>What this means:</strong> {state.meaning}</p>
          </div>
          {canWrite ? (
            <button type="button" onClick={onRecalculate} disabled={recalculating} className="rounded-fc bg-fc-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
              {recalculating ? 'Recalculating…' : 'Recalculate risk rating'}
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-[10px] font-bold uppercase tracking-wide text-fc-on-variant">Assessment</p><p className="mt-1 text-sm font-bold text-fc-primary">{state.label}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-wide text-fc-on-variant">Application draft</p><p className="mt-1 text-sm font-bold text-fc-primary">{current.applicationImpact === 'ALLOWED' ? 'Allowed' : current.applicationImpact === 'NOT_AVAILABLE' ? 'Not available' : 'Blocked'}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-wide text-fc-on-variant">Decisioning</p><p className="mt-1 text-sm font-bold text-fc-primary">{current.assessmentImpact === 'READY' ? 'Ready' : 'Not ready'}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-wide text-fc-on-variant">Scorecard</p><p className="mt-1 text-sm text-fc-primary">{current.scorecardVersion == null ? '—' : `v${current.scorecardVersion}`}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-wide text-fc-on-variant">Last calculated</p><p className="mt-1 text-sm text-fc-primary">{current.calculatedAt ? new Date(current.calculatedAt).toLocaleString() : 'Not yet calculated'}</p></div>
        </div>
      </section>

      {firstInput ? (
        <OutlinedCard title="Next action">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-bold text-fc-primary">{firstInput.title}</p><p className="mt-1 text-xs text-fc-on-variant">{firstInput.description}</p></div>
            <button type="button" onClick={() => onAction(firstInput.target)} className="shrink-0 rounded-fc border border-fc-primary px-3 py-2 text-xs font-bold text-fc-primary">{firstInput.actionLabel}</button>
          </div>
        </OutlinedCard>
      ) : (
        <OutlinedCard title="Next action">
          {current.nextAction ? <button type="button" onClick={() => onAction(current.nextAction!.target)} disabled={!canWrite} className="rounded-fc border border-fc-primary px-3 py-2 text-xs font-bold text-fc-primary disabled:cursor-not-allowed disabled:opacity-50">{current.nextAction.label}</button> : <p className="text-sm text-fc-on-variant">No action required.</p>}
        </OutlinedCard>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <OutlinedCard title="Why this result">
          {current.reasonCodes.length > 0 || current.bureauCaps.length > 0 ? (
            <ul className="space-y-2 text-sm text-fc-primary">
              {[...current.reasonCodes.map((item) => item.label), ...current.bureauCaps.map((item) => item.label)].map((label, index) => <li key={`${label}-${index}`}>{label}</li>)}
            </ul>
          ) : <p className="text-sm text-fc-on-variant">No additional risk drivers were returned for this calculation.</p>}
        </OutlinedCard>
        <OutlinedCard title="Calculation detail">
          <div className="space-y-2 text-sm"><p><span className="text-fc-on-variant">Base rating:</span> <strong>{current.baseRating ?? '—'}</strong></p><p><span className="text-fc-on-variant">Effective rating:</span> <strong>{current.effectiveRating ?? '—'}</strong></p><p><span className="text-fc-on-variant">Total score:</span> <strong>{current.score ?? '—'}</strong></p></div>
        </OutlinedCard>
      </div>
    </div>
  );
};

export default RiskAssessmentResultCard;
