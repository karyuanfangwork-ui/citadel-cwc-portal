import React from 'react';
import creditService from '../../../services/credit.service';
import type { BorrowerRiskAssessment, BorrowerRiskAssessmentTarget, RatingBand } from '../../../services/credit.service';
import { OutlinedCard, StatusPill } from './primitives';

const riskCategoryTone: Record<RatingBand['riskCategory'], 'pos' | 'warn' | 'neg' | 'neutral'> = {
  LOW: 'pos',
  MODERATE: 'warn',
  HIGH: 'neg',
  PROHIBITED: 'neg',
};

const FACTOR_LABELS: Record<string, string> = {
  financial_performance: 'Financial performance',
  leverage: 'Leverage',
  liquidity: 'Liquidity',
  cashflow: 'Cashflow / DSR',
  management: 'Management quality',
  industry: 'Industry outlook',
  collateral: 'Collateral quality',
  relationship: 'Relationship history',
  market_conditions: 'Market conditions',
};

const factorLabel = (factorKey: string) => FACTOR_LABELS[factorKey] ?? factorKey.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

function useActiveRatingBands() {
  const [bands, setBands] = React.useState<RatingBand[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    creditService
      .getActiveRatingBands()
      .then((result) => {
        if (!cancelled) setBands(result);
      })
      .catch(() => {
        if (!cancelled) setError('Rating scale is unavailable right now.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { bands, error };
}

const RatingScaleLegend: React.FC<{ currentRating: string | null; bands: RatingBand[] | null; error: string | null }> = ({ currentRating, bands, error }) => {
  return (
    <OutlinedCard title="Rating scale">
      {error ? (
        <p className="text-sm text-fc-on-variant">{error}</p>
      ) : !bands ? (
        <p className="text-sm text-fc-on-variant">Loading rating scale…</p>
      ) : (
        <div className="space-y-2">
          <ul className="space-y-1.5 text-sm text-fc-primary">
            {[...bands]
              .sort((a, b) => b.scoreMax - a.scoreMax)
              .map((band) => (
                <li key={band.rating} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <strong className={band.rating === currentRating ? 'underline' : undefined}>{band.rating}</strong>
                    <span className="text-xs text-fc-on-variant">{band.scoreMin}–{band.scoreMax}</span>
                  </span>
                  <StatusPill label={band.riskCategory} tone={riskCategoryTone[band.riskCategory]} />
                </li>
              ))}
            <li className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <strong className={currentRating === 'NR' ? 'underline' : undefined}>NR</strong>
                <span className="text-xs text-fc-on-variant">Not rated</span>
              </span>
              <StatusPill label="No rating calculated" tone="neutral" />
            </li>
          </ul>
          <p className="text-xs text-fc-on-variant">Score bands reflect the currently active rating configuration and may be adjusted by admins.</p>
        </div>
      )}
    </OutlinedCard>
  );
};

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
    factorScores: [],
    nextAction: { target: 'risk' as const, label: 'Calculate risk rating' },
    applicationImpact: 'BLOCKED' as const,
    assessmentImpact: 'NOT_CALCULATED' as const,
  };
  const state = statusCopy[current.ratingStatus];
  const firstInput = current.missingInputs[0];
  const { bands, error: bandsError } = useActiveRatingBands();
  const currentBand = bands?.find((band) => band.rating === current.effectiveRating) ?? null;
  const isHighRiskCategory = currentBand?.riskCategory === 'HIGH' || currentBand?.riskCategory === 'PROHIBITED';

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
      {isHighRiskCategory && currentBand ? (
        <div role="alert" className="rounded-fc border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-bold">This rating falls in the {currentBand.riskCategory} risk category</p>
          <p className="mt-1">A "{state.label}" assessment status means the required inputs are complete enough to run a decision — it does not mean the borrower will be approved. Ratings in the {currentBand.riskCategory} category are expected to receive a decline recommendation from the decision engine.</p>
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
            {currentBand ? (
              <p className="mt-2 max-w-2xl text-sm text-fc-on-variant"><strong>Risk category:</strong> {currentBand.riskCategory}</p>
            ) : null}
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
          <div className="space-y-2 text-sm">
            <p><span className="text-fc-on-variant">Base rating:</span> <strong>{current.baseRating ?? '—'}</strong></p>
            <p><span className="text-fc-on-variant">Effective rating:</span> <strong>{current.effectiveRating ?? '—'}</strong></p>
            <p><span className="text-fc-on-variant">Total score:</span> <strong>{current.score ?? '—'}</strong></p>
            {currentBand ? <p><span className="text-fc-on-variant">Active rating band:</span> <strong>{currentBand.rating} ({currentBand.scoreMin}–{currentBand.scoreMax})</strong></p> : null}
          </div>
          {current.factorScores.length > 0 ? (
            <details className="mt-4 rounded-fc border border-fc-outline bg-fc-surface">
              <summary className="cursor-pointer px-3 py-2 text-sm font-bold text-fc-primary">How this score was calculated</summary>
              <div className="border-t border-fc-outline px-3 py-3">
                <p className="mb-3 text-xs text-fc-on-variant">Each factor is scored from 0 to 100. The system multiplies the factor score by its weight and adds the weighted contributions to produce the total score.</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[30rem] text-left text-xs">
                    <thead className="text-fc-on-variant">
                      <tr><th className="pb-2 pr-3 font-bold">Factor</th><th className="pb-2 px-3 text-right font-bold">Score</th><th className="pb-2 px-3 text-right font-bold">Weight</th><th className="pb-2 pl-3 text-right font-bold">Contribution</th></tr>
                    </thead>
                    <tbody>
                      {current.factorScores.map((factor) => (
                        <tr key={factor.factorKey} className="border-t border-fc-outline">
                          <th scope="row" className="py-2 pr-3 font-medium text-fc-primary">{factorLabel(factor.factorKey)}</th>
                          <td className="px-3 py-2 text-right text-fc-primary">{factor.score.toFixed(1)}</td>
                          <td className="px-3 py-2 text-right text-fc-primary">{factor.weight.toFixed(1)}%</td>
                          <td className="py-2 pl-3 text-right font-bold text-fc-primary">{factor.weightedScore.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-fc-on-variant">Total score <strong className="text-fc-primary">{current.score ?? '—'}</strong> maps to <strong className="text-fc-primary">{current.effectiveRating ?? '—'}</strong> using the active rating bands.</p>
              </div>
            </details>
          ) : null}
        </OutlinedCard>
      </div>

      <RatingScaleLegend currentRating={current.effectiveRating} bands={bands} error={bandsError} />
    </div>
  );
};

export default RiskAssessmentResultCard;
