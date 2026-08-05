// frontend/pages/Insights.tsx
// Insights Hub — replaces the 3 separate report pages with a unified dashboard.
// Tabs: Overview | ITSM | CRM | Credit

import React, { useEffect, useState, useCallback } from 'react';
import Breadcrumbs from '../src/components/Breadcrumbs';
import { useAuth } from '../src/context/AuthContext';
import insightsService, {
  OverviewData,
  ItsmSummaryData,
  TrendBucket,
  ServiceDeskBucket,
  PriorityBucket,
  AgentWorkloadItem,
  SlaComplianceData,
  CrmOverviewData,
  CreditOverviewData,
} from '../src/services/insights.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'YTD', days: -1 },
] as const;

function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  if (n === -1) {
    // YTD
    d.setDate(1);
    d.setMonth(0);
  } else {
    d.setDate(d.getDate() - n);
  }
  return toISO(d);
}

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(n % 1 === 0 ? 0 : 1);
}

function formatPercent(n: number): string {
  if (n === null || n === undefined) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-yellow-500',
  LOW: 'bg-gray-400',
};

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

const MODULE_COLORS: Record<string, string> = {
  IT: '#0052cc',
  HR: '#7c3aed',
  Finance: '#059669',
  CRM: '#d97706',
  Credit: '#dc2626',
};

type TabId = 'overview' | 'itsm' | 'crm' | 'credit';

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  color = 'bg-blue-50 text-blue-700',
}: {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className={`size-8 rounded-lg flex items-center justify-center ${color.split(' ')[0]}`}>
          <span className={`material-symbols-outlined text-[18px] ${color.split(' ')[1]}`} style={{ fontSize: '18px' }}>
            {icon}
          </span>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-extrabold text-gray-900 leading-none">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function Insights() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [dateFrom, setDateFrom] = useState(daysAgo(30));
  const [dateTo, setDateTo] = useState(toISO(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [itsmSummary, setItsmSummary] = useState<ItsmSummaryData | null>(null);
  const [trends, setTrends] = useState<TrendBucket[]>([]);
  const [byServiceDesk, setByServiceDesk] = useState<ServiceDeskBucket[]>([]);
  const [byPriority, setByPriority] = useState<PriorityBucket[]>([]);
  const [agentWorkload, setAgentWorkload] = useState<AgentWorkloadItem[]>([]);
  const [slaCompliance, setSlaCompliance] = useState<SlaComplianceData | null>(null);
  const [crmOverview, setCrmOverview] = useState<CrmOverviewData | null>(null);
  const [creditOverview, setCreditOverview] = useState<CreditOverviewData | null>(null);

  const params = { from: dateFrom, to: dateTo };

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await insightsService.getOverview();
      setOverview(data);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadItsm = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [summary, trend, sd, pri, agents, sla] = await Promise.all([
        insightsService.getItsmSummary(params),
        insightsService.getItsmTrends({ ...params, granularity: 'day' }),
        insightsService.getItsmByServiceDesk(params),
        insightsService.getItsmByPriority(params),
        insightsService.getItsmAgentWorkload(),
        insightsService.getItsmSlaCompliance(params),
      ]);
      setItsmSummary(summary);
      setTrends(trend);
      setByServiceDesk(sd);
      setByPriority(pri);
      setAgentWorkload(agents);
      setSlaCompliance(sla);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load ITSM data');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  const loadCrm = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await insightsService.getCrmOverview();
      setCrmOverview(data);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load CRM data');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCredit = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await insightsService.getCreditOverview();
      setCreditOverview(data);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load Credit data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') loadOverview();
    else if (activeTab === 'itsm') loadItsm();
    else if (activeTab === 'crm') loadCrm();
    else if (activeTab === 'credit') loadCredit();
  }, [activeTab, loadOverview, loadItsm, loadCrm, loadCredit]);

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'itsm', label: 'ITSM', icon: 'support_agent' },
    { id: 'crm', label: 'CRM', icon: 'handshake' },
    { id: 'credit', label: 'Credit', icon: 'account_balance' },
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6">
      <Breadcrumbs items={[{ label: 'Insights' }]} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Insights Hub</h1>
          <p className="text-sm text-gray-500 mt-1">Cross-module analytics and KPIs</p>
        </div>

        {/* Date range filter (ITSM tab) */}
        {activeTab === 'itsm' && (
          <div className="flex items-center gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  const from = daysAgo(p.days);
                  setDateFrom(from);
                  setDateTo(toISO(new Date()));
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  dateFrom === daysAgo(p.days)
                    ? 'bg-[#0052cc] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setError(null);
              setLoading(true);
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-[#0052cc] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          <span className="material-symbols-outlined align-middle mr-1" style={{ fontSize: '16px' }}>error</span>
          {error}
        </div>
      )}

      {/* Loading spinner */}
      {loading && (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0052cc]" />
        </div>
      )}

      {/* ── OVERVIEW TAB ──────────────────────────────────────────────────── */}
      {!loading && activeTab === 'overview' && overview && (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon="trending_up"
              label="Open Requests"
              value={formatNumber(overview.totalOpen)}
              sub="Across all modules"
              color="bg-blue-50 text-blue-700"
            />
            <KpiCard
              icon="gavel"
              label="SLA Breach Rate"
              value={formatPercent(overview.slaBreachRate)}
              sub="Last 30 days"
              color="bg-red-50 text-red-700"
            />
            <KpiCard
              icon="schedule"
              label="Avg Resolution"
              value={overview.avgResolutionHours !== null ? `${overview.avgResolutionHours}h` : '—'}
              sub="Mean time to resolve"
              color="bg-green-50 text-green-700"
            />
            <KpiCard
              icon="category"
              label="Active Modules"
              value={overview.byModule.length}
              sub="With open requests"
              color="bg-purple-50 text-purple-700"
            />
          </div>

          {/* Module breakdown */}
          {overview.byModule.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Open Requests by Module</h3>
              <div className="space-y-3">
                {overview.byModule.map((m) => {
                  const maxCount = Math.max(...overview.byModule.map((x) => x.count));
                  const pct = maxCount > 0 ? (m.count / maxCount) * 100 : 0;
                  return (
                    <div key={m.module} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-600 w-20 text-right">{m.module}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: MODULE_COLORS[m.module] || '#6b7280',
                          }}
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-900 w-10">{m.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ITSM TAB ─────────────────────────────────────────────────────── */}
      {!loading && activeTab === 'itsm' && itsmSummary && (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard icon="receipt_long" label="Total" value={formatNumber(itsmSummary.total)} color="bg-gray-50 text-gray-700" />
            <KpiCard icon="pending" label="Open" value={formatNumber(itsmSummary.open)} color="bg-blue-50 text-blue-700" />
            <KpiCard icon="task_alt" label="Resolved" value={formatNumber(itsmSummary.resolved)} color="bg-green-50 text-green-700" />
            <KpiCard icon="person_off" label="Unassigned" value={formatNumber(itsmSummary.unassigned)} color="bg-amber-50 text-amber-700" />
            <KpiCard icon="speed" label="Avg Resolution" value={itsmSummary.avgResolutionHours !== null ? `${itsmSummary.avgResolutionHours}h` : '—'} color="bg-purple-50 text-purple-700" />
          </div>

          {/* Trends (simplified — table view without recharts) */}
          {trends.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Request Trends</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-3 font-bold text-gray-400 uppercase tracking-wide">Date</th>
                      <th className="text-right py-2 px-3 font-bold text-gray-400 uppercase tracking-wide">Total</th>
                      <th className="text-right py-2 px-3 font-bold text-gray-400 uppercase tracking-wide">Resolved</th>
                      <th className="text-right py-2 px-3 font-bold text-gray-400 uppercase tracking-wide">Breached</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trends.slice(-14).map((t) => (
                      <tr key={t.bucket} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-700">{new Date(t.bucket).toLocaleDateString()}</td>
                        <td className="py-2 px-3 text-right font-bold text-gray-900">{t.total}</td>
                        <td className="py-2 px-3 text-right text-green-600">{t.resolved}</td>
                        <td className="py-2 px-3 text-right text-red-600">{t.breached}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* By Service Desk */}
          {byServiceDesk.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-bold text-gray-700 mb-4">By Service Desk</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {byServiceDesk.map((sd) => (
                  <div key={sd.serviceDeskId ?? 'none'} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{sd.name || sd.code || 'Unassigned'}</p>
                      {sd.code && <p className="text-[10px] text-gray-400 uppercase">{sd.code}</p>}
                    </div>
                    <span className="text-lg font-extrabold text-[#0052cc]">{sd.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By Priority */}
          {byPriority.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-bold text-gray-700 mb-4">By Priority</h3>
              <div className="flex gap-4 flex-wrap">
                {byPriority.map((p) => (
                  <div key={p.priority} className="flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-2">
                    <div className={`w-3 h-3 rounded-full ${PRIORITY_COLORS[p.priority] || 'bg-gray-400'}`} />
                    <span className="text-sm font-bold text-gray-700">{PRIORITY_LABELS[p.priority] || p.priority}</span>
                    <span className="text-sm font-extrabold text-gray-900">{p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agent Workload */}
          {agentWorkload.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Agent Workload</h3>
              <div className="space-y-2">
                {agentWorkload.slice(0, 10).map((a) => (
                  <div key={a.assignedToId ?? 'x'} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-full bg-[#0052cc]/10 flex items-center justify-center text-[10px] font-bold text-[#0052cc]">
                        {(a.firstName?.[0] ?? '?').toUpperCase()}{(a.lastName?.[0] ?? '').toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{a.firstName} {a.lastName}</p>
                        <p className="text-[10px] text-gray-400">{a.email}</p>
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-[#0052cc]">{a.openTickets} open</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SLA Compliance Donut (simplified as bars) */}
          {slaCompliance && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-bold text-gray-700 mb-4">SLA Compliance</h3>
              <div className="space-y-3">
                {[
                  { label: 'Within SLA', value: slaCompliance.withinSla, color: 'bg-green-500' },
                  { label: 'Breached', value: slaCompliance.breached, color: 'bg-red-500' },
                  { label: 'No SLA Set', value: slaCompliance.noSla, color: 'bg-gray-400' },
                ].map((item) => {
                  const total = slaCompliance.withinSla + slaCompliance.breached + slaCompliance.noSla;
                  const pct = total > 0 ? (item.value / total) * 100 : 0;
                  return (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-600 w-24 text-right">{item.label}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div className={`h-full rounded-full ${item.color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-900 w-16">{item.value} ({pct.toFixed(0)}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CRM TAB ──────────────────────────────────────────────────────── */}
      {!loading && activeTab === 'crm' && crmOverview && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon="lead" label="Active Leads" value={formatNumber(crmOverview.totalLeads)} color="bg-blue-50 text-blue-700" />
            <KpiCard icon="handshake" label="Opportunities" value={formatNumber(crmOverview.totalOpportunities)} color="bg-green-50 text-green-700" />
            <KpiCard icon="trending_up" label="Conversion Rate" value={formatPercent(crmOverview.conversionRate / 100)} color="bg-purple-50 text-purple-700" />
            <KpiCard icon="payments" label="Pipeline Value" value={`RM ${formatNumber(crmOverview.pipelineValue)}`} color="bg-amber-50 text-amber-700" />
          </div>

          {crmOverview.pipelineStages.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Pipeline by Stage</h3>
              <div className="space-y-3">
                {crmOverview.pipelineStages.map((s) => {
                  const maxVal = Math.max(...crmOverview.pipelineStages.map((x) => x.totalValue));
                  const pct = maxVal > 0 ? (s.totalValue / maxVal) * 100 : 0;
                  return (
                    <div key={s.stageId} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-600 w-32 text-right">{s.stageName}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                        <div className="h-full rounded-full bg-[#0052cc] transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-right w-28">
                        <span className="text-xs font-extrabold text-gray-900">RM {formatNumber(s.totalValue)}</span>
                        <span className="text-[10px] text-gray-400 ml-1">{s.dealCount} deals</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CREDIT TAB ────────────────────────────────────────────────────── */}
      {!loading && activeTab === 'credit' && creditOverview && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard icon="description" label="Applications" value={formatNumber(creditOverview.totalApplications)} color="bg-blue-50 text-blue-700" />
            <KpiCard icon="check_circle" label="Approved" value={formatNumber(creditOverview.approvedCount)} color="bg-green-50 text-green-700" />
            <KpiCard icon="cancel" label="Rejected" value={formatNumber(creditOverview.rejectedCount)} color="bg-red-50 text-red-700" />
            <KpiCard icon="hourglass_top" label="Outstanding" value={formatNumber(creditOverview.outstandingCount)} color="bg-amber-50 text-amber-700" />
            <KpiCard icon="payments" label="Total Requested" value={`RM ${formatNumber(creditOverview.totalRequestedAmount)}`} color="bg-purple-50 text-purple-700" />
          </div>

          {creditOverview.byState.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Applications by State</h3>
              <div className="flex gap-4 flex-wrap">
                {creditOverview.byState.map((s) => (
                  <div key={s.state} className="flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-2">
                    <span className="text-sm font-bold text-gray-700">{s.state}</span>
                    <span className="text-sm font-extrabold text-[#0052cc]">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && activeTab === 'overview' && !overview && (
        <div className="text-center py-20 text-gray-400">
          <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>insights</span>
          <p className="mt-2 text-sm">No data available</p>
        </div>
      )}
    </div>
  );
}