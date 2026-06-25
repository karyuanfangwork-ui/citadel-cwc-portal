/**
 * CreditDecisionSummaryCard — Phase 4 explainability component.
 *
 * Surfaces the latest score run's key metrics in a single card:
 *   - Latest score + delta vs previous run
 *   - Risk rating + rating delta
 *   - Decision recommendation (APPROVE / CONDITIONAL / REJECT)
 *   - Reason codes + missing inputs
 *   - Bureau caps applied
 *   - Last-calculated timestamp + calculation source
 *
 * Props: the CreditApplication object (which now carries the flattened
 * explainability fields from getApplication).
 */
import React from 'react';
import { CreditApplication } from '../../../services/credit.service';

interface CreditDecisionSummaryCardProps {
  application: CreditApplication;
  className?: string;
}

const RATING_COLORS: Record<string, string> = {
  AAA: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  AA: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  A: 'bg-green-100 text-green-700 border-green-300',
  BBB: 'bg-blue-100 text-blue-700 border-blue-300',
  BB: 'bg-amber-100 text-amber-700 border-amber-300',
  B: 'bg-amber-100 text-amber-700 border-amber-300',
  CCC: 'bg-orange-100 text-orange-700 border-orange-300',
  CC: 'bg-orange-100 text-orange-700 border-orange-300',
  C: 'bg-red-100 text-red-700 border-red-300',
  D: 'bg-red-100 text-red-700 border-red-300',
};

const RECOMMENDATION_STYLES: Record<string, string> = {
  APPROVE: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  CONDITIONAL: 'bg-amber-50 text-amber-700 border-amber-300',
  REJECT: 'bg-red-50 text-red-700 border-red-300',
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-MY', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const CreditDecisionSummaryCard: React.FC<CreditDecisionSummaryCardProps> = ({
  application,
  className = '',
}) => {
  const {
    riskRating,
    baseRiskRating,
    totalScore,
    bureauCapsApplied,
    missingInputs,
    calculationSource,
    isOverride,
    latestScoreRunAt,
    inputSnapshot,
  } = application;

  // Derive bureau freshness from the input snapshot
  const bureauFresh = inputSnapshot?.bureauFresh;
  const staleProviders: string[] = inputSnapshot?.staleBureauProviders ?? [];

  // Derive a recommendation from the available data
  const missingCount = missingInputs?.length ?? 0;
  let recommendation: 'APPROVE' | 'CONDITIONAL' | 'REJECT' = 'APPROVE';
  if (!riskRating || riskRating === 'NR') {
    recommendation = 'CONDITIONAL';
  } else if (['CCC', 'CC', 'C', 'D'].includes(riskRating)) {
    recommendation = 'REJECT';
  } else if (['BBB', 'BB', 'B'].includes(riskRating)) {
    recommendation = 'CONDITIONAL';
  }
  if (missingCount > 0 && recommendation === 'APPROVE') {
    recommendation = 'CONDITIONAL';
  }

  const ratingColor = riskRating ? RATING_COLORS[riskRating] ?? 'bg-gray-100 text-gray-700 border-gray-300' : '';
  const recStyle = RECOMMENDATION_STYLES[recommendation] ?? '';

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <span className="material-symbols-outlined text-gray-500 text-xl">analytics</span>
          Credit Decision Summary
        </h3>
        {calculationSource && (
          <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-100 rounded-full">
            {calculationSource}
          </span>
        )}
      </div>

      {/* Score + Rating row */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <p className="text-xs text-gray-500 mb-1">Total Score</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">
              {totalScore != null ? Number(totalScore).toFixed(1) : '—'}
            </span>
            {isOverride && (
              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                Override
              </span>
            )}
          </div>
        </div>
        <div className="flex-1">
          <p className="text-xs text-gray-500 mb-1">Risk Rating</p>
          <div className="flex items-center gap-2">
            {riskRating ? (
              <span className={`text-2xl font-bold px-3 py-1 rounded-lg border ${ratingColor}`}>
                {riskRating}
              </span>
            ) : (
              <span className="text-2xl font-bold text-gray-400">NR</span>
            )}
            {baseRiskRating && baseRiskRating !== riskRating && (
              <span className="text-xs text-gray-400 line-through">{baseRiskRating}</span>
            )}
          </div>
        </div>
        <div className="flex-1">
          <p className="text-xs text-gray-500 mb-1">Recommendation</p>
          <span className={`text-sm font-semibold px-3 py-1.5 rounded-lg border ${recStyle}`}>
            {recommendation}
          </span>
        </div>
      </div>

      {/* Bureau caps + freshness */}
      <div className="flex items-start gap-4 text-xs">
        <div className="flex-1">
          <p className="text-gray-500 mb-1">Bureau Caps</p>
          {bureauCapsApplied && bureauCapsApplied.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {bureauCapsApplied.map((cap) => (
                <span key={cap} className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded border border-orange-200">
                  {cap}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-gray-400">None applied</span>
          )}
        </div>
        <div className="flex-1">
          <p className="text-gray-500 mb-1">Bureau Freshness</p>
          {bureauFresh === true ? (
            <span className="text-emerald-600 font-medium">Fresh (within 90 days)</span>
          ) : bureauFresh === false ? (
            <span className="text-amber-600 font-medium">
              Stale{staleProviders.length > 0 ? `: ${staleProviders.join(', ')}` : ''}
            </span>
          ) : (
            <span className="text-gray-400">Not checked</span>
          )}
        </div>
      </div>

      {/* Missing inputs */}
      {missingCount > 0 && (
        <div className="text-xs">
          <p className="text-gray-500 mb-1">Missing Inputs ({missingCount})</p>
          <div className="flex flex-wrap gap-1">
            {missingInputs!.map((mi: any, i: number) => (
              <span key={i} className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">
                {mi.factor}: {mi.subField} ({mi.policy})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Last calculated */}
      <div className="text-xs text-gray-500 border-t border-gray-100 pt-3 flex items-center justify-between">
        <span>Last calculated: {formatDateTime(latestScoreRunAt)}</span>
      </div>
    </div>
  );
};

export default CreditDecisionSummaryCard;