import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import crmService, { CrmPipeline } from '../src/services/crm.service';

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

interface LeadAgingReport {
  byStatus: Array<{ status: string; count: number; avgAgeDays: number; maxAgeDays: number; leadsOver30Days: number; leadsOver60Days: number; leadsOver90Days: number }>;
  staleLeads: number;
  averageAgeAllLeads: number;
}

interface WinLossReport {
  byReason: Array<{ lostReason: string; count: number; totalValue: number }>;
  totalWon: { count: number; value: number };
  totalLost: { count: number; value: number };
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
  { id: 'activity-summary', label: 'Activity Summary' },
  { id: 'lead-aging', label: 'Lead Aging' },
  { id: 'win-loss', label: 'Win/Loss' },
  { id: 'kyc-compliance', label: 'KYC Compliance' },
] as const;

type TabId = typeof TABS[number]['id'];
const DATE_TABS: TabId[] = ['lead-conversion', 'sales-performance', 'activity-summary', 'win-loss'];

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

function DateRangeRow({
  from, to, onFromChange, onToChange, onRefresh,
}: {
  from: string; to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex items-center gap-3 mb-5 flex-wrap">
      <label className="flex items-center gap-2 text-sm text-text-secondary">
        From:
        <input
          type="date"
          value={from}
          onChange={e => onFromChange(e.target.value)}
          className="border border-border rounded-lg px-3 py-1.5 text-sm bg-bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-text-secondary">
        To:
        <input
          type="date"
          value={to}
          onChange={e => onToChange(e.target.value)}
          className="border border-border rounded-lg px-3 py-1.5 text-sm bg-bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </label>
      <button
        onClick={onRefresh}
        className="px-4 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
      >
        Refresh
      </button>
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

  if (loading) return <Skeleton />;
  if (!data) return <p className="text-text-secondary text-sm">No data.</p>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <SummaryCard label="Overall Conversion Rate" value={`${data.overallConversionRate.toFixed(1)}%`} />
        <SummaryCard label="Period From" value={data.period.from ? new Date(data.period.from).toLocaleDateString('en-MY') : '—'} />
        <SummaryCard label="Period To" value={data.period.to ? new Date(data.period.to).toLocaleDateString('en-MY') : '—'} />
      </div>

      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">By Source</h3>
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
                <td className="py-2 text-right text-red-500">{row.lost}</td>
                <td className="py-2 text-right font-semibold">{row.conversionRate.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-2">By Status</h3>
        <StatusChips items={data.byStatus} />
      </div>
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

  if (loading) return <Skeleton />;
  if (!data) return <p className="text-text-secondary text-sm">No data.</p>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <SummaryCard label="Total Revenue (MYR)" value={myr.format(data.totalRevenue)} />
        <SummaryCard label="Overall Win Rate" value={`${data.overallWinRate.toFixed(1)}%`} />
      </div>

      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">By Agent</h3>
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
                  <td className="py-2 text-right text-red-500">{row.lostDeals}</td>
                  <td className="py-2 text-right font-semibold">{row.winRate.toFixed(1)}%</td>
                  <td className="py-2 text-right">{myr.format(row.totalWonValue)}</td>
                  <td className="py-2 text-right">{myr.format(row.avgDealSize)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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

  if (loading) return <Skeleton />;
  if (!data && pipelines.length === 0) return <p className="text-text-secondary text-sm">No pipelines found. Create a pipeline first.</p>;

  return (
    <div className="space-y-5">
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

          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Stages</h3>
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

  if (loading) return <Skeleton />;
  if (!data) return <p className="text-text-secondary text-sm">No data.</p>;

  const maxCount = Math.max(...data.byType.map(t => t.count), 1);
  const activityTypes = data.byType.map(t => t.activityType);

  return (
    <div className="space-y-5">
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

function LeadAgingPanel() {
  const [data, setData] = React.useState<LeadAgingReport | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    crmService.getLeadAgingReport()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton />;
  if (!data) return <p className="text-text-secondary text-sm">No data.</p>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <SummaryCard label="Stale Leads" value={data.staleLeads} />
        <SummaryCard label="Avg Age (days)" value={data.averageAgeAllLeads.toFixed(1)} />
      </div>

      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">By Status</h3>
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
                <td className="py-2 text-right text-amber-600">{row.leadsOver30Days}</td>
                <td className="py-2 text-right text-orange-600">{row.leadsOver60Days}</td>
                <td className="py-2 text-right text-red-600 font-semibold">{row.leadsOver90Days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

  if (loading) return <Skeleton />;
  if (!data) return <p className="text-text-secondary text-sm">No data.</p>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Win Rate" value={`${data.winRate.toFixed(1)}%`} />
        <SummaryCard label="Won" value={`${data.totalWon.count} (${myr.format(data.totalWon.value)})`} />
        <SummaryCard label="Lost" value={`${data.totalLost.count} (${myr.format(data.totalLost.value)})`} />
      </div>

      {data.byReason.length > 0 && (
        <div className="bg-bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Lost Reasons</h3>
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

  if (loading) return <Skeleton />;
  if (!data) return <p className="text-text-secondary text-sm">No data.</p>;

  return (
    <div className="space-y-5">
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
      case 'lead-aging':
        return <LeadAgingPanel key={`la-${refreshKey}`} />;
      case 'win-loss':
        return <WinLossPanel key={`wl-${refreshKey}`} {...dateProps} />;
      case 'kyc-compliance':
        return <KycCompliancePanel key={`kyc-${refreshKey}`} />;
    }
  }

  const showDateRange = DATE_TABS.includes(activeTab);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
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
  );
}
