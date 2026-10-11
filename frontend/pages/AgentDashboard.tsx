import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../src/context/AuthContext';
import Breadcrumbs from '../src/components/Breadcrumbs';
import { requestService } from '../src/services/request.service';
import { DashboardPriority, DashboardQueue, DashboardSlaState, DashboardSort, DashboardScope } from '../src/services/agent-dashboard.service';
import { friendlyMessage } from '../src/utils/errorMessages';
import { useAgentDashboard } from '../src/components/agent-dashboard/useAgentDashboard';
import { DashboardSummary } from '../src/components/agent-dashboard/DashboardSummary';
import { DashboardFilters } from '../src/components/agent-dashboard/DashboardFilters';
import { DashboardTabs } from '../src/components/agent-dashboard/DashboardTabs';
import { AttentionQueue } from '../src/components/agent-dashboard/AttentionQueue';
import { TicketTable } from '../src/components/agent-dashboard/TicketTable';
import { DashboardPagination } from '../src/components/agent-dashboard/DashboardPagination';

export default function AgentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [scope, setScope] = useState<DashboardScope>('mine');
  const [queue, setQueue] = useState<DashboardQueue>('open');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<25 | 50 | 100>(25);
  const [search, setSearch] = useState('');
  const [requestTypeId, setRequestTypeId] = useState('');
  const [priority, setPriority] = useState<DashboardPriority | ''>('');
  const [slaState, setSlaState] = useState<DashboardSlaState | ''>('');
  const [sort, setSort] = useState<DashboardSort>('updated-desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const query = useMemo(() => ({
    scope, queue, page, limit, search: search || undefined, requestTypeId: requestTypeId || undefined,
    priority: priority || undefined, slaState: slaState || undefined, sort,
  }), [scope, queue, page, limit, search, requestTypeId, priority, slaState, sort]);
  const { data, initialLoading, refreshing, searching, error, stale, refresh } = useAgentDashboard(query);
  const canExport = user?.permissions?.includes('request:export') ?? false;
  const unassignedAllowed = scope !== 'mine';
  const filterIdentity = JSON.stringify(query);
  const resultIdentity = data?.tickets.map((ticket) => ticket.id).join('|') ?? '';
  const visibleSelectedIds = new Set((data?.tickets ?? []).filter((ticket) => selectedIds.has(ticket.id)).map((ticket) => ticket.id));

  useEffect(() => {
    setSelectedIds(new Set()); setExportMessage(null);
  }, [filterIdentity, resultIdentity]);
  useEffect(() => {
    if (!data) return;
    const lastPage = Math.max(1, data.pagination.totalPages);
    if (page > lastPage) setPage(lastPage);
  }, [data, page]);

  const clearTableFilters = () => {
    setSearch(''); setRequestTypeId(''); setPriority(''); setSlaState(''); setPage(1);
  };
  const changeQueue = (value: DashboardQueue) => {
    if (value === 'unassigned' && !unassignedAllowed) return;
    setQueue(value); setPage(1);
  };
  const setCardFilter = (state?: DashboardSlaState) => {
    clearTableFilters(); setQueue('open'); setSlaState(state ?? ''); setSort('urgency'); setPage(1);
  };
  const toggleOne = (id: string) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const togglePage = () => {
    if (!data) return;
    const visibleIds = data.tickets.map((ticket) => ticket.id);
    setSelectedIds((current) => visibleIds.every((id) => current.has(id))
      ? new Set([...current].filter((id) => !visibleIds.includes(id)))
      : new Set([...current, ...visibleIds]));
  };
  const exportSelected = async () => {
    const idsToExport = data?.tickets.filter((ticket) => selectedIds.has(ticket.id)).map((ticket) => ticket.id) ?? [];
    if (!canExport || idsToExport.length === 0) return;
    setExporting(true); setExportMessage(null);
    try {
      const blob = await requestService.exportXlsx(idsToExport);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `tickets-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
      setSelectedIds(new Set()); setExportMessage({ type: 'success', text: 'Export downloaded.' });
    } catch (exportError) {
      setExportMessage({ type: 'error', text: friendlyMessage(exportError, 'Ticket export failed.') });
    } finally { setExporting(false); }
  };

  const noTeam = user?.roles?.includes('AGENT') && !user?.agentTeam;
  return <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
    <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Agent Dashboard' }]} />
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Agent Dashboard</h1><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Personal and team work, with resolution SLA status.</p>
        {data && <p className="mt-1 text-xs text-gray-500">{data.scopeLabel} · As of {new Date(data.asOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
      </div>
      <button type="button" onClick={refresh} disabled={refreshing} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200">{refreshing ? 'Refreshing…' : 'Refresh'}</button>
    </header>

    {noTeam && <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900" role="status">Your team queue is unavailable because no team is configured. My work remains available.</p>}
    {stale && <p role="status" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Refresh failed. Showing the last successful dashboard snapshot. {error ? friendlyMessage(error, '') : ''}</p>}
    {!data && error && <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900"><p>{friendlyMessage(error, 'Could not load the agent dashboard.')}</p><button type="button" onClick={refresh} className="mt-2 rounded border border-red-400 px-3 py-1 font-medium">Retry</button></div>}
    {!data && initialLoading && <p role="status" className="py-12 text-center text-sm text-gray-600">Loading dashboard…</p>}

    {data && <>
      <DashboardSummary data={data} loading={initialLoading} onOpen={() => setCardFilter()} onDueSoon={() => setCardFilter('DUE_SOON')} onBreached={() => setCardFilter('BREACHED')} />
      <AttentionQueue total={data.attention.total} tickets={data.attention.tickets} onViewOpen={() => setCardFilter()} onNavigate={(ticket) => navigate(`/request/${ticket.reference}`)} />
      <DashboardFilters
        scope={scope} availableScopes={data.availableScopes} search={search} requestTypeId={requestTypeId} priority={priority} slaState={slaState} sort={sort}
        requestTypes={data.requestTypes} hasFilters={Boolean(search || requestTypeId || priority || slaState)} searching={searching}
        onScope={(value) => { setScope(value); if (value === 'mine' && queue === 'unassigned') setQueue('open'); setPage(1); }}
        onSearch={(value) => { setSearch(value.slice(0, 200)); setPage(1); }}
        onRequestType={(value) => { setRequestTypeId(value); setPage(1); }}
        onPriority={(value) => { setPriority(value); setPage(1); }}
        onSla={(value) => { setSlaState(value); setPage(1); }}
        onSort={(value) => { setSort(value); setPage(1); }}
        onClear={clearTableFilters}
      />
      <DashboardTabs queue={queue} counts={data.queueCounts} showUnassigned={unassignedAllowed} onChange={changeQueue} />
      {data.pagination.total === 0 && (search || requestTypeId || priority || slaState)
        ? <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">No tickets match these filters. <button type="button" className="text-blue-700 underline" onClick={clearTableFilters}>Clear filters</button></p>
        : <p className="mb-3 text-sm text-gray-600 dark:text-gray-300" aria-live="polite">Showing {data.tickets.length} of {data.pagination.total} tickets</p>}
      <TicketTable tickets={data.tickets} canExport={canExport} selectedIds={visibleSelectedIds} onToggle={toggleOne} onTogglePage={togglePage} onExport={exportSelected} exporting={exporting} />
      {exportMessage && <p role={exportMessage.type === 'error' ? 'alert' : 'status'} className="my-2 text-sm">{exportMessage.text}</p>}
      <DashboardPagination page={data.pagination.page} limit={data.pagination.limit as 25 | 50 | 100} total={data.pagination.total} totalPages={data.pagination.totalPages} onPage={setPage} onLimit={(value) => { setLimit(value); setPage(1); }} />
    </>}
    <span className="sr-only" aria-live="polite">{refreshing ? 'Refreshing dashboard' : ''} {initialLoading ? 'Loading dashboard' : ''}</span>
  </main>;
}
