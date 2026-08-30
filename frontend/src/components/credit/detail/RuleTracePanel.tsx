import React from 'react';
import type { RuleTraceEntry } from '../../../services/credit.service';

const RECOMMENDATION_STYLES: Record<RuleTraceEntry['recommendation'], string> = {
  APPROVE: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  CONDITIONAL: 'bg-amber-50 text-amber-700 border-amber-300',
  REJECT: 'bg-red-50 text-red-700 border-red-300',
};

const SEVERITY: Record<RuleTraceEntry['recommendation'], number> = {
  APPROVE: 1,
  CONDITIONAL: 2,
  REJECT: 3,
};

interface RuleTracePanelProps {
  trace: RuleTraceEntry[] | null | undefined;
  finalRecommendation: RuleTraceEntry['recommendation'] | null | undefined;
}

const RuleTracePanel: React.FC<RuleTracePanelProps> = ({ trace, finalRecommendation }) => {
  if (!trace || trace.length === 0) {
    return <p className="text-xs text-gray-500">No rule trace recorded for this assessment (frozen before rule traces were captured).</p>;
  }

  const winningSeverity = finalRecommendation ? SEVERITY[finalRecommendation] : 0;
  return (
    <ol className="space-y-2" aria-label="Decision rule trace">
      {trace.map((entry, index) => {
        const decisive = Boolean(finalRecommendation && entry.recommendation === finalRecommendation && SEVERITY[entry.recommendation] === winningSeverity);
        return (
          <li key={`${entry.rule}-${index}`} className={`rounded-lg border p-2 ${decisive ? 'border-brand-400 bg-brand-50' : 'border-gray-100 bg-gray-50'}`}>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono text-gray-700">{entry.rule}</span>
              <span className={`rounded border px-1.5 py-0.5 font-semibold ${RECOMMENDATION_STYLES[entry.recommendation]}`}>
                {entry.recommendation}
              </span>
              {decisive && <span className="text-[10px] font-semibold uppercase text-brand-700">Decisive</span>}
            </div>
            <p className="mt-1 text-xs text-gray-600">{entry.detail}</p>
          </li>
        );
      })}
    </ol>
  );
};

export default RuleTracePanel;
