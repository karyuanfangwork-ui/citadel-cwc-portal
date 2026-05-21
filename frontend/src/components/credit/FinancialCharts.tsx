import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, LineChart, Line,
} from 'recharts';

// ─── Shared color palette ────────────────────────────────────────────────────────
const COLORS = {
  brand: '#0052cc',
  brandLight: '#4d9aff',
  green: '#16a34a',
  greenLight: '#86efac',
  amber: '#d97706',
  amberLight: '#fcd34d',
  red: '#dc2626',
  redLight: '#fca5a5',
  gray: '#6b7280',
  grayLight: '#d1d5db',
};

const CHART_FONT = { fontFamily: 'var(--font-sans, ui-sans-serif, system-ui, sans-serif)' };

// ─── Empty State ─────────────────────────────────────────────────────────────────

export const ChartEmpty: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex flex-col items-center justify-center py-10 text-text-tertiary">
    <span className="material-symbols-outlined text-3xl mb-1 opacity-20">bar_chart</span>
    <p className="text-sm">{label}</p>
  </div>
);

// ─── Profitability Chart ─────────────────────────────────────────────────────────

type ProfitabilityLine = {
  productCategory: string;
  netProfitYtd?: string | number | null;
  netProfitProjected?: string | number | null;
  feeIncomeYtd?: string | number | null;
  feeIncomeProjected?: string | number | null;
};

const PRODUCT_LABELS: Record<string, string> = {
  FINANCINGS: 'Financings',
  TRADES_FUNDED: 'Trade (Funded)',
  TRADES_NON_FUNDED: 'Trade (Non-Funded)',
  FOREX: 'Forex',
  DEPOSITS: 'Deposits',
  REMITTANCE: 'Remittance',
  FEES_OTHERS: 'Fees & Others',
};

export const ProfitabilityBarChart: React.FC<{ lines: ProfitabilityLine[] }> = ({ lines }) => {
  const data = lines
    .filter(l => l.productCategory && PRODUCT_LABELS[l.productCategory])
    .map(l => ({
      name: PRODUCT_LABELS[l.productCategory] || l.productCategory,
      'Net Profit YTD': Number(l.netProfitYtd) || 0,
      'Net Profit Projected': Number(l.netProfitProjected) || 0,
    }))
    .filter(d => d['Net Profit YTD'] !== 0 || d['Net Profit Projected'] !== 0);

  if (data.length === 0) return <ChartEmpty label="Enter profitability data to see the chart" />;

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-text-secondary mb-2">Net Profit Comparison</h4>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11, ...CHART_FONT }} />
          <YAxis tick={{ fontSize: 11, ...CHART_FONT }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
          <Tooltip
            formatter={(value: number) => value.toLocaleString('en-MY', { maximumFractionDigits: 2 })}
            contentStyle={{ fontSize: 12, ...CHART_FONT }}
          />
          <Legend wrapperStyle={{ fontSize: 11, ...CHART_FONT }} />
          <Bar dataKey="Net Profit YTD" fill={COLORS.brand} radius={[3, 3, 0, 0]} />
          <Bar dataKey="Net Profit Projected" fill={COLORS.brandLight} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Wallet Share Chart ───────────────────────────────────────────────────────────

type WalletRow = {
  facilityType?: string;
  ourLimitAmount?: string | number | null;
  totalMarketAmount?: string | number | null;
  ourSharePct?: string | number | null;
  yoyChangePct?: string | number | null;
};

export const WalletShareChart: React.FC<{ rows: WalletRow[] }> = ({ rows }) => {
  const data = rows
    .filter(r => r.facilityType && (Number(r.ourSharePct) > 0 || Number(r.totalMarketAmount) > 0))
    .map(r => ({
      name: r.facilityType!.length > 14 ? r.facilityType!.slice(0, 12) + '…' : r.facilityType!,
      fullName: r.facilityType,
      'Our Share %': Number(r.ourSharePct) || 0,
      'Remaining %': Math.max(0, 100 - (Number(r.ourSharePct) || 0)),
    }));

  if (data.length === 0) return <ChartEmpty label="Enter wallet share data to see the chart" />;

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-text-secondary mb-2">Wallet Share Distribution</h4>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 40 + 40)}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, ...CHART_FONT }} tickFormatter={v => `${v}%`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, ...CHART_FONT }} width={100} />
          <Tooltip formatter={(value: number, name: string) => name === 'Our Share %' ? `${value}%` : `${value}%`} contentStyle={{ fontSize: 12, ...CHART_FONT }} />
          <Legend wrapperStyle={{ fontSize: 11, ...CHART_FONT }} />
          <Bar dataKey="Our Share %" fill={COLORS.brand} radius={[0, 3, 3, 0]} stackId="a" />
          <Bar dataKey="Remaining %" fill={COLORS.grayLight} radius={[0, 3, 3, 0]} stackId="a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Cashflow Projection Line Chart ───────────────────────────────────────────────

type ProjectionLine = {
  lineKey: string;
  label: string;
  values: Record<number, number>; // year -> amount
};

export const CashflowProjectionChart: React.FC<{ lines: ProjectionLine[] }> = ({ lines }) => {
  const years = [1, 2, 3, 4, 5];
  const data = years.map(y => {
    const point: Record<string, string | number> = { year: `Y${y}` };
    lines.forEach(l => {
      point[l.label] = l.values[y] ?? 0;
    });
    return point;
  });

  const hasData = lines.some(l => years.some(y => (l.values[y] ?? 0) !== 0));
  if (!hasData) return <ChartEmpty label="Enter projection data to see the trend chart" />;

  const lineColors: Record<string, string> = {
    'Revenue / Sales': COLORS.green,
    'Total Inflow': COLORS.brandLight,
    'Operating Costs': COLORS.red,
    'Net Cashflow': COLORS.brand,
    'DSCR': COLORS.amber,
    'Gearing Ratio': COLORS.gray,
  };

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-text-secondary mb-2">Cashflow Projection Trend</h4>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" tick={{ fontSize: 11, ...CHART_FONT }} />
          <YAxis tick={{ fontSize: 11, ...CHART_FONT }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
          <Tooltip formatter={(value: number) => value.toLocaleString('en-MY', { maximumFractionDigits: 2 })} contentStyle={{ fontSize: 12, ...CHART_FONT }} />
          <Legend wrapperStyle={{ fontSize: 11, ...CHART_FONT }} />
          {lines.map(l => (
            <Line
              key={l.lineKey}
              type="monotone"
              dataKey={l.label}
              stroke={lineColors[l.label] || COLORS.brand}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Sensitivity Scenario Grouped Bar ────────────────────────────────────────────

type ScenarioData = {
  scenario: string;
  label: string;
  revenueAmount?: string | number | null;
  opCashflow?: string | number | null;
  ebitda?: string | number | null;
  financingCosts?: string | number | null;
  gearingRatio?: string | number | null;
  dscr?: string | number | null;
};

const SCENARIO_LABELS: Record<string, string> = {
  BASE: 'Base Case',
  SCENARIO_1: 'Scenario 1',
  SCENARIO_2: 'Scenario 2',
  SCENARIO_3: 'Scenario 3',
};

export const SensitivityScenarioChart: React.FC<{ scenarios: ScenarioData[] }> = ({ scenarios }) => {
  const data = scenarios
    .filter(s => s.scenario)
    .map(s => ({
      name: s.label || SCENARIO_LABELS[s.scenario] || s.scenario,
      'Revenue': Number(s.revenueAmount) || 0,
      'EBITDA': Number(s.ebitda) || 0,
      'DSCR': Number(s.dscr) || 0,
    }))
    .filter(d => d.Revenue !== 0 || d.EBITDA !== 0 || d.DSCR !== 0);

  if (data.length === 0) return <ChartEmpty label="Enter scenario data to see the comparison chart" />;

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-text-secondary mb-2">Scenario Comparison</h4>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11, ...CHART_FONT }} />
          <YAxis tick={{ fontSize: 11, ...CHART_FONT }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
          <Tooltip formatter={(value: number) => value.toLocaleString('en-MY', { maximumFractionDigits: 2 })} contentStyle={{ fontSize: 12, ...CHART_FONT }} />
          <Legend wrapperStyle={{ fontSize: 11, ...CHART_FONT }} />
          <Bar dataKey="Revenue" fill={COLORS.green} radius={[3, 3, 0, 0]} />
          <Bar dataKey="EBITDA" fill={COLORS.brand} radius={[3, 3, 0, 0]} />
          <Bar dataKey="DSCR" fill={COLORS.amber} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Risk Rating Gauge / KPI Cards ────────────────────────────────────────────────

type ExternalRating = {
  agency: string;
  subjectType: string;
  subjectName?: string | null;
  rating: string;
  outlook?: string | null;
  ratingDate?: string | null;
};

type EclSnapshot = {
  id: string;
  subjectType: string;
  subjectName?: string | null;
  snapshotDate: string;
  mfrsStage?: string | null;
  totalOutstanding?: string | number | null;
  pdPct?: string | number | null;
  lgdPct?: string | number | null;
  lossRatePct?: string | number | null;
  eclAmount?: string | number | null;
};

const RATING_ORDER = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D', 'NR'];

const RATING_COLORS: Record<string, string> = {
  AAA: '#16a34a', AA: '#22c55e', A: '#4ade80',
  BBB: '#eab308', BB: '#f97316', B: '#ea580c',
  CCC: '#dc2626', CC: '#b91c1c', C: '#991b1b', D: '#7f1d1d', NR: '#9ca3af',
};

const fmt = (v: number | string | null | undefined) =>
  v != null && v !== '' ? Number(v).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

const pct = (v: number | string | null | undefined) =>
  v != null && v !== '' ? `${(Number(v) * 100).toFixed(2)}%` : '—';

export const RiskRatingKpiCards: React.FC<{
  ratings: ExternalRating[];
  snapshots: EclSnapshot[];
  internalScore?: number | null;
  internalRating?: string | null;
}> = ({ ratings, snapshots, internalScore, internalRating }) => {
  // Determine best (highest quality) external rating
  const bestRating = ratings.length > 0
    ? ratings.reduce((best, r) => {
        const bi = RATING_ORDER.indexOf(best);
        const ri = RATING_ORDER.indexOf(r.rating);
        return ri < bi ? r.rating : best;
      }, 'NR')
    : null;

  // Sum ECL
  const totalEcl = snapshots.reduce((sum, s) => sum + (Number(s.eclAmount) || 0), 0);
  const totalOutstanding = snapshots.reduce((sum, s) => sum + (Number(s.totalOutstanding) || 0), 0);

  const cards: { icon: string; label: string; value: string; sub?: string; color: string }[] = [];

  // Internal score card
  if (internalScore != null || internalRating) {
    cards.push({
      icon: 'speed',
      label: 'Internal Score',
      value: internalRating || 'NR',
      sub: internalScore != null ? `Score: ${internalScore}` : undefined,
      color: RATING_COLORS[internalRating || 'NR'] || '#6b7280',
    });
  }

  // Best external rating card
  if (bestRating) {
    cards.push({
      icon: 'verified',
      label: 'Best External Rating',
      value: bestRating,
      sub: `${ratings.length} rating${ratings.length !== 1 ? 's' : ''}`,
      color: RATING_COLORS[bestRating] || '#6b7280',
    });
  }

  // Total ECL card
  cards.push({
    icon: 'account_balance',
    label: 'Total ECL',
    value: `RM ${fmt(totalEcl)}`,
    sub: totalOutstanding > 0 ? `O/S: RM ${fmt(totalOutstanding)}` : undefined,
    color: '#0052cc',
  });

  // ECL stage breakdown
  const stages = new Set(snapshots.map(s => s.mfrsStage).filter(Boolean));
  if (stages.size > 0) {
    const stageSummary = Array.from(stages).map(s => {
      const stageSnaps = snapshots.filter(sn => sn.mfrsStage === s);
      const stageEcl = stageSnaps.reduce((sum, sn) => sum + (Number(sn.eclAmount) || 0), 0);
      return `${s.replace('_', ' ')}: RM ${fmt(stageEcl)}`;
    }).join(' · ');
    cards.push({
      icon: 'layer_stack',
      label: 'ECL by Stage',
      value: `${stages.size} stage${stages.size !== 1 ? 's' : ''}`,
      sub: stageSummary,
      color: '#7c3aed',
    });
  }

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map((card, idx) => (
        <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col items-center text-center">
          <span className="material-symbols-outlined text-2xl mb-1" style={{ color: card.color }}>{card.icon}</span>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">{card.label}</p>
          <p className="text-lg font-bold text-text-primary">{card.value}</p>
          {card.sub && <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>}
        </div>
      ))}
    </div>
  );
};

// ─── Rating Scale Bar ─────────────────────────────────────────────────────────

export const RatingScaleBar: React.FC<{ currentRating?: string | null; ratings?: ExternalRating[] }> = ({ currentRating, ratings }) => {
  const activeRatings = new Set<string>();
  if (currentRating) activeRatings.add(currentRating);
  if (ratings) ratings.forEach(r => { if (r.rating) activeRatings.add(r.rating); });

  if (activeRatings.size === 0) return null;

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-text-secondary mb-2">Rating Scale</h4>
      <div className="flex gap-1">
        {RATING_ORDER.map(r => {
          const active = activeRatings.has(r);
          const isCurrent = r === currentRating;
          return (
            <div
              key={r}
              className={`flex-1 text-center py-2 px-1 rounded text-xs font-bold transition-all ${
                isCurrent
                  ? 'ring-2 ring-offset-1 scale-105'
                  : active
                    ? 'opacity-90'
                    : 'opacity-30'
              }`}
              style={{
                backgroundColor: RATING_COLORS[r] || '#9ca3af',
                color: '#fff',
                ...(isCurrent ? { outline: `2px solid ${RATING_COLORS[r] || '#9ca3af'}`, outlineOffset: '2px' } : {}),
              }}
            >
              {r}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-green-600 font-medium">Investment Grade</span>
        <span className="text-[10px] text-red-600 font-medium">Speculative Grade</span>
      </div>
    </div>
  );
};