import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Breadcrumbs from '../src/components/Breadcrumbs';
import { Skeleton } from '../src/components/ui/Skeleton';
import { friendlyMessage } from '../src/utils/errorMessages';
import reportsService, {
  ReportSummary,
  StatusCount,
  ServiceDeskCount,
  PriorityCount,
  AgentWorkload,
  SlaStatus,
  DateRange,
} from '../src/services/reports.service';

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-yellow-500',
  LOW: 'bg-gray-400',
};

/** Quick-select preset ranges. */
const PRESETS: { label: string; days: number }[] = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'YTD', days: -1 }, // special: year-to-date
];

function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [statuses, setStatuses] = useState<StatusCount[]>([]);
  const [serviceDesks, setServiceDesks] = useState<ServiceDeskCount[]>([]);
  const [priorities, setPriorities] = useState<PriorityCount[]>([]);
  const [agents, setAgents] = useState<AgentWorkload[]>([]);
  const [sla, setSla] = useState<SlaStatus | null>(null);

  // Date range from URL search params
  const fromParam = searchParams.get('from') || '';
  const toParam = searchParams.get('to') || '';
  const [fromDate, setFromDate] = useState(fromParam);
  const [toDate, setToDate] = useState(toParam);

  const buildRange = useCallback((): DateRange | undefined => {
    if (!fromDate && !toDate) return undefined;
    const range: DateRange = {};
    if (fromDate) range.from = new Date(fromDate).toISOString();
    if (toDate) range.to = new Date(toDate + 'T23:59:59').toISOString();
    return range;
  }, [fromDate, toDate]);

  // Sync URL params when date inputs change
  const syncParams = useCallback(() => {
    const params = new URLSearchParams();
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    setSearchParams(params, { replace: true });
  }, [fromDate, toDate, setSearchParams]);

  useEffect(() => { syncParams(); }, [fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPreset = (days: number) => {
    const now = new Date();
    if (days === -1) {
      // YTD
      setFromDate(toISO(new Date(now.getFullYear(), 0, 1)));
      setToDate(toISO(now));
    } else {
      setFromDate(toISO(new Date(now.getTime() - days * 86400000)));
      setToDate(toISO(now));
    }
  };

  const clearDates = () => {
    setFromDate('');
    setToDate('');
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    const range = buildRange();
    Promise.all([
      reportsService.getSummary(range),
      reportsService.getByStatus(range),
      reportsService.getByServiceDesk(range),
      reportsService.getByPriority(range),
      reportsService.getAgentWorkload(range),
      reportsService.getSlaStatus(range),
    ])
      .then(([summaryData, statusData, sdData, priorityData, agentData, slaData]) => {
        setSummary(summaryData);
        setStatuses(statusData);
        setServiceDesks(sdData);
        setPriorities(priorityData);
        setAgents(agentData.sort((a, b) => b.activeTickets - a.activeTickets));
        setSla(slaData);
      })
      .catch((err) => {
        setError(friendlyMessage(err, 'Failed to load reports'));
      })
      .finally(() => setLoading(false));
  }, [buildRange, refreshKey]);

  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-8" aria-busy="true">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Reports' }]} />
        <div>
          <Skeleton height={28} width={240} aria-label="Loading page title" />
          <Skeleton height={14} width={320} className="mt-2" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
              <Skeleton height={10} width="60%" />
              <Skeleton height={28} width="40%" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-3">
              <Skeleton height={16} width="50%" />
              <Skeleton height={120} width="100%" rounded="lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-6">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Reports' }]} />
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-red-500 text-3xl">error</span>
          </div>
          <h2 className="text-lg font-semibold text-red-800">Failed to load reports</h2>
          <p className="text-sm text-red-600 mt-1">{error}</p>
          <button
            onClick={() => { setError(null); setRefreshKey(k => k + 1); }}
            className="mt-4 px-4 py-2 text-sm font-medium rounded-md bg-white dark:bg-gray-900 border border-red-300 text-red-700 hover:bg-red-50 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const totalPriority = priorities.reduce((s, p) => s + p.count, 0);
  const slaTotal = sla ? sla.withinSla + sla.breached + sla.noSla : 0;

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-8">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[
        { label: 'Home', to: '/' },
        { label: 'Reports' },
      ]} />

      {/* Page header + date range */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reports & Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Overview of helpdesk performance metrics</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Preset buttons */}
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setPreset(p.days)}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-800 transition-colors"
            >
              {p.label}
            </button>
          ))}

          {/* Date inputs */}
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-700 outline-none"
            aria-label="From date"
          />
          <span className="text-xs text-gray-400">—</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-700 outline-none"
            aria-label="To date"
          />

          {/* Clear */}
          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={clearDates}
              className="px-2 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Summary row — 5 cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Tickets</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{summary.total}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Open</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{summary.open}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Resolved</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{summary.resolved}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Unassigned</p>
            <p className="text-3xl font-bold text-orange-500 mt-1">{summary.unassigned}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Avg Resolution</p>
            <p className="text-3xl font-bold text-purple-600 mt-1">
              {summary.avgResolutionHours != null
                ? `${summary.avgResolutionHours.toFixed(1)}h`
                : '—'}
            </p>
          </div>
        </div>
      )}

      {/* 2-column grid — 4 panels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* By Service Desk */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">By Service Desk</h2>
          <ul className="space-y-3">
            {serviceDesks.map((sd) => (
              <li key={sd.serviceDeskId} className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">{sd.name}</span>
                <span className="text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2.5 py-0.5 rounded-full">
                  {sd.count}
                </span>
              </li>
            ))}
            {serviceDesks.length === 0 && (
              <li className="text-sm text-gray-400">No data</li>
            )}
          </ul>
        </div>

        {/* By Priority */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">By Priority</h2>
          <ul className="space-y-4">
            {priorities.map((p) => {
              const pct = totalPriority > 0 ? Math.round((p.count / totalPriority) * 100) : 0;
              const barColor = PRIORITY_COLORS[p.priority] ?? 'bg-gray-400';
              return (
                <li key={p.priority}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{p.priority}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{p.count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
            {priorities.length === 0 && (
              <li className="text-sm text-gray-400">No data</li>
            )}
          </ul>
        </div>

        {/* SLA Compliance */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">SLA Compliance</h2>
          {sla ? (
            <>
              <div className="flex gap-4 mb-5">
                <div className="flex-1 bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-700">{sla.withinSla}</p>
                  <p className="text-xs text-green-600 mt-1">Within SLA</p>
                </div>
                <div className="flex-1 bg-red-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-red-700">{sla.breached}</p>
                  <p className="text-xs text-red-600 mt-1">Breached</p>
                </div>
                <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{sla.noSla}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No SLA Set</p>
                </div>
              </div>
              {slaTotal > 0 && (
                <div className="h-3 flex rounded-full overflow-hidden">
                  {sla.withinSla > 0 && (
                    <div
                      className="bg-green-500"
                      style={{ width: `${(sla.withinSla / slaTotal) * 100}%` }}
                    />
                  )}
                  {sla.breached > 0 && (
                    <div
                      className="bg-red-500"
                      style={{ width: `${(sla.breached / slaTotal) * 100}%` }}
                    />
                  )}
                  {sla.noSla > 0 && (
                    <div
                      className="bg-gray-300"
                      style={{ width: `${(sla.noSla / slaTotal) * 100}%` }}
                    />
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">No data</p>
          )}
        </div>

        {/* Agent Workload */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">Agent Workload</h2>
          <ul className="space-y-3">
            {agents.map((agent) => (
              <li key={agent.agentId} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{agent.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{agent.email}</p>
                </div>
                <span className="text-sm font-semibold bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full">
                  {agent.activeTickets}
                </span>
              </li>
            ))}
            {agents.length === 0 && (
              <li className="text-sm text-gray-400">No data</li>
            )}
          </ul>
        </div>
      </div>

      {/* Full-width By Status */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">By Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {statuses.map((s) => (
            <div
              key={s.status}
              className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center border border-gray-100 dark:border-gray-700"
            >
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{s.count}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 capitalize">
                {s.status.replace(/_/g, ' ')}
              </p>
            </div>
          ))}
          {statuses.length === 0 && (
            <p className="col-span-full text-sm text-gray-400">No data</p>
          )}
        </div>
      </div>
    </div>
  );
}