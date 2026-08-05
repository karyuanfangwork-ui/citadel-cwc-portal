import React, { useState } from 'react';

/**
 * CalculationBreakdownPanel
 *
 * Expandable panel that shows the formula, inputs, result, policy threshold,
 * and pass/watch/fail state for each key underwriting ratio.
 *
 * Used by FinancialProfileTab to expose underwriting calculations transparently.
 * Phase 5 deliverable — calculation engine and breakdown panel.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type RatioStatus = 'pass' | 'watch' | 'fail';

export interface RatioBreakdown {
  /** Display name (e.g. "Debt Service Ratio") */
  name: string;
  /** Short code (e.g. "DSR", "DSCR") */
  code: string;
  /** Human-readable formula (e.g. "Total Commitments / Gross Income × 100") */
  formula: string;
  /** Named inputs used in the calculation */
  inputs: { label: string; value: string }[];
  /** Final calculated result */
  result: string;
  /** Policy threshold description (e.g. "≤ 60% pass, 60–70% watch, > 70% fail") */
  threshold: string;
  /** Pass / watch / fail status */
  status: RatioStatus;
  /** Optional source references (e.g. "payslip.pdf", "CCRIS report") */
  sources?: string[];
}

// ── Status styling ──────────────────────────────────────────────────────────────

const statusConfig: Record<RatioStatus, { bg: string; border: string; text: string; icon: string; label: string }> = {
  pass:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  icon: 'check_circle',  label: 'Pass' },
  watch: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  icon: 'warning',       label: 'Watch' },
  fail:  { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    icon: 'error',        label: 'Fail' },
};

// ── Single ratio row ────────────────────────────────────────────────────────────

const RatioRow: React.FC<{ ratio: RatioBreakdown }> = ({ ratio }) => {
  const [expanded, setExpanded] = useState(false);
  const sc = statusConfig[ratio.status];

  return (
    <div className={`rounded-lg border ${sc.border} overflow-hidden`}>
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/50"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-800">{ratio.code}</span>
            <span className="text-xs text-gray-500">{ratio.name}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-lg font-bold tabular-nums text-gray-900">{ratio.result}</span>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${sc.bg} ${sc.text}`}>
          <span className="material-symbols-outlined text-sm">{sc.icon}</span>
          {sc.label}
        </span>
        <span
          className="material-symbols-outlined text-lg text-gray-400"
          style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        >
          expand_more
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-200 px-4 py-3 space-y-3 bg-gray-50/30">
          {/* Formula */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Formula</p>
            <p className="text-xs font-mono text-gray-700 bg-white border rounded px-2 py-1.5">{ratio.formula}</p>
          </div>

          {/* Inputs */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Inputs</p>
            <div className="grid grid-cols-2 gap-2">
              {ratio.inputs.map((inp, idx) => (
                <div key={idx} className="flex justify-between bg-white border rounded px-2 py-1">
                  <span className="text-xs text-gray-500">{inp.label}</span>
                  <span className="text-xs font-semibold tabular-nums text-gray-800">{inp.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Threshold */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Policy Threshold</p>
            <p className="text-xs text-gray-600">{ratio.threshold}</p>
          </div>

          {/* Sources */}
          {ratio.sources && ratio.sources.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Source References</p>
              <div className="flex flex-wrap gap-1.5">
                {ratio.sources.map((src, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-200">
                    <span className="material-symbols-outlined text-xs">description</span>
                    {src}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main panel ──────────────────────────────────────────────────────────────────

interface CalculationBreakdownPanelProps {
  ratios: RatioBreakdown[];
}

const CalculationBreakdownPanel: React.FC<CalculationBreakdownPanelProps> = ({ ratios }) => {
  if (ratios.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-4 text-center text-sm text-gray-400">
        No calculation data available. Enter financial data to see ratio breakdowns.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {ratios.map((r, idx) => (
        <RatioRow key={`${r.code}-${idx}`} ratio={r} />
      ))}
    </div>
  );
};

export default CalculationBreakdownPanel;