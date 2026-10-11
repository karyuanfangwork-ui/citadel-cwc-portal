import { DashboardPriority, DashboardSlaState, DashboardSort, DashboardScope } from '../../services/agent-dashboard.service';

interface Props {
  scope: DashboardScope; availableScopes: DashboardScope[]; search: string; requestTypeId: string; priority: DashboardPriority | ''; slaState: DashboardSlaState | '';
  sort: DashboardSort; requestTypes: { id: string; name: string }[]; hasFilters: boolean; searching: boolean;
  onScope: (value: DashboardScope) => void; onSearch: (value: string) => void; onRequestType: (value: string) => void;
  onPriority: (value: DashboardPriority | '') => void; onSla: (value: DashboardSlaState | '') => void; onSort: (value: DashboardSort) => void; onClear: () => void;
}
const control = 'h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';
export function DashboardFilters(props: Props) {
  return <div className="mb-4 flex flex-wrap items-end gap-3" role="search" aria-label="Filter dashboard tickets">
    <label className="flex min-w-52 flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">Work scope
      <select className={control} aria-label="Work scope" value={props.scope} onChange={(e) => props.onScope(e.target.value as DashboardScope)}>
        {props.availableScopes.map((scope) => <option key={scope} value={scope}>{scope === 'mine' ? 'My work' : scope === 'team' ? 'My team' : 'All accessible work'}</option>)}
      </select>
    </label>
    <label className="flex min-w-64 flex-1 flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">Search tickets
      <input className={control} type="search" maxLength={200} value={props.search} onChange={(e) => props.onSearch(e.target.value)} placeholder="Reference, summary, requester, request type" />
    </label>
    <label className="flex min-w-44 flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">Request type
      <select className={control} aria-label="Request type" value={props.requestTypeId} onChange={(e) => props.onRequestType(e.target.value)}>
        <option value="">All request types</option>{props.requestTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
      </select>
    </label>
    <label className="flex min-w-36 flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">Priority
      <select className={control} aria-label="Priority" value={props.priority} onChange={(e) => props.onPriority(e.target.value as DashboardPriority | '')}>
        <option value="">All priorities</option>{(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((value) => <option key={value} value={value}>{value[0] + value.slice(1).toLowerCase()}</option>)}
      </select>
    </label>
    <label className="flex min-w-40 flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">Resolution SLA
      <select className={control} aria-label="Resolution SLA" value={props.slaState} onChange={(e) => props.onSla(e.target.value as DashboardSlaState | '')}>
        <option value="">All SLA states</option>
        <option value="BREACHED">Breached</option><option value="DUE_SOON">Due soon</option><option value="ON_TRACK">On track</option>
        <option value="PAUSED">Paused</option><option value="NO_SLA">No SLA</option><option value="MET">Met SLA</option><option value="MISSED">Missed SLA</option>
        <option value="NOT_APPLICABLE">Not applicable</option><option value="UNKNOWN">Unavailable</option>
      </select>
    </label>
    <label className="flex min-w-44 flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">Sort tickets
      <select className={control} aria-label="Sort tickets" value={props.sort} onChange={(e) => props.onSort(e.target.value as DashboardSort)}>
        <option value="urgency">SLA urgency</option><option value="created-desc">Latest created</option><option value="created-asc">Oldest created</option><option value="updated-desc">Latest updated</option>
      </select>
    </label>
    {props.searching && <span className="self-center text-xs text-gray-500" role="status">Searching…</span>}
    {props.hasFilters && <button type="button" onClick={props.onClear} className="h-10 rounded-lg px-3 text-sm font-medium text-blue-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Clear filters</button>}
  </div>;
}
