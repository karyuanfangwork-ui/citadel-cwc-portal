import React, { useEffect, useState } from 'react';
import Breadcrumbs from '../src/components/Breadcrumbs';
import reportsService, {
  ReportSummary,
  StatusCount,
  ServiceDeskCount,
  PriorityCount,
  AgentWorkload,
  SlaStatus,
} from '../src/services/reports.service';

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-yellow-500',
  LOW: 'bg-gray-400',
};

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [statuses, setStatuses] = useState<StatusCount[]>([]);
  const [serviceDesks, setServiceDesks] = useState<ServiceDeskCount[]>([]);
  const [priorities, setPriorities] = useState<PriorityCount[]>([]);
  const [agents, setAgents] = useState<AgentWorkload[]>([]);
  const [sla, setSla] = useState<SlaStatus | null>(null);

  useEffect(() => {
    Promise.all([
      reportsService.getSummary(),
      reportsService.getByStatus(),
      reportsService.getByServiceDesk(),
      reportsService.getByPriority(),
      reportsService.getAgentWorkload(),
      reportsService.getSlaStatus(),
    ])
      .then(([summaryData, statusData, sdData, priorityData, agentData, slaData]) => {
        setSummary(summaryData);
        setStatuses(statusData);
        setServiceDesks(sdData);
        setPriorities(priorityData);
        setAgents(agentData.sort((a, b) => b.activeTickets - a.activeTickets));
        setSla(slaData);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
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
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of helpdesk performance metrics</p>
      </div>

      {/* Summary row — 5 cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Tickets</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{summary.total}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Open</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{summary.open}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Resolved</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{summary.resolved}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Unassigned</p>
            <p className="text-3xl font-bold text-orange-500 mt-1">{summary.unassigned}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Resolution</p>
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
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">By Service Desk</h2>
          <ul className="space-y-3">
            {serviceDesks.map((sd) => (
              <li key={sd.serviceDeskId} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{sd.name}</span>
                <span className="text-sm font-semibold bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full">
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
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">By Priority</h2>
          <ul className="space-y-4">
            {priorities.map((p) => {
              const pct = totalPriority > 0 ? Math.round((p.count / totalPriority) * 100) : 0;
              const barColor = PRIORITY_COLORS[p.priority] ?? 'bg-gray-400';
              return (
                <li key={p.priority}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700 capitalize">{p.priority}</span>
                    <span className="text-xs text-gray-500">{p.count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
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
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">SLA Compliance</h2>
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
                <div className="flex-1 bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-600">{sla.noSla}</p>
                  <p className="text-xs text-gray-500 mt-1">No SLA Set</p>
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
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Agent Workload</h2>
          <ul className="space-y-3">
            {agents.map((agent) => (
              <li key={agent.agentId} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{agent.name}</p>
                  <p className="text-xs text-gray-500">{agent.email}</p>
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
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">By Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {statuses.map((s) => (
            <div
              key={s.status}
              className="bg-gray-50 rounded-lg p-4 text-center border border-gray-100"
            >
              <p className="text-2xl font-bold text-gray-900">{s.count}</p>
              <p className="text-xs text-gray-500 mt-1 capitalize">
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
