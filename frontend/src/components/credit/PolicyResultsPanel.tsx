import React, { useEffect, useState } from 'react';
import creditService, {
  type PolicyEvaluationSummary,
  type PolicyEvaluationDetail,
} from '../../services/credit.service';
import {
  groupBySource,
  verdictTone,
  triggerLabel,
  isEvaluationError,
} from './policyResultView';

/**
 * CA-P5-002 / GAP-P1-10 — recorded policy evaluations for an application.
 * These are historical records, not transition gates.
 */
const PolicyResultsPanel: React.FC<{ applicationId: string }> = ({ applicationId }) => {
  const [evaluations, setEvaluations] = useState<PolicyEvaluationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, PolicyEvaluationDetail>>({});
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!applicationId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const list = await creditService.getPolicyEvaluations(applicationId);
        if (!cancelled) setEvaluations(list);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load policy evaluations');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [applicationId]);

  const toggle = async (evaluationId: string) => {
    if (expandedId === evaluationId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(evaluationId);
    setDetailError(null);

    if (details[evaluationId]) return;

    setDetailLoading(true);
    try {
      const detail = await creditService.getPolicyEvaluation(applicationId, evaluationId);
      setDetails((prev) => ({ ...prev, [evaluationId]: detail }));
    } catch (err: unknown) {
      setDetailError(err instanceof Error ? err.message : 'Failed to load evaluation detail');
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) return <p className="text-sm text-slate-500">Loading policy evaluations…</p>;

  if (error) {
    return <p className="text-sm text-red-700">Policy evaluations could not be loaded: {error}</p>;
  }

  if (evaluations.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        No policy evaluations have been recorded for this application. Policy is evaluated at
        committee submission and at the final decision.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {evaluations.map((evaluation) => {
        const expanded = expandedId === evaluation.evaluationId;
        const detail = details[evaluation.evaluationId];
        const tone = verdictTone(evaluation.summary.overall);

        return (
          <div key={evaluation.evaluationId} className="rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => toggle(evaluation.evaluationId)}
              aria-expanded={expanded}
              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50"
            >
              <span className={`shrink-0 rounded border px-2 py-0.5 text-xs font-semibold ${tone.className}`}>
                {tone.label}
              </span>
              <span className="font-semibold text-sm text-slate-800">
                {triggerLabel(evaluation.triggerAction)}
              </span>
              <span className="text-xs text-slate-500">
                {new Date(evaluation.evaluatedAt).toLocaleString('en-GB', {
                  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </span>
              <span className="ml-auto text-xs text-slate-600">
                {evaluation.summary.failed} failed · {evaluation.summary.warned} warning
                {evaluation.summary.warned === 1 ? '' : 's'} · {evaluation.summary.passed} passed
              </span>
              <span className="material-symbols-outlined text-[18px] text-slate-400" aria-hidden="true">
                {expanded ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {expanded && (
              <div className="border-t border-slate-200 px-3 py-2">
                {detailLoading && !detail && <p className="text-sm text-slate-500">Loading rules…</p>}
                {detailError && <p className="text-sm text-red-700">{detailError}</p>}

                {detail && (
                  <p className="mb-2 text-xs text-slate-500">
                    Policy set:{' '}
                    {detail.policySetVersion
                      ? <code className="text-slate-700">{detail.policySetVersion}</code>
                      : <span>not recorded</span>}
                  </p>
                )}
                {detail && groupBySource(detail.results).map((group) => (
                  <div key={group.source} className="mb-3 last:mb-0">
                    <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                      {group.label}
                    </h4>
                    <ul className="space-y-1">
                      {group.results.map((result) => {
                        const rowTone = verdictTone(result.verdict);
                        const evaluationError = isEvaluationError(result);
                        return (
                          <li key={result.id} className="flex items-start gap-2 text-sm">
                            <span className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-semibold ${rowTone.className}`}>
                              {evaluationError ? 'Not evaluated' : rowTone.label}
                            </span>
                            <span className="min-w-0">
                              <code data-testid="policy-rule-code" className="text-xs text-slate-700">
                                {result.ruleCode}
                              </code>
                              <span className="block text-slate-600">
                                {evaluationError
                                  ? `This rule set could not be evaluated. ${result.message}`
                                  : result.message}
                              </span>
                              {result.threshold !== null && (
                                <span className="block text-xs text-slate-500">
                                  Actual {result.actual ?? '—'} against limit {result.threshold}
                                </span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PolicyResultsPanel;
