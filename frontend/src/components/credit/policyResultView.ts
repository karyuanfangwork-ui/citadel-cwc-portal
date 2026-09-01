import type { PolicyVerdict, PolicyResultRow } from '../../services/credit.service';

/**
 * CA-P5-002 — ordering, grouping and verdict presentation for the Policy
 * Results panel.
 *
 * Pure: no React, no network. Every ordering rule is testable here, which keeps
 * PolicyResultsPanel.tsx to fetching and markup.
 */

/** Failure-first. A reader opening an evaluation is looking for what went wrong. */
export const VERDICT_ORDER: PolicyVerdict[] = ['FAIL', 'WARN', 'PASS'];

function verdictRank(verdict: PolicyVerdict): number {
  const index = VERDICT_ORDER.indexOf(verdict);
  return index === -1 ? VERDICT_ORDER.length : index;
}

/** FAIL → WARN → PASS, then alphabetical by ruleCode. Returns a new array. */
export function sortResults(results: PolicyResultRow[]): PolicyResultRow[] {
  return [...results].sort((a, b) => {
    const byVerdict = verdictRank(a.verdict) - verdictRank(b.verdict);
    if (byVerdict !== 0) return byVerdict;
    return a.ruleCode.localeCompare(b.ruleCode);
  });
}

export const SOURCE_LABELS: Record<string, string> = {
  POLICY_LIMIT: 'Policy limits',
  READINESS: 'Submission readiness',
  DEVIATION: 'Deviations',
  BUREAU: 'Credit bureau',
  MISSING_DATA: 'Missing data',
};

export interface PolicyResultGroup {
  source: string;
  label: string;
  results: PolicyResultRow[];
  worst: PolicyVerdict;
}

/**
 * Group by evaluator, ordering groups by their worst verdict so a failing
 * source is never buried under a passing one.
 */
export function groupBySource(results: PolicyResultRow[]): PolicyResultGroup[] {
  const bySource = new Map<string, PolicyResultRow[]>();
  for (const result of results) {
    const group = bySource.get(result.source) ?? [];
    group.push(result);
    bySource.set(result.source, group);
  }

  const groups: PolicyResultGroup[] = [...bySource.entries()].map(([source, rows]) => {
    const sorted = sortResults(rows);
    return {
      source,
      label: SOURCE_LABELS[source] ?? source,
      results: sorted,
      worst: sorted[0].verdict,
    };
  });

  return groups.sort((a, b) => {
    const byWorst = verdictRank(a.worst) - verdictRank(b.worst);
    if (byWorst !== 0) return byWorst;
    return a.label.localeCompare(b.label);
  });
}

export interface VerdictTone {
  label: string;
  className: string;
}

/** Colour plus a text label, always. */
export function verdictTone(verdict: PolicyVerdict): VerdictTone {
  switch (verdict) {
    case 'FAIL':
      return { label: 'Failed', className: 'bg-red-100 text-red-800 border-red-300' };
    case 'WARN':
      return { label: 'Warning', className: 'bg-amber-100 text-amber-900 border-amber-300' };
    default:
      return { label: 'Passed', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  }
}

export const TRIGGER_LABELS: Record<string, string> = {
  submit_to_committee: 'Submitted to committee',
  resume_committee: 'Resumed committee review',
  approve: 'Approved',
  reject: 'Rejected',
};

/** Plain language for a lifecycle action, falling back to the raw value. */
export function triggerLabel(action: string): string {
  return TRIGGER_LABELS[action] ?? action;
}

/** Distinguishes an evaluator failure from a failing rule. */
export function isEvaluationError(result: PolicyResultRow): boolean {
  return result.ruleCode.endsWith('.EVALUATION_ERROR');
}
