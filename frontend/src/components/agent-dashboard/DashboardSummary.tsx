import { AgentDashboardResponse } from '../../services/agent-dashboard.service';

interface Props { data: AgentDashboardResponse; loading: boolean; onOpen: () => void; onDueSoon: () => void; onBreached: () => void; }

export function DashboardSummary({ data, loading, onOpen, onDueSoon, onBreached }: Props) {
  const metrics = [
    { label: 'Open tickets', value: data.metrics.open, action: onOpen },
    { label: 'Due soon', value: data.metrics.dueSoon, action: onDueSoon },
    { label: 'SLA breached', value: data.metrics.breached, action: onBreached },
  ];
  return <section aria-label="Work summary" className="mb-6">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => <button key={metric.label} type="button" onClick={metric.action} className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm hover:border-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-gray-700 dark:bg-gray-900">
        <span className="block text-sm text-gray-600 dark:text-gray-300">{metric.label}</span>
        <span className="mt-1 block text-2xl font-semibold text-gray-900 dark:text-gray-100">{loading ? '—' : metric.value}</span>
      </button>)}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <span className="block text-sm text-gray-600 dark:text-gray-300">Avg resolution</span>
        <span className="mt-1 block text-2xl font-semibold text-gray-900 dark:text-gray-100">{loading ? '—' : data.metrics.avgResolutionHours === null ? 'No resolution data' : `${data.metrics.avgResolutionHours.toFixed(1)}h`}</span>
        {!loading && <span className="mt-1 block text-xs text-gray-500">Last 30 days · elapsed time · n={data.metrics.resolutionSampleSize}</span>}
      </div>
    </div>
    <p className="mt-2 text-xs text-gray-500">Cards use {data.scopeLabel} and the selected request type; search, priority, SLA filter, and queue tab affect only the table.</p>
  </section>;
}
