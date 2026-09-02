import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import crmService, { CrmPipeline, CrmUser } from '../src/services/crm.service';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, FunnelChart, Funnel, LabelList,
} from 'recharts';

// ── Types ────────────────────────────────────────────────────────────────────

interface LeadConversionReport {
  bySource: Array<{ source: string; total: number; converted: number; lost: number; conversionRate: number }>;
  byStatus: Array<{ status: string; count: number }>;
  overallConversionRate: number;
  period: { from: string; to: string };
}

interface SalesPerformanceReport {
  byOwner: Array<{
    ownerId: string; ownerName: string; totalDeals: number; wonDeals: number;
    lostDeals: number; winRate: number; totalWonValue: number; totalLostValue: number; avgDealSize: number;
  }>;
  overallWinRate: number;
  totalRevenue: number;
  period: { from: string; to: string };
}

interface PipelineForecastReport {
  stages: Array<{ stageId: string; stageName: string; probability: number; dealCount: number; totalValue: number; weightedValue: number }>;
  totalPipelineValue: number;
  weightedPipelineValue: number;
  overdueDeals: number;
  overdueValue: number;
}

interface ActivitySummaryReport {
  byType: Array<{ activityType: string; count: number }>;
  byUser: Array<{ userId: string; userName: string; count: number; breakdown: Record<string, number> }>;
  totalActivities: number;
  period: { from: string; to: string };
}

interface DailyOperationalRow {
  date: string;
  emailsSent: number; newCalls: number; followUpCalls: number; meetings: number; whatsappTouches: number; siteVisits: number;
  emailBounces: number; callEngagement: number; interested: number; noAnswer: number; notInterested: number; wrongNumber: number; notReachable: number;
  meetingsArranged: number; meetingsPresented: number; meetingsCancelled: number; meetingsNoShow: number;
  leadsConverted: number; merchantsSignedUp: number; merchantsDeclined: number;
}

export const DAILY_OPERATIONAL_COLUMNS: Array<[string, keyof DailyOperationalRow]> = [
  ['Email Sent', 'emailsSent'], ['Bounce', 'emailBounces'], ['New Calls', 'newCalls'], ['Follow-up', 'followUpCalls'],
  ['Engagement', 'callEngagement'], ['Interested', 'interested'], ['No Answer', 'noAnswer'], ['Not Interested', 'notInterested'],
  ['Wrong Number', 'wrongNumber'], ['Not Reachable', 'notReachable'], ['WhatsApp', 'whatsappTouches'], ['Site Visits', 'siteVisits'],
  ['Meetings', 'meetings'], ['Arranged', 'meetingsArranged'], ['Presented', 'meetingsPresented'], ['Cancelled', 'meetingsCancelled'],
  ['No Show', 'meetingsNoShow'], ['Leads Converted', 'leadsConverted'], ['Signed Up', 'merchantsSignedUp'], ['Declined', 'merchantsDeclined'],
];

interface DailyOperationalCompanyRow extends Omit<DailyOperationalRow, 'date'> {
  companyName: string;
  accountId: string | null;
  activityCount: number;
}

interface DailyOperationalReport {
  daily: DailyOperationalRow[];
  totals: DailyOperationalRow;
  byCompany: DailyOperationalCompanyRow[];
  period: { from: string; to: string; timezone: string };
}

interface LeadAgingReport {
  byStatus: Array<{ status: string; count: number; avgAgeDays: number; maxAgeDays: number; leadsOver30Days: number; leadsOver60Days: number; leadsOver90Days: number }>;
  staleLeads: number;
  averageAgeAllLeads: number;
}

interface WinLossReport {
  byReason: Array<{ lostReason: string; count: number; totalValue: number }>;
  totalWon: { count: number; value: number };
  totalConvertedLeads: number;
  convertedLeads: Array<{
    id: string; title: string; companyName: string | null; accountName: string | null;
    ownerName: string; convertedAt: string;
  }>;
  totalLost: { count: number; value: number };
  totalLostLeads: number;
  lostLeads: Array<{
    id: string; title: string; companyName: string | null; accountName: string | null;
    ownerName: string; lostReason: string | null; updatedAt: string;
  }>;
  winRate: number;
  period: { from: string; to: string };
}

interface KycComplianceReport {
  byStatus: Array<{ status: string; count: number }>;
  expiringSoon: number;
  pendingCount: number;
  approvedCount: number;
  expiredCount: number;
  pepFlagged: number;
  totalContacts: number;
  complianceRate: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const myr = new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 });

function downloadCsv(data: Record<string, unknown>[], filename: string) {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const escapeCell = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const csv = [headers.join(','), ...data.map(row => headers.map(h => escapeCell(row[h])).join(','))].join('\n');
  // UTF-8 BOM lets Excel detect Unicode CSV content instead of decoding it as a legacy code page.
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const CsvBtn = ({ onClick, label }: { onClick: () => void; label?: string }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold border border-border bg-bg-surface text-text-secondary hover:bg-bg-subtle hover:text-text-primary transition-colors"
    style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
  >
    <span className="material-symbols-outlined text-sm">download</span>
    {label || 'Export CSV'}
  </button>
);

// ── Chart brand palette ────────────────────────────────────────────────────────
const CHART_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontSize: 12,
  fontFamily: 'var(--font-sans)',
};
const myrFormatter = (v: number) => myr.format(v);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function Skeleton() {
  return (
    <div>
      {[1, 2, 3, 4].map(i => (
        <div
          key={i}
          style={{ height: 18, marginBottom: 12, borderRadius: 6, background: 'var(--bg-subtle)', animation: 'pulse 1.5s infinite' }}
        />
      ))}
    </div>
  );
}

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'lead-conversion', label: 'Lead Conversion' },
  { id: 'sales-performance', label: 'Sales Performance' },
  { id: 'pipeline-forecast', label: 'Pipeline Forecast' },
  { id: 'forecast-categories', label: 'Forecast by Category' },
  { id: 'forecast-accuracy', label: 'Forecast Accuracy' },
  { id: 'activity-summary', label: 'Activity Summary' },
  { id: 'daily-operational', label: 'Daily Operational' },
  { id: 'lead-aging', label: 'Lead Aging' },
  { id: 'win-loss', label: 'Win/Loss' },
  { id: 'kyc-compliance', label: 'KYC Compliance' },
] as const;
type TabId = typeof TABS[number]['id'];
const DATE_TABS: TabId[] = ['lead-conversion', 'sales-performance', 'activity-summary', 'daily-operational', 'win-loss', 'forecast-accuracy'];

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusChips({ items }: { items: Array<{ status: string; count: number }> }) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {items.map(s => (
        <span key={s.status} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-bg-subtle border border-border text-text-secondary">
          {s.status} <span className="font-bold text-text-primary">{s.count}</span>
        </span>
      ))}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-bg-surface border border-border rounded-xl p-5 flex flex-col gap-1">
      <span className="text-xs text-text-secondary uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-text-primary">{value}</span>
    </div>
  );
}

const DATE_PRESETS = [
  { label: 'This Month', from: () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }, to: () => todayStr() },
  { label: 'Last 30 Days', from: () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); }, to: () => todayStr() },
  { label: 'Last Quarter', from: () => { const d = new Date(); const q = Math.floor(d.getMonth() / 3) * 3; d.setMonth(q, 1); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10); }, to: () => { const d = new Date(); const q = Math.floor(d.getMonth() / 3) * 3; d.setMonth(q, 1); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); } },
  { label: 'Year to Date', from: () => { const d = new Date(); return `${d.getFullYear()}-01-01`; }, to: () => todayStr() },
] as const;

function DateRangeRow({
  from, to, onFromChange, onToChange, onRefresh,
}: {
  from: string; to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onRefresh: () => void;
}) {
  const invalid = from && to && from > to;
  return (
    <div className="space-y-3 mb-5">
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2">
        {DATE_PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => { onFromChange(p.from()); onToChange(p.to()); }}
            className="px-3 py-1 rounded-lg text-xs font-medium border border-border bg-bg-surface text-text-secondary hover:bg-bg-subtle hover:text-text-primary hover:border-brand-300 transition-colors"
            style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
          >
            {p.label}
          </button>
        ))}
      </div>
      {/* Date inputs + refresh */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          From:
          <input
            type="date"
            value={from}
            onChange={e => onFromChange(e.target.value)}
            className={`border ${invalid ? 'border-red-500 focus:ring-red-200' : 'border-border focus:ring-brand-500'} rounded-lg px-3 py-1.5 text-sm bg-bg-surface text-text-primary focus:outline-none focus:ring-2`}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          To:
          <input
            type="date"
            value={to}
            onChange={e => onToChange(e.target.value)}
            className={`border ${invalid ? 'border-red-500 focus:ring-red-200' : 'border-border focus:ring-brand-500'} rounded-lg px-3 py-1.5 text-sm bg-bg-surface text-text-primary focus:outline-none focus:ring-2`}
          />
        </label>
        <button
          onClick={onRefresh}
          disabled={invalid}
          className="px-4 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Refresh
        </button>
        {invalid && <span className="text-xs text-red-600">"From" must be before "To"</span>}
      </div>
    </div>
  );
}

// ── Tab panels ────────────────────────────────────────────────────────────────

function LeadConversionPanel({ from, to }: { from: string; to: string }) {
  const [data, setData] = React.useState<LeadConversionReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const key = `${from}|${to}`;

  React.useEffect(() => {
    setLoading(true);
    crmService.getLeadConversionReport({ from, to })
      .then(setData)
      .finally(() => setLoading(false));
  }, [key]);

  const handleExport = () => {
    if (!data) return;
    downloadCsv(
      data.bySource.map(r => ({ Source: r.source, Total: r.total, Converted: r.converted, Lost: r.lost, 'Conv. Rate': r.conversionRate.toFixed(1) + '%' })),
      'lead-conversion-report.csv',
    );
  };

  if (loading) return <Skeleton />;
  if (!data) return <p className="text-text-secondary text-sm">No data.</p>;

  return (
    <div className="space-y-5">
      <div className="flex justify-end"><CsvBtn onClick={handleExport} /></div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <SummaryCard label="Overall Conversion Rate" value={`${data.overallConversionRate.toFixed(1)}%`} />
        <SummaryCard label="Period From" value={data.period.from ? new Date(data.period.from).toLocaleDateString('en-MY') : '—'} />
        <SummaryCard label="Period To" value={data.period.to ? new Date(data.period.to).toLocaleDateString('en-MY') : '—'} />
      </div>

      {/* Bar Chart: Lead Conversion by Source */}
      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Conversion by Source</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.bySource} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="source" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Legend />
            <Bar dataKey="total" fill="#4F46E5" name="Total" radius={[4, 4, 0, 0]} />
            <Bar dataKey="converted" fill="#10B981" name="Converted" radius={[4, 4, 0, 0]} />
            <Bar dataKey="lost" fill="#EF4444" name="Lost" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie Chart: Lead Status Distribution */}
      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">By Status</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data.byStatus}
              dataKey="count"
              nameKey="status"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, value }: any) => `${name}: ${value}`}
            >
              {data.byStatus.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Data table */}
      <details className="bg-bg-surface border border-border rounded-xl">
        <summary className="px-5 py-3 cursor-pointer text-sm font-semibold text-text-secondary hover:text-text-primary">
          View detailed data table
        </summary>
        <div className="p-5 pt-0">
          <table className="w-full text-sm">
          <thead>
            <tr className="text-text-secondary text-xs uppercase">
              <th className="text-left pb-2">Source</th>
              <th className="text-right pb-2">Total</th>
              <th className="text-right pb-2">Converted</th>
              <th className="text-right pb-2">Lost</th>
              <th className="text-right pb-2">Conv. Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.bySource.map(row => (
              <tr key={row.source} className="border-t border-border">
                <td className="py-2 text-text-primary">{row.source || '—'}</td>
                <td className="py-2 text-right text-text-secondary">{row.total}</td>
                <td className="py-2 text-right text-green-600 font-medium">{row.converted}</td>
                <td className="py-2 text-right text-danger">{row.lost}</td>
                <td className="py-2 text-right font-semibold">{row.conversionRate.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </details>
    </div>
  );
}

function SalesPerformancePanel({ from, to }: { from: string; to: string }) {
  const [data, setData] = React.useState<SalesPerformanceReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const key = `${from}|${to}`;

  React.useEffect(() => {
    setLoading(true);
    crmService.getSalesPerformanceReport({ from, to })
      .then(setData)
      .finally(() => setLoading(false));
  }, [key]);

  const handleExport = () => {
    if (!data) return;
    downloadCsv(
      data.byOwner.map(r => ({
        Agent: r.ownerName, 'Total Deals': r.totalDeals, Won: r.wonDeals, Lost: r.lostDeals,
        'Win Rate': r.winRate.toFixed(1) + '%', 'Won Value': r.totalWonValue, 'Lost Value': r.totalLostValue, 'Avg Deal': r.avgDealSize,
      })),
      'sales-performance-report.csv',
    );
  };

  if (loading) return <Skeleton />;
  if (!data) return <p className="text-text-secondary text-sm">No data.</p>;

  return (
    <div className="space-y-5">
      <div className="flex justify-end"><CsvBtn onClick={handleExport} /></div>
      <div className="grid grid-cols-2 gap-4">
        <SummaryCard label="Total Revenue (MYR)" value={myr.format(data.totalRevenue)} />
        <SummaryCard label="Overall Win Rate" value={`${data.overallWinRate.toFixed(1)}%`} />
      </div>

      {/* Bar Chart: Won/Lost Deals by Agent */}
      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Deals by Agent</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.byOwner} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="ownerName" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Legend />
            <Bar dataKey="wonDeals" fill="#10B981" name="Won" radius={[4, 4, 0, 0]} />
            <Bar dataKey="lostDeals" fill="#EF4444" name="Lost" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Data table (collapsible) */}
      <details className="bg-bg-surface border border-border rounded-xl" open>
        <summary className="px-5 py-3 cursor-pointer text-sm font-semibold text-text-secondary hover:text-text-primary">
          Agent performance data
        </summary>
        <div className="p-5 pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead>
              <tr className="text-text-secondary text-xs uppercase">
                <th className="text-left pb-2">Agent</th>
                <th className="text-right pb-2">Total</th>
                <th className="text-right pb-2">Won</th>
                <th className="text-right pb-2">Lost</th>
                <th className="text-right pb-2">Win Rate</th>
                <th className="text-right pb-2">Won Value</th>
                <th className="text-right pb-2">Avg Deal</th>
              </tr>
            </thead>
            <tbody>
              {data.byOwner.map(row => (
                <tr key={row.ownerId} className="border-t border-border">
                  <td className="py-2 text-text-primary font-medium">{row.ownerName}</td>
                  <td className="py-2 text-right text-text-secondary">{row.totalDeals}</td>
                  <td className="py-2 text-right text-green-600">{row.wonDeals}</td>
                  <td className="py-2 text-right text-danger">{row.lostDeals}</td>
                  <td className="py-2 text-right font-semibold">{row.winRate.toFixed(1)}%</td>
                  <td className="py-2 text-right">{myr.format(row.totalWonValue)}</td>
                  <td className="py-2 text-right">{myr.format(row.avgDealSize)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </details>
    </div>
  );
}

function PipelineForecastPanel() {
  const [pipelines, setPipelines] = React.useState<CrmPipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = React.useState<string>('');
  const [data, setData] = React.useState<PipelineForecastReport | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    crmService.listPipelines().then(pipes => {
      setPipelines(pipes);
      if (pipes.length > 0 && !selectedPipelineId) {
        setSelectedPipelineId(pipes[0].id);
      }
    }).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!selectedPipelineId) return;
    setLoading(true);
    crmService.getPipelineForecastReport(selectedPipelineId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [selectedPipelineId]);

  const handleExport = () => {
    if (!data) return;
    downloadCsv(
      data.stages.map(s => ({
        Stage: s.stageName, Deals: s.dealCount, 'Total Value': s.totalValue,
        Probability: s.probability + '%', 'Weighted Value': s.weightedValue,
      })),
      'pipeline-forecast-report.csv',
    );
  };

  if (loading) return <Skeleton />;
  if (!data && pipelines.length === 0) return <p className="text-text-secondary text-sm">No pipelines found. Create a pipeline first.</p>;

  return (
    <div className="space-y-5">
      <div className="flex justify-end"><CsvBtn onClick={handleExport} /></div>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-text-primary">Pipeline:</label>
        <select
          value={selectedPipelineId}
          onChange={e => setSelectedPipelineId(e.target.value)}
          className="rounded-lg border border-border bg-bg-surface px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {pipelines.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {!data ? <p className="text-text-secondary text-sm">No data.</p> : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SummaryCard label="Total Pipeline (MYR)" value={myr.format(data.totalPipelineValue)} />
            <SummaryCard label="Weighted Pipeline (MYR)" value={myr.format(data.weightedPipelineValue)} />
            <SummaryCard label="Overdue Deals" value={data.overdueDeals} />
            <SummaryCard label="Overdue Value (MYR)" value={myr.format(data.overdueValue)} />
          </div>

          {/* Funnel Chart: Pipeline by Stage */}
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Pipeline Funnel</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.stages.map(s => ({ name: s.stageName, value: s.totalValue, deals: s.dealCount }))}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={myrFormatter} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => myr.format(v)} />
                <Legend />
                <Bar dataKey="value" fill="#4F46E5" name="Total Value (MYR)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <details className="bg-bg-surface border border-border rounded-xl">
            <summary className="px-5 py-3 cursor-pointer text-sm font-semibold text-text-secondary hover:text-text-primary">
              View stage data table
            </summary>
            <div className="p-5 pt-0">
              <table className="w-full text-sm">
              <thead>
                <tr className="text-text-secondary text-xs uppercase">
                  <th className="text-left pb-2">Stage</th>
                  <th className="text-right pb-2">Deals</th>
                  <th className="text-right pb-2">Total Value</th>
                  <th className="text-right pb-2">Probability</th>
                  <th className="text-right pb-2">Weighted Value</th>
                </tr>
              </thead>
              <tbody>
                {data.stages.map(row => (
                  <tr key={row.stageId} className="border-t border-border">
                    <td className="py-2 text-text-primary">{row.stageName}</td>
                    <td className="py-2 text-right text-text-secondary">{row.dealCount}</td>
                    <td className="py-2 text-right">{myr.format(row.totalValue)}</td>
                    <td className="py-2 text-right">{row.probability}%</td>
                    <td className="py-2 text-right font-semibold">{myr.format(row.weightedValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function ActivitySummaryPanel({ from, to }: { from: string; to: string }) {
  const [data, setData] = React.useState<ActivitySummaryReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const key = `${from}|${to}`;

  React.useEffect(() => {
    setLoading(true);
    crmService.getActivitySummaryReport({ from, to })
      .then(setData)
      .finally(() => setLoading(false));
  }, [key]);

  const handleExport = () => {
    if (!data) return;
    downloadCsv(
      data.byUser.map(r => ({ Agent: r.userName, Total: r.count, ...r.breakdown })),
      'activity-summary-report.csv',
    );
  };

  const handleDetailExport = () => {
    crmService.downloadDailyOperationalActivityDetail({ from, to });
  };

  if (loading) return <Skeleton />;
  if (!data) return <p className="text-text-secondary text-sm">No data.</p>;

  const maxCount = Math.max(...data.byType.map(t => t.count), 1);
  const activityTypes = data.byType.map(t => t.activityType);

  return (
    <div className="space-y-5">
      <div className="flex justify-end gap-2 flex-wrap">
        <CsvBtn onClick={handleExport} label="Export Summary CSV" />
        <CsvBtn onClick={handleDetailExport} label="Export Activity Detail CSV" />
      </div>
      <SummaryCard label="Total Activities" value={data.totalActivities} />

      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">By Type</h3>
        <div className="space-y-3">
          {data.byType.map(t => (
            <div key={t.activityType} className="flex items-center gap-3">
              <span className="w-28 text-xs text-text-secondary shrink-0">{t.activityType}</span>
              <div className="flex-1 bg-bg-subtle rounded-full h-2 overflow-hidden">
                <div
                  className="bg-brand-500 h-2 rounded-full"
                  style={{ width: `${(t.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right text-xs font-semibold text-text-primary">{t.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">By Agent</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-secondary text-xs uppercase">
                <th className="text-left pb-2">Agent</th>
                <th className="text-right pb-2">Total</th>
                {activityTypes.map(t => (
                  <th key={t} className="text-right pb-2">{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.byUser.map(row => (
                <tr key={row.userId} className="border-t border-border">
                  <td className="py-2 text-text-primary font-medium">{row.userName}</td>
                  <td className="py-2 text-right font-semibold">{row.count}</td>
                  {activityTypes.map(t => (
                    <td key={t} className="py-2 text-right text-text-secondary">{row.breakdown[t] ?? 0}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DailyOperationalPanel({ from, to }: { from: string; to: string }) {
  const [data, setData] = React.useState<DailyOperationalReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [owners, setOwners] = React.useState<CrmUser[]>([]);
  const [userId, setUserId] = React.useState('');

  React.useEffect(() => {
    crmService.listCrmUsers().then(setOwners).catch(() => setOwners([]));
  }, []);

  React.useEffect(() => {
    setLoading(true);
    crmService.getDailyOperationalReport({ from, to, ...(userId ? { userId } : {}) })
      .then(setData)
      .finally(() => setLoading(false));
  }, [from, to, userId]);

  const handleExport = () => {
    if (!data) return;
    downloadCsv(data.daily.map(row => Object.fromEntries([
      ['Date', row.date],
      ...DAILY_OPERATIONAL_COLUMNS.map(([label, key]) => [label, row[key]]),
    ])), 'crm-daily-operational.csv');
 };

 const handleCompanyExport = () => {
   if (!data) return;
   downloadCsv(data.byCompany.map(row => Object.fromEntries([
     ['Company', row.companyName],
     ['AccountId', row.accountId ?? ''],
     ['Activities', row.activityCount],
     ...DAILY_OPERATIONAL_COLUMNS.map(([label, key]) => [label, row[key]]),
   ])), 'crm-daily-operational-by-company.csv');
 };

 const handleActivityDetailExport = () => {
   crmService.downloadDailyOperationalActivityDetail({ from, to, ...(userId ? { userId } : {}) });
 };

 if (loading) return <Skeleton />;
  if (!data) return <p className="text-text-secondary text-sm">No data.</p>;

  const columns = DAILY_OPERATIONAL_COLUMNS;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">Daily CRM-recorded operational activity</p>
          <p className="text-xs text-text-secondary mt-1">Timezone: {data.period.timezone}. Counts rep-recorded activity only — newly imported and system-generated rows are excluded. Historical imports created before source tracking may remain classified as CRM. Volume is dated when logged and outcomes when recorded. Signed Up, Declined and Leads Converted are lifecycle events attributed to the record owner, not the selected rep.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <label className="text-xs font-semibold text-text-secondary">Sales rep:</label>
          <select aria-label="Sales rep:" value={userId} onChange={e => setUserId(e.target.value)}
            className="border border-border rounded-lg px-2 py-1.5 text-xs bg-bg-surface text-text-primary">
            <option value="">All visible owners</option>
            {owners.map(owner => <option key={owner.id} value={owner.id}>{owner.firstName} {owner.lastName}</option>)}
          </select>
          <CsvBtn onClick={handleExport} label="Export Daily CSV" />
          <CsvBtn onClick={handleCompanyExport} label="Export Company CSV" />
          <CsvBtn onClick={handleActivityDetailExport} label="Export Activity Detail CSV" />
        </div>
      </div>
      <div className="overflow-x-auto bg-bg-surface border border-border rounded-xl">
        <table className="w-full text-xs min-w-[1100px]">
          <thead>
            <tr className="text-text-secondary uppercase border-b border-border">
              <th className="text-left px-3 py-3">Date</th>
              {columns.map(([label, key]) => <th key={key} className="text-right px-2 py-3">{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.daily.map(row => (
              <tr key={row.date} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-text-primary font-medium whitespace-nowrap">{row.date}</td>
                {columns.map(([, key]) => <td key={key} className="px-2 py-2 text-right text-text-secondary">{row[key]}</td>)}
              </tr>
            ))}
            <tr className="font-bold bg-bg-subtle">
              <td className="px-3 py-3 text-text-primary">TOTAL</td>
              {columns.map(([, key]) => <td key={key} className="px-2 py-3 text-right text-text-primary">{data.totals[key]}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <details className="bg-bg-surface border border-border rounded-xl" open>
        <summary className="px-5 py-3 cursor-pointer text-sm font-semibold text-text-secondary hover:text-text-primary">
          By Company
        </summary>
        <div className="p-5 pt-0 overflow-x-auto">
          <table className="w-full text-xs min-w-[1100px]">
            <thead>
              <tr className="text-text-secondary uppercase border-b border-border">
                <th className="text-left px-3 py-3">Company</th>
                <th className="text-right px-2 py-3">Activities</th>
                {columns.map(([label, key]) => <th key={key} className="text-right px-2 py-3">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.byCompany.map(row => (
                <tr key={`${row.accountId ?? 'none'}:${row.companyName}`} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-text-primary font-medium">{row.companyName}</td>
                  <td className="px-2 py-2 text-right font-semibold text-text-primary">{row.activityCount}</td>
                  {columns.map(([, key]) => <td key={key} className="px-2 py-2 text-right text-text-secondary">{row[key]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function LeadAgingPanel() {
  const [data, setData] = React.useState<LeadAgingReport | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    crmService.getLeadAgingReport()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const handleExport = () => {
    if (!data) return;
    downloadCsv(
      data.byStatus.map(r => ({
        Status: r.status, Count: r.count, 'Avg Age Days': r.avgAgeDays.toFixed(1),
        'Max Age Days': r.maxAgeDays, '>30 Days': r.leadsOver30Days, '>60 Days': r.leadsOver60Days, '>90 Days': r.leadsOver90Days,
      })),
      'lead-aging-report.csv',
    );
  };

  if (loading) return <Skeleton />;
  if (!data) return <p className="text-text-secondary text-sm">No data.</p>;

  return (
    <div className="space-y-5">
      <div className="flex justify-end"><CsvBtn onClick={handleExport} /></div>
      <div className="grid grid-cols-2 gap-4">
        <SummaryCard label="Stale Leads" value={data.staleLeads} />
        <SummaryCard label="Avg Age (days)" value={data.averageAgeAllLeads.toFixed(1)} />
      </div>

      {/* Stacked BarChart: Aging Buckets by Status */}
      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Lead Aging by Status</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.byStatus.map(r => ({
            status: r.status,
            '&gt;30d': r.leadsOver30Days,
            '&gt;60d': r.leadsOver60Days,
            '&gt;90d': r.leadsOver90Days,
          }))} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="status" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Legend />
            <Bar dataKey="&gt;30d" stackId="age" fill="#F59E0B" name=">30d" />
            <Bar dataKey="&gt;60d" stackId="age" fill="#EF4444" name=">60d" />
            <Bar dataKey="&gt;90d" stackId="age" fill="#7F1D1D" name=">90d" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <details className="bg-bg-surface border border-border rounded-xl">
        <summary className="px-5 py-3 cursor-pointer text-sm font-semibold text-text-secondary hover:text-text-primary">
          View aging data table
        </summary>
        <div className="p-5 pt-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-secondary text-xs uppercase">
                <th className="text-left pb-2">Status</th>
                <th className="text-right pb-2">Count</th>
                <th className="text-right pb-2">Avg Age (d)</th>
                <th className="text-right pb-2">Max Age (d)</th>
                <th className="text-right pb-2">&gt;30d</th>
                <th className="text-right pb-2">&gt;60d</th>
                <th className="text-right pb-2">&gt;90d</th>
              </tr>
            </thead>
            <tbody>
              {data.byStatus.map(row => (
                <tr key={row.status} className="border-t border-border">
                  <td className="py-2 text-text-primary">{row.status}</td>
                  <td className="py-2 text-right">{row.count}</td>
                  <td className="py-2 text-right">{row.avgAgeDays.toFixed(1)}</td>
                  <td className="py-2 text-right">{row.maxAgeDays}</td>
                  <td className="py-2 text-right text-warning">{row.leadsOver30Days}</td>
                  <td className="py-2 text-right text-orange-600">{row.leadsOver60Days}</td>
                  <td className="py-2 text-right text-danger font-semibold">{row.leadsOver90Days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function WinLossPanel({ from, to }: { from: string; to: string }) {
  const [data, setData] = React.useState<WinLossReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const key = `${from}|${to}`;

  React.useEffect(() => {
    setLoading(true);
    crmService.getWinLossReport({ from, to })
      .then(setData)
      .finally(() => setLoading(false));
  }, [key]);

  const handleExport = () => {
    if (!data) return;
    downloadCsv(
      data.byReason.map(r => ({
        Reason: r.lostReason || '—', Count: r.count, 'Total Value': r.totalValue,
      })),
      'win-loss-report.csv',
    );
  };

  const handleLostLeadsExport = () => {
    if (!data || data.lostLeads.length === 0) return;
    downloadCsv(
      data.lostLeads.map(lead => ({
        'Lead ID': lead.id,
        Lead: lead.title,
        Company: lead.companyName || lead.accountName || 'Not specified',
        Account: lead.accountName || '',
        Owner: lead.ownerName || '—',
        Reason: lead.lostReason || 'Not specified',
        'Lost Date': new Date(lead.updatedAt).toLocaleDateString('en-MY'),
      })),
      'lost-leads-report.csv',
    );
  };

  const handleConvertedLeadsExport = () => {
    if (!data || data.convertedLeads.length === 0) return;
    downloadCsv(
      data.convertedLeads.map(lead => ({
        'Lead ID': lead.id,
        Lead: lead.title,
        Company: lead.companyName || lead.accountName || 'Not specified',
        Account: lead.accountName || '',
        Owner: lead.ownerName || '—',
        'Won Date': new Date(lead.convertedAt).toLocaleDateString('en-MY'),
      })),
      'won-leads-report.csv',
    );
  };

  if (loading) return <Skeleton />;
  if (!data) return <p className="text-text-secondary text-sm">No data.</p>;

  return (
    <div className="space-y-5">
      <div className="flex justify-end"><CsvBtn onClick={handleExport} /></div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Deal Win Rate" value={`${data.winRate.toFixed(1)}%`} />
        <SummaryCard label="Won Deals" value={`${data.totalWon.count} (${myr.format(data.totalWon.value)})`} />
        <SummaryCard label="Won Leads" value={data.totalConvertedLeads} />
        <SummaryCard label="Lost Deals" value={`${data.totalLost.count} (${myr.format(data.totalLost.value)})`} />
        <SummaryCard label="Lost Leads" value={data.totalLostLeads} />
      </div>

      {data.convertedLeads.length > 0 && (
        <div className="bg-bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Won Leads</h3>
            <CsvBtn onClick={handleConvertedLeadsExport} label="Export Won Leads" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-secondary text-xs uppercase">
                  <th className="text-left pb-2">Lead</th>
                  <th className="text-left pb-2">Company</th>
                  <th className="text-left pb-2">Account</th>
                  <th className="text-left pb-2">Owner</th>
                  <th className="text-right pb-2">Won Date</th>
                </tr>
              </thead>
              <tbody>
                {data.convertedLeads.map(lead => (
                  <tr key={lead.id} className="border-t border-border">
                    <td className="py-2 pr-3">
                      <Link to={`/crm/leads/${lead.id}`} className="text-brand-600 hover:underline font-medium">
                        {lead.title}
                      </Link>
                      <div className="text-xs text-text-secondary">{lead.id}</div>
                    </td>
                    <td className="py-2 pr-3 text-text-primary">{lead.companyName || lead.accountName || 'Not specified'}</td>
                    <td className="py-2 pr-3 text-text-secondary">{lead.accountName || '—'}</td>
                    <td className="py-2 pr-3 text-text-secondary">{lead.ownerName || '—'}</td>
                    <td className="py-2 text-right text-text-secondary whitespace-nowrap">{new Date(lead.convertedAt).toLocaleDateString('en-MY')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.lostLeads.length > 0 && (
        <div className="bg-bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Lost Leads</h3>
            <CsvBtn onClick={handleLostLeadsExport} label="Export Lost Leads" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-secondary text-xs uppercase">
                  <th className="text-left pb-2">Lead</th>
                  <th className="text-left pb-2">Company</th>
                  <th className="text-left pb-2">Account</th>
                  <th className="text-left pb-2">Owner</th>
                  <th className="text-left pb-2">Reason</th>
                  <th className="text-right pb-2">Lost Date</th>
                </tr>
              </thead>
              <tbody>
                {data.lostLeads.map(lead => (
                  <tr key={lead.id} className="border-t border-border">
                    <td className="py-2 pr-3">
                      <Link to={`/crm/leads/${lead.id}`} className="text-brand-600 hover:underline font-medium">
                        {lead.title}
                      </Link>
                      <div className="text-xs text-text-secondary">{lead.id}</div>
                    </td>
                    <td className="py-2 pr-3 text-text-primary">{lead.companyName || lead.accountName || 'Not specified'}</td>
                    <td className="py-2 pr-3 text-text-secondary">{lead.accountName || '—'}</td>
                    <td className="py-2 pr-3 text-text-secondary">{lead.ownerName || '—'}</td>
                    <td className="py-2 pr-3 text-text-secondary">{lead.lostReason || 'Not specified'}</td>
                    <td className="py-2 text-right text-text-secondary whitespace-nowrap">{new Date(lead.updatedAt).toLocaleDateString('en-MY')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lead outcomes chart — uses the same lead records shown above. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="bg-bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Lead Outcomes</h3>
          {data.totalConvertedLeads + data.totalLostLeads > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Won Leads', value: data.totalConvertedLeads },
                    { name: 'Lost Leads', value: data.totalLostLeads },
                  ]}
                  cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                  dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  <Cell fill="#10B981" />
                  <Cell fill="#EF4444" />
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-text-secondary py-20 text-center">No converted or lost leads in this period.</p>
          )}
        </div>

        {/* Deal outcomes — never render an empty chart. */}
        <div className="bg-bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Deal Outcomes</h3>
          {data.totalWon.count + data.totalLost.count > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Won Deals', value: data.totalWon.count },
                    { name: 'Lost Deals', value: data.totalLost.count },
                  ]}
                  cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                  dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  <Cell fill="#10B981" />
                  <Cell fill="#EF4444" />
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-text-secondary py-20 text-center">No won or lost deals in this period.</p>
          )}
        </div>

        {/* Lost Reasons BarChart */}
        {data.byReason.length > 0 && (
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Lost Reasons</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={data.byReason.map(r => ({ reason: r.lostReason || '—', count: r.count, value: r.totalValue }))}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 60, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="reason" tick={{ fontSize: 11 }} width={60} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number, name: string) => name === 'value' ? myr.format(v) : v} />
                <Legend />
                <Bar dataKey="count" fill="#EF4444" name="Count" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {data.byReason.length > 0 && (
      <details className="bg-bg-surface border border-border rounded-xl">
        <summary className="px-5 py-3 cursor-pointer text-sm font-semibold text-text-secondary hover:text-text-primary">
          View lost reasons data table
        </summary>
        <div className="p-5 pt-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-secondary text-xs uppercase">
                <th className="text-left pb-2">Reason</th>
                <th className="text-right pb-2">Count</th>
                <th className="text-right pb-2">Total Value (MYR)</th>
              </tr>
            </thead>
            <tbody>
              {data.byReason.map((row, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-2 text-text-primary">{row.lostReason || '—'}</td>
                  <td className="py-2 text-right">{row.count}</td>
                  <td className="py-2 text-right">{myr.format(row.totalValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      )}
    </div>
  );
}

function KycCompliancePanel() {
  const [data, setData] = React.useState<KycComplianceReport | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    crmService.getKycComplianceReport()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const handleExport = () => {
    if (!data) return;
    downloadCsv(
      data.byStatus.map(r => ({ Status: r.status, Count: r.count })),
      'kyc-compliance-report.csv',
    );
  };

  if (loading) return <Skeleton />;
  if (!data) return <p className="text-text-secondary text-sm">No data.</p>;

  return (
    <div className="space-y-5">
      <div className="flex justify-end"><CsvBtn onClick={handleExport} /></div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <SummaryCard label="Compliance Rate" value={`${data.complianceRate.toFixed(1)}%`} />
        <SummaryCard label="Approved" value={data.approvedCount} />
        <SummaryCard label="Pending" value={data.pendingCount} />
        <SummaryCard label="Expired" value={data.expiredCount} />
        <SummaryCard label="Expiring Soon" value={data.expiringSoon} />
        <SummaryCard label="PEP Flagged" value={data.pepFlagged} />
      </div>

      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-2">By KYC Status</h3>
        <StatusChips items={data.byStatus} />
      </div>
    </div>
  );
}

// ── Forecast Categories Panel ─────────────────────────────────────────────────

interface ForecastCategoryBreakdown {
  totalValue: number;
  weightedValue: number;
  dealCount: number;
}
interface ForecastByCategory {
  PIPELINE: ForecastCategoryBreakdown;
  BEST_CASE: ForecastCategoryBreakdown;
  COMMIT: ForecastCategoryBreakdown;
  OMITTED: ForecastCategoryBreakdown;
}
interface ForecastCategoriesData {
  stages: Array<{ stageId: string; stageName: string; probability: number; dealCount: number; totalValue: number; weightedValue: number; categories: ForecastByCategory }>;
  categoryBreakdown: ForecastByCategory;
  totalPipelineValue: number;
  weightedPipelineValue: number;
  overdueDeals: number;
  overdueValue: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  PIPELINE: '#6366f1',
  BEST_CASE: '#f59e0b',
  COMMIT: '#22c55e',
  OMITTED: '#94a3b8',
};

function ForecastCategoriesPanel() {
  const [pipelines, setPipelines] = React.useState<CrmPipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = React.useState<string>('');
  const [data, setData] = React.useState<ForecastCategoriesData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    crmService.listPipelines().then(pipes => {
      setPipelines(pipes);
      if (pipes.length > 0 && !selectedPipelineId) setSelectedPipelineId(pipes[0].id);
    }).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!selectedPipelineId) return;
    setLoading(true);
    crmService.getForecastCategoriesReport(selectedPipelineId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [selectedPipelineId]);

  const handleExport = () => {
    if (!data) return;
    const rows = (Object.entries(data.categoryBreakdown) as [string, ForecastCategoryBreakdown][]).map(([cat, b]) => ({
      Category: cat, Deals: b.dealCount, 'Total Value': b.totalValue, 'Weighted Value': b.weightedValue,
    }));
    downloadCsv(rows, 'forecast-by-category.csv');
  };

  if (loading) return <Skeleton />;
  if (!data && pipelines.length === 0) return <p className="text-text-secondary text-sm">No pipelines found.</p>;

  const cats = data?.categoryBreakdown;
  const chartData = cats ? (Object.entries(cats) as [string, ForecastCategoryBreakdown][]).map(([cat, b]) => ({
    name: cat, Total: b.totalValue, Weighted: b.weightedValue, Deals: b.dealCount,
  })) : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <select value={selectedPipelineId} onChange={e => setSelectedPipelineId(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm">
          {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <CsvBtn onClick={handleExport} />
      </div>
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(Object.entries(data.categoryBreakdown) as [string, ForecastCategoryBreakdown][]).map(([cat, b]) => (
              <div key={cat} className="bg-bg-surface border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: CATEGORY_COLORS[cat] || '#94a3b8' }} />
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{cat.replace('_', ' ')}</span>
                </div>
                <p className="text-xl font-black text-text-primary">{myr.format(b.totalValue)}</p>
                <p className="text-xs text-text-secondary mt-1">{b.dealCount} deal{b.dealCount !== 1 ? 's' : ''} · {myr.format(b.weightedValue)} weighted</p>
              </div>
            ))}
          </div>
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Category Breakdown</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => myr.format(v)} />
                <Legend />
                <Bar dataKey="Total" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Weighted" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

// ── Forecast Accuracy Panel ───────────────────────────────────────────────────

interface ForecastAccuracyData {
  commitTotal: number;
  actualWonTotal: number;
  accuracyPct: number;
  period: { from: string; to: string };
}

function ForecastAccuracyPanel({ from, to }: { from: string; to: string }) {
  const [data, setData] = React.useState<ForecastAccuracyData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    crmService.getForecastAccuracyReport({ from, to })
      .then(setData)
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading) return <Skeleton />;
  if (!data) return <p className="text-text-secondary text-sm">No data available for this period.</p>;

  const diff = data.actualWonTotal - data.commitTotal;
  const diffLabel = diff >= 0 ? `+${myr.format(diff)}` : myr.format(diff);
  const diffColor = diff >= 0 ? 'text-green-600' : 'text-red-600';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-bg-surface border border-border rounded-xl p-5 text-center">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Committed Forecast</p>
          <p className="text-2xl font-black text-text-primary">{myr.format(data.commitTotal)}</p>
        </div>
        <div className="bg-bg-surface border border-border rounded-xl p-5 text-center">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Actual Won Revenue</p>
          <p className="text-2xl font-black text-text-primary">{myr.format(data.actualWonTotal)}</p>
          <p className={`text-xs mt-1 font-semibold ${diffColor}`}>{diffLabel} vs commit</p>
        </div>
        <div className="bg-bg-surface border border-border rounded-xl p-5 text-center">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Forecast Accuracy</p>
          <p className="text-3xl font-black" style={{ color: data.accuracyPct >= 80 ? '#22c55e' : data.accuracyPct >= 50 ? '#f59e0b' : '#ef4444' }}>
            {data.accuracyPct}%
          </p>
          <p className="text-xs text-text-secondary mt-1">
            {data.accuracyPct >= 80 ? 'Excellent' : data.accuracyPct >= 50 ? 'Fair' : 'Needs improvement'}
          </p>
        </div>
      </div>
      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Accuracy Gauge</h3>
        <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
          <div className="h-6 rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(data.accuracyPct, 100)}%`,
              background: data.accuracyPct >= 80 ? '#22c55e' : data.accuracyPct >= 50 ? '#f59e0b' : '#ef4444',
            }} />
        </div>
        <div className="flex justify-between text-xs text-text-secondary mt-1">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CrmReports() {
  const [activeTab, setActiveTab] = useState<TabId>('lead-conversion');
  const [loadedTabs, setLoadedTabs] = useState<Set<TabId>>(new Set(['lead-conversion']));

  const [from, setFrom] = useState(firstOfMonthStr());
  const [to, setTo] = useState(todayStr());
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTabClick = useCallback((tab: TabId) => {
    setActiveTab(tab);
    setLoadedTabs(prev => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const dateProps = { from, to };

  function renderPanel(tab: TabId) {
    if (!loadedTabs.has(tab)) return null;
    switch (tab) {
      case 'lead-conversion':
        return <LeadConversionPanel key={`lc-${refreshKey}`} {...dateProps} />;
      case 'sales-performance':
        return <SalesPerformancePanel key={`sp-${refreshKey}`} {...dateProps} />;
      case 'pipeline-forecast':
        return <PipelineForecastPanel key={`pf-${refreshKey}`} />;
      case 'activity-summary':
        return <ActivitySummaryPanel key={`as-${refreshKey}`} {...dateProps} />;
      case 'daily-operational':
        return <DailyOperationalPanel key={`do-${refreshKey}`} {...dateProps} />;
      case 'lead-aging':
        return <LeadAgingPanel key={`la-${refreshKey}`} />;
      case 'win-loss':
        return <WinLossPanel key={`wl-${refreshKey}`} {...dateProps} />;
      case 'kyc-compliance':
        return <KycCompliancePanel key={`kyc-${refreshKey}`} />;
      case 'forecast-categories':
        return <ForecastCategoriesPanel key={`fc-${refreshKey}`} />;
      case 'forecast-accuracy':
        return <ForecastAccuracyPanel key={`fa-${refreshKey}`} {...dateProps} />;
    }
  }

  const showDateRange = DATE_TABS.includes(activeTab);

  return (
    <>
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-secondary">
        <Link to="/crm" className="hover:text-text-primary transition-colors">CRM</Link>
        <span>/</span>
        <span className="text-text-primary font-medium">Reports</span>
      </nav>

      {/* Header */}
      <h1 className="text-2xl font-bold text-text-primary">CRM Reports</h1>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-brand-600 text-white'
                : 'text-text-secondary hover:text-text-primary bg-bg-subtle border border-border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date range (for applicable tabs) */}
      {showDateRange && (
        <DateRangeRow
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          onRefresh={handleRefresh}
        />
      )}

      {/* Tab content */}
      <div>
        {TABS.map(tab => (
          <div key={tab.id} style={{ display: activeTab === tab.id ? 'block' : 'none' }}>
            {renderPanel(tab.id)}
          </div>
        ))}
      </div>
    </div>
    </>
  );
}
