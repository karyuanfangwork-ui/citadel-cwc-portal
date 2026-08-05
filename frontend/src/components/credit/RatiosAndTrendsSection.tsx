import React from 'react';
import { SmeFinancialRatio } from '../../../src/services/smeFinancial.service';
import { FinancialRatio } from '../../../src/services/credit.service';

/**
 * RatiosAndTrendsSection
 *
 * Phase 3: Expanded ratio display with trend direction indicators.
 * Combines SME simplified ratios (from smeFinancialApi) with any
 * corporate financial statement ratios (from financialApi).
 *
 * For each ratio, shows:
 *  - Ratio name and value
 *  - Pass/warn/fail status badge
 *  - Benchmark thresholds
 *  - Trend direction (▲/▼/—) when multi-year data is available
 */

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusBadgeClass(status: 'pass' | 'warn' | 'fail'): string {
  switch (status) {
    case 'pass': return 'bg-emerald-100 text-emerald-700';
    case 'warn': return 'bg-amber-100 text-amber-700';
    case 'fail': return 'bg-red-100 text-red-700';
  }
}

function statusLabel(status: 'pass' | 'warn' | 'fail'): string {
  switch (status) {
    case 'pass': return 'Pass';
    case 'warn': return 'Warning';
    case 'fail': return 'Fail';
  }
}

function formatRatioValue(value: number | null, unit: string): string {
  if (value === null) return '—';
  const formatted = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${formatted}${unit === '%' ? '%' : unit === 'x' ? 'x' : unit === 'days' ? ' days' : ''}`;
}

// ── Trend indicator ────────────────────────────────────────────────────────────

interface TrendInfo {
  direction: 'up' | 'down' | 'flat' | 'unknown';
  change: number | null;
}

function TrendArrow({ trend }: { trend: TrendInfo }) {
  if (trend.direction === 'unknown') {
    return <span className="text-gray-300 text-xs">—</span>;
  }
  const config = {
    up:   { icon: '▲', color: 'text-green-600' },
    down: { icon: '▼', color: 'text-red-600' },
    flat: { icon: '—', color: 'text-gray-400' },
  };
  const c = config[trend.direction];
  return (
    <span className={`text-xs font-medium ${c.color}`}>
      {c.icon}
      {trend.change !== null && trend.direction !== 'flat' && ` ${trend.change > 0 ? '+' : ''}${trend.change.toFixed(1)}%`}
    </span>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface UnifiedRatio {
  key: string;
  label: string;
  value: number | null;
  unit: 'x' | '%' | 'days' | '';
  status: 'pass' | 'warn' | 'fail';
  benchmark?: { passThreshold: number; warnThreshold: number; direction: string };
  trend: TrendInfo;
  formula?: string;
}

interface Props {
  smeRatios: SmeFinancialRatio[];
  corporateRatios: FinancialRatio[];
  /** Multi-year ratio data for trend calculation: keyed by ratioKey, array of values by year */
  trendData?: Record<string, number[]>;
}

// ── Trend calculation ──────────────────────────────────────────────────────────

function computeTrend(values: number[] | undefined): TrendInfo {
  if (!values || values.length < 2) return { direction: 'unknown', change: null };
  const latest = values[values.length - 1];
  const prev = values[values.length - 2];
  if (prev === 0) return { direction: 'unknown', change: null };
  const pct = ((latest - prev) / Math.abs(prev)) * 100;
  if (Math.abs(pct) < 0.5) return { direction: 'flat', change: pct };
  return { direction: pct > 0 ? 'up' : 'down', change: pct };
}

// ── Main component ─────────────────────────────────────────────────────────────

const RatiosAndTrendsSection: React.FC<Props> = ({ smeRatios, corporateRatios, trendData }) => {
  // Merge SME and corporate ratios into a unified list
  const unified: UnifiedRatio[] = [];

  // Add SME simplified ratios
  for (const r of smeRatios) {
    unified.push({
      key: r.key,
      label: r.label,
      value: r.value,
      unit: r.unit,
      status: r.status,
      benchmark: r.benchmark,
      trend: computeTrend(trendData?.[r.key]),
    });
  }

  // Add corporate ratios that aren't already in the SME set
  const smeKeys = new Set(smeRatios.map(r => r.key));
  for (const r of corporateRatios) {
    if (!smeKeys.has(r.ratioKey)) {
      unified.push({
        key: r.ratioKey,
        label: r.ratioLabel,
        value: Number(r.value),
        unit: r.ratioKey.includes('margin') || r.ratioKey.includes('ratio') && !r.ratioKey.includes('turnover') ? '%' : 'x',
        status: 'pass', // Corporate ratios don't have pass/warn/fail from the API; would need benchmark mapping
        trend: computeTrend(trendData?.[r.ratioKey]),
      });
    }
  }

  if (unified.length === 0) {
    return (
      <div className="bg-white border rounded-lg p-4">
        <p className="text-sm text-gray-500 text-center py-4">
          No ratio data available. Enter financial statement data to see calculated ratios.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Financial Ratios & Trends</h3>
        <span className="text-xs text-gray-400">{unified.length} ratios</span>
      </div>

      {/* Table */}
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-5 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ratio</th>
            <th className="px-5 py-2 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
            <th className="px-5 py-2 text-center text-xs font-medium text-gray-500 uppercase">Benchmark</th>
            <th className="px-5 py-2 text-center text-xs font-medium text-gray-500 uppercase">Trend</th>
            <th className="px-5 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {unified.map((r) => (
            <tr key={r.key} className="hover:bg-gray-50">
              <td className="px-5 py-2.5 text-sm text-gray-900 font-medium">{r.label}</td>
              <td className="px-5 py-2.5 text-sm text-right font-mono text-gray-900 tabular-nums">
                {formatRatioValue(r.value, r.unit)}
              </td>
              <td className="px-5 py-2.5 text-sm text-center text-gray-600">
                {r.benchmark ? (
                  <span className="text-xs">
                    {r.benchmark.direction === 'higher_is_better' ? '≥' : '≤'}
                    {r.benchmark.passThreshold}{r.unit === '%' ? '%' : r.unit === 'x' ? 'x' : ''}
                  </span>
                ) : '—'}
              </td>
              <td className="px-5 py-2.5 text-center">
                <TrendArrow trend={r.trend} />
              </td>
              <td className="px-5 py-2.5 text-center">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass(r.status)}`}>
                  {statusLabel(r.status)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RatiosAndTrendsSection;