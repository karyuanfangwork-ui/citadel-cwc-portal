import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, LineChart, Line,
  RadarChart, Radar, PolarAngleAxis, PolarRadiusAxis, PolarGrid,
  PieChart, Pie, AreaChart, Area, ReferenceLine,
  ComposedChart,
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
      icon: 'layers',
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

// ─── ECL Forecast Bar Chart ─────────────────────────────────────────────────

type EclForecastRow = {
  forecastYear: number;
  mfrsStage: string | null;
  eclAmount: string | number | null;
  pdPct: string | number | null;
  lgdPct: string | number | null;
};

export const EclForecastBar: React.FC<{ forecasts: EclForecastRow[] }> = ({ forecasts }) => {
  const data = forecasts
    .filter(f => f.forecastYear != null)
    .map(f => ({
      year: `Y${f.forecastYear}`,
      'ECL Amount': Number(f.eclAmount) || 0,
      'PD%': (Number(f.pdPct) || 0) * 100,
      'LGD%': (Number(f.lgdPct) || 0) * 100,
    }))
    .filter(d => d['ECL Amount'] !== 0 || d['PD%'] !== 0 || d['LGD%'] !== 0);

  if (data.length === 0) return <ChartEmpty label="Enter ECL forecast data to see the chart" />;

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-text-secondary mb-2">ECL Forecast by Year</h4>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" tick={{ fontSize: 11, ...CHART_FONT }} />
          <YAxis yAxisId="amount" tick={{ fontSize: 11, ...CHART_FONT }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
          <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 11, ...CHART_FONT }} tickFormatter={v => `${v.toFixed(1)}%`} />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === 'ECL Amount') return fmt(value);
              return `${value.toFixed(2)}%`;
            }}
            contentStyle={{ fontSize: 12, ...CHART_FONT }}
          />
          <Legend wrapperStyle={{ fontSize: 11, ...CHART_FONT }} />
          <Bar yAxisId="amount" dataKey="ECL Amount" fill={COLORS.brand} radius={[3, 3, 0, 0]} />
          <Bar yAxisId="pct" dataKey="PD%" fill={COLORS.amber} radius={[3, 3, 0, 0]} />
          <Bar yAxisId="pct" dataKey="LGD%" fill={COLORS.red} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── ECL Stage Donut ────────────────────────────────────────────────────────

type EclStageSnapshot = {
  mfrsStage?: string | null;
  eclAmount?: string | number | null;
};

const STAGE_LABELS: Record<string, string> = {
  STAGE_1: 'Stage 1',
  STAGE_2: 'Stage 2',
  STAGE_3: 'Stage 3',
};

const STAGE_COLORS: Record<string, string> = {
  STAGE_1: COLORS.green,
  STAGE_2: COLORS.amber,
  STAGE_3: COLORS.red,
  UNKNOWN: COLORS.gray,
};

export const EclStageDonut: React.FC<{ snapshots: EclStageSnapshot[] }> = ({ snapshots }) => {
  const grouped: Record<string, number> = {};
  snapshots.forEach(s => {
    const stage = s.mfrsStage || 'UNKNOWN';
    grouped[stage] = (grouped[stage] || 0) + (Number(s.eclAmount) || 0);
  });

  const data = Object.entries(grouped)
    .filter(([, val]) => val > 0)
    .map(([stage, val]) => ({
      name: STAGE_LABELS[stage] || stage.replace(/_/g, ' '),
      value: val,
      stage,
    }));

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (data.length === 0) return <ChartEmpty label="Enter ECL stage data to see the donut chart" />;

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-text-secondary mb-2">ECL by MFRS Stage</h4>
      <div className="relative">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              dataKey="value"
              label={({ name, value }) => `${name}: RM ${fmt(value)}`}
              labelLine
            >
              {data.map((entry, idx) => (
                <Cell key={idx} fill={STAGE_COLORS[entry.stage] || COLORS.gray} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => fmt(value)}
              contentStyle={{ fontSize: 12, ...CHART_FONT }}
            />
            <Legend wrapperStyle={{ fontSize: 11, ...CHART_FONT }} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: 0 }}>
          <span className="text-xs text-gray-500">Total ECL</span>
          <span className="text-sm font-bold text-text-primary">RM {fmt(total)}</span>
        </div>
      </div>
    </div>
  );
};

// ─── DSCR Trend Line ────────────────────────────────────────────────────────

type DscrTrendLineProps = {
  lines: { lineKey: string; label: string; values: Record<number, number> }[];
};

export const DscrTrendLine: React.FC<DscrTrendLineProps> = ({ lines }) => {
  const dscrLine = lines.find(l => l.lineKey.toLowerCase() === 'dscr');

  if (!dscrLine) return <ChartEmpty label="No DSCR data available" />;

  const years = [1, 2, 3, 4, 5];
  const data = years.map(y => ({
    year: `Y${y}`,
    DSCR: dscrLine.values[y] ?? 0,
  }));

  const allZero = data.every(d => d.DSCR === 0);
  if (allZero) return <ChartEmpty label="No DSCR data available" />;

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-text-secondary mb-2">DSCR Trend</h4>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" tick={{ fontSize: 11, ...CHART_FONT }} />
          <YAxis tick={{ fontSize: 11, ...CHART_FONT }} />
          <ReferenceLine y={1.0} stroke={COLORS.red} strokeDasharray="6 4" label={{ value: 'Min Threshold (1.0x)', position: 'insideTopRight', style: { fontSize: 10, fill: COLORS.red, ...CHART_FONT } }} />
          <Tooltip formatter={(value: number) => `${value.toFixed(2)}x`} contentStyle={{ fontSize: 12, ...CHART_FONT }} />
          <Legend wrapperStyle={{ fontSize: 11, ...CHART_FONT }} />
          <Line type="monotone" dataKey="DSCR" stroke={COLORS.brand} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Gearing Ratio Line (Area) ──────────────────────────────────────────────

type GearingRatioLineProps = {
  lines: { lineKey: string; label: string; values: Record<number, number> }[];
};

export const GearingRatioLine: React.FC<GearingRatioLineProps> = ({ lines }) => {
  const gearingLine = lines.find(l => l.lineKey.toLowerCase() === 'gearing');

  if (!gearingLine) return <ChartEmpty label="No Gearing Ratio data available" />;

  const years = [1, 2, 3, 4, 5];
  const data = years.map(y => ({
    year: `Y${y}`,
    'Gearing Ratio': gearingLine.values[y] ?? 0,
  }));

  const allZero = data.every(d => d['Gearing Ratio'] === 0);
  if (allZero) return <ChartEmpty label="No Gearing Ratio data available" />;

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-text-secondary mb-2">Gearing Ratio Trend</h4>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" tick={{ fontSize: 11, ...CHART_FONT }} />
          <YAxis tick={{ fontSize: 11, ...CHART_FONT }} />
          <Tooltip formatter={(value: number) => `${value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`} contentStyle={{ fontSize: 12, ...CHART_FONT }} />
          <Legend wrapperStyle={{ fontSize: 11, ...CHART_FONT }} />
          <Area type="monotone" dataKey="Gearing Ratio" stroke={COLORS.amber} fill={COLORS.amberLight} fillOpacity={0.3} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Financial Ratio Radar ──────────────────────────────────────────────────

type FinancialRatioItem = {
  ratioKey: string;
  ratioLabel: string;
  category: string;
  value: number;
  previousValue: number | null;
  trend: string | null;
};

const RATIO_CATEGORIES = ['PROFITABILITY', 'LEVERAGE', 'LIQUIDITY', 'COVERAGE', 'ACTIVITY'] as const;

export const FinancialRatioRadar: React.FC<{ ratios: FinancialRatioItem[] }> = ({ ratios }) => {
  // Compute per-ratio normalized scores (0–100 scale) so incommensurable ratios
  // (e.g. Net Profit Margin 15% vs ROA 5%) can be compared on a radar.
  // Normalization: each ratio maps to (value - min) / (max - min) * 100 across ALL ratios.
  const allCurrentValues = ratios.map(r => r.value || 0);
  const globalMin = Math.min(...allCurrentValues, 0);
  const globalMax = Math.max(...allCurrentValues, 1);
  const globalRange = globalMax - globalMin || 1;
  const normalize = (v: number) => Math.round(((v - globalMin) / globalRange) * 100);

  // Also normalize previous values on same scale
  const allPreviousValues = ratios.filter(r => r.previousValue != null).map(r => r.previousValue!);
  const prevMin = allPreviousValues.length > 0 ? Math.min(...allPreviousValues, globalMin) : globalMin;
  const prevMax = allPreviousValues.length > 0 ? Math.max(...allPreviousValues, globalMax) : globalMax;
  const prevRange = prevMax - prevMin || 1;
  const normalizePrev = (v: number) => Math.round(((v - prevMin) / prevRange) * 100);

  // Average normalized scores per category
  const catMap: Record<string, { sumCurrent: number; sumPrevious: number; currentCount: number; previousCount: number }> = {};

  ratios.forEach(r => {
    const cat = r.category;
    if (!catMap[cat]) catMap[cat] = { sumCurrent: 0, sumPrevious: 0, currentCount: 0, previousCount: 0 };
    catMap[cat].sumCurrent += normalize(r.value || 0);
    catMap[cat].currentCount += 1;
    if (r.previousValue != null) {
      catMap[cat].sumPrevious += normalizePrev(r.previousValue);
      catMap[cat].previousCount += 1;
    }
  });

  const categoriesWithData = RATIO_CATEGORIES.filter(cat => catMap[cat] && catMap[cat].currentCount > 0);

  if (categoriesWithData.length < 3) return <ChartEmpty label="Need at least 3 ratio categories to show radar chart" />;

  const hasPrevious = ratios.some(r => r.previousValue != null);

  const data = categoriesWithData.map(cat => {
    const info = catMap[cat];
    return {
      category: cat.charAt(0) + cat.slice(1).toLowerCase(),
      Current: info.currentCount > 0 ? Math.round(info.sumCurrent / info.currentCount) : 0,
      ...(hasPrevious ? { Previous: info.previousCount > 0 ? Math.round(info.sumPrevious / info.previousCount) : 0 } : {}),
    };
  });

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-text-secondary mb-2">Financial Ratio Profile (Normalized 0–100)</h4>
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="category" tick={{ fontSize: 11, ...CHART_FONT }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, ...CHART_FONT }} />
          <Tooltip contentStyle={{ fontSize: 12, ...CHART_FONT }} formatter={(value: number) => [`${value}`, '']} />
          <Legend wrapperStyle={{ fontSize: 11, ...CHART_FONT }} />
          <Radar name="Current" dataKey="Current" stroke={COLORS.brand} fill={COLORS.brand} fillOpacity={0.2} />
          {hasPrevious && (
            <Radar name="Previous" dataKey="Previous" stroke={COLORS.grayLight} fill={COLORS.grayLight} fillOpacity={0.1} strokeDasharray="5 5" />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Balance Sheet Composition ──────────────────────────────────────────────

type BalanceSheetLineItem = {
  lineKey: string;
  lineLabel: string;
  amount: string | number;
  displayOrder: number;
};

type BalanceSheetValidation = {
  valid: boolean;
  difference: number;
  totalAssets: number;
  totalLiabilitiesEquity: number;
};

const BS_KEY_MAP: Record<string, string> = {
  total_assets: 'totalAssets',
  total_current_assets: 'totalCurrentAssets',
  total_non_current_assets: 'totalNonCurrentAssets',
  total_liabilities: 'totalLiabilities',
  total_current_liabilities: 'totalCurrentLiabilities',
  total_non_current_liabilities: 'totalNonCurrentLiabilities',
  total_equity: 'totalEquity',
  totalAssets: 'totalAssets',
  totalCurrentAssets: 'totalCurrentAssets',
  totalNonCurrentAssets: 'totalNonCurrentAssets',
  totalLiabilities: 'totalLiabilities',
  totalCurrentLiabilities: 'totalCurrentLiabilities',
  totalNonCurrentLiabilities: 'totalNonCurrentLiabilities',
  totalEquity: 'totalEquity',
};

export const BalanceSheetComposition: React.FC<{
  lineItems: BalanceSheetLineItem[];
  validation?: BalanceSheetValidation | null;
}> = ({ lineItems, validation }) => {
  const items: Record<string, number> = {};
  lineItems.forEach(item => {
    const normalized = BS_KEY_MAP[item.lineKey];
    if (normalized) {
      items[normalized] = Number(item.amount) || 0;
    }
  });

  const currentAssets = items.totalCurrentAssets || 0;
  const nonCurrentAssets = items.totalNonCurrentAssets || 0;
  const currentLiabilities = items.totalCurrentLiabilities || 0;
  const nonCurrentLiabilities = items.totalNonCurrentLiabilities || 0;
  const equity = items.totalEquity || 0;

  const hasAssets = currentAssets > 0 || nonCurrentAssets > 0;
  const hasLiabEquity = currentLiabilities > 0 || nonCurrentLiabilities > 0 || equity > 0;

  if (!hasAssets && !hasLiabEquity) return <ChartEmpty label="Enter balance sheet data to see the composition chart" />;

  const data = [
    {
      side: 'Assets',
      'Current Assets': currentAssets,
      'Non-Current Assets': nonCurrentAssets,
      'Current Liabilities': 0,
      'Non-Current Liabilities': 0,
      'Equity': 0,
    },
    {
      side: 'Liabilities & Equity',
      'Current Assets': 0,
      'Non-Current Assets': 0,
      'Current Liabilities': currentLiabilities,
      'Non-Current Liabilities': nonCurrentLiabilities,
      'Equity': equity,
    },
  ];

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-text-secondary mb-2">Balance Sheet Composition</h4>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" tick={{ fontSize: 11, ...CHART_FONT }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
          <YAxis type="category" dataKey="side" tick={{ fontSize: 11, ...CHART_FONT }} width={120} />
          <Tooltip formatter={(value: number) => fmt(value)} contentStyle={{ fontSize: 12, ...CHART_FONT }} />
          <Legend wrapperStyle={{ fontSize: 11, ...CHART_FONT }} />
          <Bar dataKey="Current Assets" stackId="a" fill={COLORS.brand} />
          <Bar dataKey="Non-Current Assets" stackId="a" fill={COLORS.brandLight} />
          <Bar dataKey="Current Liabilities" stackId="b" fill={COLORS.red} />
          <Bar dataKey="Non-Current Liabilities" stackId="b" fill={COLORS.redLight} />
          <Bar dataKey="Equity" stackId="b" fill={COLORS.green} />
        </BarChart>
      </ResponsiveContainer>
      {validation && (
        <div className="mt-2 text-xs font-medium text-center">
          {validation.valid ? (
            <span style={{ color: COLORS.green }}>Balanced</span>
          ) : (
            <span style={{ color: COLORS.red }}>Difference: RM {fmt(validation.difference)}</span>
          )}
        </div>
      )}
    </div>
  );
};

// ─── ECL Snapshot Waterfall (Current vs Forecast Delta) ────────────────────

type EclSnapshotRow = {
  mfrsStage: string | null;
  eclAmount: string | number | null;
  snapshotDate: string;
};

type EclForecastRowForWaterfall = {
  forecastYear: number;
  mfrsStage: string | null;
  eclAmount: string | number | null;
};

const STAGE_ORDER = ['STAGE_1', 'STAGE_2', 'STAGE_3'] as const;
const STAGE_DISPLAY: Record<string, string> = {
  STAGE_1: 'Stage 1',
  STAGE_2: 'Stage 2',
  STAGE_3: 'Stage 3',
  UNKNOWN: 'Unstaged',
};

export const EclSnapshotWaterfall: React.FC<{
  snapshots: EclSnapshotRow[];
  forecasts: EclForecastRowForWaterfall[];
}> = ({ snapshots, forecasts }) => {
  // Aggregate current ECL by stage
  const currentByStage: Record<string, number> = {};
  snapshots.forEach(s => {
    const stage = s.mfrsStage || 'UNKNOWN';
    currentByStage[stage] = (currentByStage[stage] || 0) + (Number(s.eclAmount) || 0);
  });

  // Aggregate forecast ECL by stage (sum Y1-Y3)
  const forecastByStage: Record<string, number> = {};
  forecasts.forEach(f => {
    const stage = f.mfrsStage || 'UNKNOWN';
    forecastByStage[stage] = (forecastByStage[stage] || 0) + (Number(f.eclAmount) || 0);
  });

  // Merge stages from both
  const allStages = Array.from(new Set([
    ...Object.keys(currentByStage),
    ...Object.keys(forecastByStage),
  ])).sort((a, b) => {
    const ai = STAGE_ORDER.indexOf(a as any);
    const bi = STAGE_ORDER.indexOf(b as any);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const data = allStages.map(stage => ({
    stage: STAGE_DISPLAY[stage] || stage.replace(/_/g, ' '),
    Current: currentByStage[stage] || 0,
    Forecast: forecastByStage[stage] || 0,
    Delta: (forecastByStage[stage] || 0) - (currentByStage[stage] || 0),
  }));

  const hasData = data.some(d => d.Current !== 0 || d.Forecast !== 0);
  if (!hasData) return <ChartEmpty label="Enter ECL data to see the waterfall comparison" />;

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-text-secondary mb-2">ECL Current vs Forecast (by Stage)</h4>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="stage" tick={{ fontSize: 11, ...CHART_FONT }} />
          <YAxis tick={{ fontSize: 11, ...CHART_FONT }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
          <Tooltip
            formatter={(value: number, name: string) => {
              const prefix = name === 'Delta' ? (value >= 0 ? '+' : '') : '';
              return `${prefix}${fmt(value)}`;
            }}
            contentStyle={{ fontSize: 12, ...CHART_FONT }}
          />
          <Legend wrapperStyle={{ fontSize: 11, ...CHART_FONT }} />
          <Bar dataKey="Current" fill={COLORS.brand} radius={[3, 3, 0, 0]} />
          <Bar dataKey="Forecast" fill={COLORS.brandLight} radius={[3, 3, 0, 0]} />
          <ReferenceLine y={0} stroke="#9ca3af" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Ratio Sparklines (per-category mini trends) ──────────────────────────

type TrendDataPointRow = {
  fiscalYearEnd: string;
  value: number;
};

type TrendItemRow = {
  ratioKey: string;
  ratioLabel: string;
  category: string;
  dataPoints: TrendDataPointRow[];
  direction: 'improving' | 'stable' | 'declining';
};

const SPARKLINE_CATEGORIES = ['PROFITABILITY', 'LEVERAGE', 'LIQUIDITY', 'COVERAGE', 'ACTIVITY'] as const;
const SPARKLINE_COLORS: Record<string, string> = {
  PROFITABILITY: COLORS.green,
  LEVERAGE: COLORS.amber,
  LIQUIDITY: COLORS.brand,
  COVERAGE: COLORS.brandLight,
  ACTIVITY: COLORS.gray,
};
const SPARKLINE_DIR_ICON: Record<string, string> = {
  improving: 'trending_up',
  stable: 'trending_flat',
  declining: 'trending_down',
};
const SPARKLINE_DIR_COLOR: Record<string, string> = {
  improving: COLORS.green,
  stable: COLORS.gray,
  declining: COLORS.red,
};

export const RatioSparklines: React.FC<{ trends: TrendItemRow[] }> = ({ trends }) => {
  if (!trends || trends.length === 0) return <ChartEmpty label="Compute ratios to see trend sparklines" />;

  // Group trends by category
  const byCategory: Record<string, TrendItemRow[]> = {};
  trends.forEach(t => {
    const cat = t.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(t);
  });

  const sortedCategories = SPARKLINE_CATEGORIES.filter(cat => byCategory[cat] && byCategory[cat].length > 0);

  if (sortedCategories.length === 0) return <ChartEmpty label="No ratio trends available" />;

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-text-secondary mb-3">Ratio Trends</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedCategories.map(cat => {
          const items = byCategory[cat];
          const color = SPARKLINE_COLORS[cat] || COLORS.brand;
          return (
            <div key={cat} className="border border-gray-200 rounded-lg p-3">
              <h5 className="text-xs font-semibold text-text-secondary mb-2 capitalize">{cat}</h5>
              {items.map(trend => {
                const sorted = [...trend.dataPoints].sort((a, b) =>
                  a.fiscalYearEnd.localeCompare(b.fiscalYearEnd)
                );
                const chartData = sorted.map(dp => ({
                  year: dp.fiscalYearEnd.substring(0, 4),
                  value: dp.value,
                }));
                if (chartData.length < 2) return null;
                return (
                  <div key={trend.ratioKey} className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-text-primary truncate">{trend.ratioLabel}</span>
                      <span className="material-symbols-outlined text-xs" style={{
                        color: SPARKLINE_DIR_COLOR[trend.direction] || COLORS.gray,
                        fontSize: 14,
                      }}>
                        {SPARKLINE_DIR_ICON[trend.direction] || 'trending_flat'}
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height={40}>
                      <LineChart data={chartData} margin={{ top: 2, right: 4, left: 4, bottom: 0 }}>
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={color}
                          strokeWidth={1.5}
                          dot={{ r: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Score Run History (Timeline of past credit score runs) ──────────────

type ScoreRunRow = {
  totalScore: number;
  riskRating: string;
  overriddenRating: string | null;
  /** Execution timestamp — API returns 'runAt'; the old field name was 'executedAt' */
  executedAt?: string;
  runAt?: string;
  executedBy?: string;
};

const RATING_INDEX = (r: string) => {
  const i = RATING_ORDER.indexOf(r as any);
  return i === -1 ? RATING_ORDER.length : i;
};

export const ScoreRunHistory: React.FC<{ scoreRuns: ScoreRunRow[] }> = ({ scoreRuns }) => {
  if (!scoreRuns || scoreRuns.length === 0) return <ChartEmpty label="No score runs yet. Click 'Run Score' to generate a credit score." />;

  const sorted = [...scoreRuns].sort((a, b) => new Date(a.runAt || a.executedAt!).getTime() - new Date(b.runAt || b.executedAt!).getTime());
  const data = sorted.map(sr => ({
    date: new Date(sr.runAt || sr.executedAt!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }),
    Score: sr.totalScore,
    Rating: RATING_INDEX(sr.overriddenRating || sr.riskRating),
    ratingLabel: sr.overriddenRating || sr.riskRating,
    overridden: sr.overriddenRating ? sr.riskRating : null,
  }));

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-text-secondary mb-2">Score Run History</h4>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 11, ...CHART_FONT }} />
          <YAxis yAxisId="score" orientation="left" tick={{ fontSize: 11, ...CHART_FONT }} label={{ value: 'Score', angle: -90, position: 'insideLeft', style: { fontSize: 10, ...CHART_FONT } }} />
          <YAxis yAxisId="rating" orientation="right" reversed tick={{ fontSize: 11, ...CHART_FONT }} domain={[0, RATING_ORDER.length - 1]} ticks={RATING_ORDER.map((_, i) => i)} tickFormatter={v => RATING_ORDER[v] || ''} label={{ value: 'Rating', angle: 90, position: 'insideRight', style: { fontSize: 10, ...CHART_FONT } }} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 8, fontSize: 12, ...CHART_FONT }}>
                  <div>{d.date}</div>
                  <div>Score: <b>{d.Score}</b></div>
                  <div>Rating: <b>{d.ratingLabel}</b></div>
                  {d.overridden && <div style={{ color: COLORS.amber }}>Override from: {d.overridden}</div>}
                </div>
              );
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11, ...CHART_FONT }} />
          <Bar yAxisId="score" dataKey="Score" fill={COLORS.brand} radius={[3, 3, 0, 0]} />
          <Line yAxisId="rating" dataKey="Rating" stroke={COLORS.amber} strokeWidth={2} dot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── BS Validation Gauge (Balance Sheet check visual) ────────────────────

type BsValidationData = {
  valid: boolean;
  difference: number;
  totalAssets: number;
  totalLiabilitiesEquity: number;
};

export const BsValidationGauge: React.FC<{ validation: BsValidationData | null }> = ({ validation }) => {
  if (!validation) return <ChartEmpty label="Validate balance sheet to see the gauge" />;

  const { valid, difference, totalAssets, totalLiabilitiesEquity } = validation;
  const maxVal = Math.max(totalAssets, totalLiabilitiesEquity, 1);
  const diffPct = Math.min(Math.abs(difference) / maxVal * 100, 100);
  const color = valid ? COLORS.green : (diffPct < 5 ? COLORS.amber : COLORS.red);

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-text-secondary mb-2">Balance Sheet Validation</h4>
      <div className="flex items-center gap-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
        {/* Semi-circle gauge via SVG */}
        <svg viewBox="0 0 200 120" width="140" height="84">
          {/* Background arc */}
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e5e7eb" strokeWidth="16" strokeLinecap="round" />
          {/* Value arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={color}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${(100 - diffPct) / 100 * 251.3} 251.3`}
          />
          {/* Center text */}
          <text x="100" y="80" textAnchor="middle" style={{ fontSize: 18, fontWeight: 700, fill: color, ...CHART_FONT }}>
            {valid ? 'Balanced' : `${diffPct.toFixed(1)}%`}
          </text>
          <text x="100" y="100" textAnchor="middle" style={{ fontSize: 10, fill: '#6b7280', ...CHART_FONT }}>
            {valid ? 'Assets = L + E' : `Diff: RM ${Math.abs(difference).toLocaleString()}`}
          </text>
        </svg>

        {/* Summary numbers */}
        <div className="flex-1 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Total Assets</span>
            <span className="font-semibold text-text-primary">{fmt(totalAssets)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Total L + E</span>
            <span className="font-semibold text-text-primary">{fmt(totalLiabilitiesEquity)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Difference</span>
            <span className="font-semibold" style={{ color }}>{valid ? 'RM 0' : fmt(Math.abs(difference))}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Status</span>
            <span className="font-semibold" style={{ color }}>{valid ? 'Valid' : 'Imbalanced'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── P&L Waterfall (Income Statement contribution chart) ──────────────────

const PL_POSITIVE_KEYS = ['revenue', 'interest_income', 'fee_income', 'other_income', 'total_revenue', 'gross_profit', 'operating_profit', 'ebitda', 'profit_before_tax', 'net_profit'];
const PL_NEGATIVE_KEYS = ['cost_of_sales', 'operating_expenses', 'depreciation', 'interest_expense', 'tax', 'total_expenses', 'finance_costs', 'admin_expenses', 'selling_expenses'];

const plSign = (label: string): 'positive' | 'negative' | 'total' => {
  const key = label.toLowerCase().replace(/[\s_-]+/g, '_');
  if (key.includes('net_profit') || key.includes('net_income') || key.includes('profit_after_tax')) return 'total';
  if (PL_POSITIVE_KEYS.some(k => key.includes(k))) return 'positive';
  if (PL_NEGATIVE_KEYS.some(k => key.includes(k))) return 'negative';
  return 'positive'; // default to positive
};

type PlLineItemRow = {
  lineLabel: string;
  amount: number | string;
};

export const PlWaterfall: React.FC<{ lineItems: PlLineItemRow[] }> = ({ lineItems }) => {
  if (!lineItems || lineItems.length === 0) return <ChartEmpty label="Enter P&L data to see the waterfall chart" />;

  // Filter to items with amount values
  const items = lineItems.filter(li => li.amount != null && Number(li.amount) !== 0);
  if (items.length === 0) return <ChartEmpty label="No P&L line items with values" />;

  // Build waterfall data
  let running = 0;
  const data: { name: string; base: number; value: number; fill: string }[] = [];

  items.forEach(li => {
    const val = Number(li.amount) || 0;
    const sign = plSign(li.lineLabel);
    const isTotal = sign === 'total';

    if (isTotal) {
      // Totals start from 0
      data.push({ name: li.lineLabel, base: 0, value: Math.abs(val), fill: COLORS.brand });
      running = val;
    } else if (val >= 0) {
      data.push({ name: li.lineLabel, base: running, value: val, fill: COLORS.green });
      running += val;
    } else {
      const newRunning = running + val;
      data.push({ name: li.lineLabel, base: newRunning, value: Math.abs(val), fill: COLORS.red });
      running = newRunning;
    }
  });

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-text-secondary mb-2">P&L Waterfall (Current Year)</h4>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 9, ...CHART_FONT }} angle={-30} textAnchor="end" height={60} />
          <YAxis tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} tick={{ fontSize: 11, ...CHART_FONT }} />
          <Tooltip
            formatter={(value: number, name: string, props: any) => {
              const d = props.payload;
              return `${d.name}: RM ${value.toLocaleString()}`;
            }}
            contentStyle={{ fontSize: 12, ...CHART_FONT }}
          />
          {/* Invisible base bars */}
          <Bar dataKey="base" stackId="stack" fill="transparent" />
          {/* Visible value bars */}
          <Bar dataKey="value" stackId="stack" radius={[3, 3, 0, 0]}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};