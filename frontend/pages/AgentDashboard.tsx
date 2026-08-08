import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../src/context/AuthContext';
import { STATUS_CONFIG } from '../constants';
import Breadcrumbs from '../src/components/Breadcrumbs';
import { stripHtml } from '../src/utils/format';
import { friendlyMessage } from '../src/utils/errorMessages';
import reportsService, { ReportSummary, SlaStatus } from '../src/services/reports.service';
import api from '../src/services/api';
import SkeletonRow from '../src/components/SkeletonRow';
import { requestService } from '../src/services/request.service';

interface TicketRow {
  id: string;
  reference: string;
  summary: string;
  priority: string;
  status: string;
  createdAt?: string | null;
  slaDeadline?: string | null;
  requester?: { firstName: string; lastName: string; email: string } | null;
  requestType?: { id: string; name: string } | null;
}

function getSlaDisplay(slaDeadline?: string | null): { label: string; breached: boolean } {
  if (!slaDeadline) return { label: 'No SLA', breached: false };
  const now = new Date();
  const deadline = new Date(slaDeadline);
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs < 0) {
    const hoursAgo = Math.round(Math.abs(diffMs) / 3600000);
    return { label: `Breached ${hoursAgo}h ago`, breached: true };
  }
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 60) return { label: `${diffMins}m left`, breached: false };
  const diffHours = Math.round(diffMs / 3600000);
  if (diffHours < 24) return { label: `${diffHours}h left`, breached: false };
  const diffDays = Math.round(diffMs / 86400000);
  return { label: `${diffDays}d left`, breached: false };
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  CRITICAL: { label: 'Critical', color: 'text-red-700', bg: 'bg-red-100' },
  HIGH: { label: 'High', color: 'text-orange-700', bg: 'bg-orange-100' },
  MEDIUM: { label: 'Medium', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  LOW: { label: 'Low', color: 'text-gray-600', bg: 'bg-gray-100' },
};

const TEAM_LABELS: Record<string, string> = {
  IT: 'IT',
  HR: 'HR',
  FINANCE: 'Finance',
};

export default function AgentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.roles?.includes('ADMIN') ?? false;
  const isAgent = user?.roles?.includes('AGENT') ?? false;
  const showAllTab = isAdmin || isAgent;
  const showUnassignedTab = isAdmin;
  const allTabLabel = isAdmin ? 'All Tickets' : `All ${TEAM_LABELS[user?.agentTeam ?? ''] ?? user?.agentTeam ?? ''} Tickets`;
  const [activeTab, setActiveTab] = useState<'mine' | 'unassigned' | 'all' | 'resolved'>('mine');
  const [refreshKey, setRefreshKey] = useState(0);
  const [myTickets, setMyTickets] = useState<TicketRow[]>([]);
  const [resolvedTicketsFetched, setResolvedTicketsFetched] = useState<TicketRow[]>([]);
  const [unassignedTickets, setUnassignedTickets] = useState<TicketRow[]>([]);
  const [allTickets, setAllTickets] = useState<TicketRow[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [slaStatus, setSlaStatus] = useState<SlaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequestTypeId, setSelectedRequestTypeId] = useState<string | null>(null);
  const [requestTypeOptions, setRequestTypeOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [slaFilter, setSlaFilter] = useState('');
  const [sortBy, setSortBy] = useState<'urgency' | 'created-desc' | 'created-asc'>('created-desc');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const CLOSED_STATUSES = ['RESOLVED', 'CLOSED', 'REJECTED', 'CANCELLED', 'REIMBURSEMENT_CLOSED', 'CEO_REJECTED', 'MANAGER_REJECTED_FIN', 'FINANCE_HEAD_REJECTED', 'CTO_REJECTED_IT', 'CFO_REJECTED_IT', 'COMPLETED', 'CANDIDATE_REJECTED_INTERVIEW', 'ONBOARDING_COMPLETED', 'OFFBOARDING_COMPLETED', 'PAYMENT_COMPLETED', 'LOA_ACCEPTED', 'TICKET_CLOSED_FIN', 'CFO_REJECTED_FIN', 'DCEO_REJECTED_FIN', 'GROUP_DCEO_REJECTED', 'PAYMENT_CONFIRMED_FIN', 'CHARGEBACK_COMPLETED', 'FROM_ENTITY_REJECTED', 'TO_ENTITY_REJECTED'];

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const myParams: Record<string, any> = { assignedToId: user?.id, excludedStatuses: CLOSED_STATUSES.join(','), limit: 200 };
        const resolvedParams: Record<string, any> = { status: CLOSED_STATUSES.join(','), limit: 200 };
        const unParams: Record<string, any> = { assignedToId: 'none', limit: 200 };
        const allParams: Record<string, any> = { limit: 200 };
        if (selectedRequestTypeId) {
          myParams.requestTypeId = selectedRequestTypeId;
          resolvedParams.requestTypeId = selectedRequestTypeId;
          unParams.requestTypeId = selectedRequestTypeId;
          allParams.requestTypeId = selectedRequestTypeId;
        }

        // Fetch reports separately — these require report:read permission
        // which non-admin agents may lack; failures must not block ticket loading
        const [summaryResult, slaResult] = await Promise.allSettled([
          reportsService.getSummary(),
          reportsService.getSlaStatus(),
        ]);
        if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value);
        if (slaResult.status === 'fulfilled') setSlaStatus(slaResult.value);

        // Fetch tickets — these are critical and must always load
        const ticketRequests = [
          api.get('/requests', { params: myParams }),
          api.get('/requests', { params: resolvedParams }),
          api.get('/requests', { params: unParams }),
          ...(showAllTab ? [api.get('/requests', { params: allParams })] : []),
        ];

        const ticketResults = await Promise.all(ticketRequests);
        const [myRes, resolvedRes, unRes, allRes] = ticketResults as any[];

        const extractTickets = (res: any): TicketRow[] => {
          const raw = res.data?.data;
          const arr = Array.isArray(raw) ? raw : (raw?.requests ?? []);
          return arr.map((r: any) => ({
            id: r.id,
            reference: r.reference ?? r.referenceNumber ?? r.id,
            summary: r.summary,
            priority: r.priority ?? 'MEDIUM',
            status: r.status,
            createdAt: r.createdAt ?? r.created_at ?? null,
            slaDeadline: r.slaDeadline ?? r.sla_deadline ?? r.slaDueAt ?? null,
            requester: r.requester ?? r.requestedBy ?? null,
            requestType: r.requestType ?? null,
          }));
        };

        setMyTickets(extractTickets(myRes));
        setResolvedTicketsFetched(extractTickets(resolvedRes));
        setUnassignedTickets(extractTickets(unRes));
        if (showAllTab && allRes) setAllTickets(extractTickets(allRes));
        setLastUpdatedAt(new Date());
      } catch (err) {
        console.error('AgentDashboard fetch error:', err);
        setError(friendlyMessage(err, 'Failed to load dashboard'));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user?.id, selectedRequestTypeId, refreshKey]);

  useEffect(() => {
    if (selectedRequestTypeId) return;
    const seen = new Set<string>();
    const options: { id: string; name: string }[] = [];
    [...myTickets, ...resolvedTicketsFetched, ...unassignedTickets, ...allTickets].forEach((t) => {
      if (t.requestType && !seen.has(t.requestType.id)) {
        seen.add(t.requestType.id);
        options.push({ id: t.requestType.id, name: t.requestType.name });
      }
    });
    setRequestTypeOptions(options);
  }, [myTickets, resolvedTicketsFetched, unassignedTickets, allTickets]);

  const openTickets = myTickets;
  const resolvedTickets = showAllTab
    ? allTickets.filter(t => CLOSED_STATUSES.includes(t.status))
    : resolvedTicketsFetched;

  const tickets = activeTab === 'mine' ? openTickets
    : activeTab === 'resolved' ? resolvedTickets
    : activeTab === 'all' ? allTickets
    : unassignedTickets;

  const visibleTickets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tickets
      .filter((ticket) => {
        const requesterName = ticket.requester
          ? `${ticket.requester.firstName} ${ticket.requester.lastName}`
          : '';
        const matchesSearch = !query || [ticket.reference, ticket.summary, requesterName, ticket.requestType?.name]
          .some((value) => value?.toLowerCase().includes(query));
        const matchesPriority = !priorityFilter || ticket.priority === priorityFilter;
        const sla = getSlaDisplay(ticket.slaDeadline);
        const matchesSla = !slaFilter
          || (slaFilter === 'breached' && sla.breached)
          || (slaFilter === 'at-risk' && !sla.breached && sla.label !== 'No SLA' && !sla.label.includes('d left'))
          || (slaFilter === 'on-track' && !sla.breached && sla.label !== 'No SLA' && !sla.label.includes('h left'));
        return matchesSearch && matchesPriority && matchesSla;
      })
      .sort((a, b) => {
        if (sortBy === 'created-desc' || sortBy === 'created-asc') {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return sortBy === 'created-desc' ? bTime - aTime : aTime - bTime;
        }
        const aSla = getSlaDisplay(a.slaDeadline);
        const bSla = getSlaDisplay(b.slaDeadline);
        if (aSla.breached !== bSla.breached) return aSla.breached ? -1 : 1;
        const priorityRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return (priorityRank[a.priority] ?? 4) - (priorityRank[b.priority] ?? 4);
      });
  }, [tickets, searchQuery, priorityFilter, slaFilter, sortBy]);

  const attentionTickets = useMemo(() => {
    const seen = new Set<string>();
    return [...myTickets, ...(showUnassignedTab ? unassignedTickets : [])]
      .filter((ticket) => {
        if (seen.has(ticket.id)) return false;
        seen.add(ticket.id);
        const sla = getSlaDisplay(ticket.slaDeadline);
        return sla.breached || ticket.priority === 'CRITICAL' || ticket.priority === 'HIGH';
      })
      .sort((a, b) => Number(getSlaDisplay(b.slaDeadline).breached) - Number(getSlaDisplay(a.slaDeadline).breached))
      .slice(0, 3);
  }, [myTickets, unassignedTickets, showUnassignedTab]);

  // ── Multi-select & Export ──
  const toggleSelectAll = () => {
    if (selectedIds.size === visibleTickets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleTickets.map(t => t.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleExportXlsx = async () => {
    if (selectedIds.size === 0) return;
    setExportingXlsx(true);
    try {
      const blob = await requestService.exportXlsx(Array.from(selectedIds));
      const timestamp = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tickets-export-${timestamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSelectedIds(new Set());
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Failed to export Excel');
    } finally {
      setExportingXlsx(false);
    }
  };

  // Clear selections when tab or filter changes
  useEffect(() => { setSelectedIds(new Set()); }, [activeTab, selectedRequestTypeId]);

  const cards = [
    {
      label: 'My Open Tickets',
      value: openTickets.length,
      icon: 'confirmation_number',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Resolved',
      value: resolvedTickets.length,
      icon: 'task_alt',
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Unassigned',
      value: unassignedTickets.length,
      icon: 'inbox',
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      label: 'SLA Breached',
      value: slaStatus?.breached ?? 0,
      icon: 'timer_off',
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'Avg Resolution',
      value: summary ? `${Math.round(summary.avgResolutionHours)}h` : '—',
      icon: 'avg_pace',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <Breadcrumbs items={[
        { label: 'Home', to: '/' },
        { label: 'Agent Dashboard' },
      ]} />

      {/* P4-04: Error state banner */}
      {error && !loading && (
       <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center justify-between">
         <div className="flex items-center gap-2">
           <span className="material-symbols-outlined text-red-500 text-xl">error</span>
           <span className="text-sm text-red-700">{error}</span>
         </div>
         <button
           onClick={() => { setError(null); setRefreshKey(k => k + 1); }}
           className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-gray-900 border border-red-300 text-red-700 hover:bg-red-50 transition-colors"
         >
           Retry
         </button>
       </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Agent Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Welcome back, {user?.firstName}. Here's your queue overview.</p>
          {lastUpdatedAt && <p className="text-xs text-gray-400 mt-2">Updated {lastUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>refresh</span>
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {cards.filter((card) => showUnassignedTab || card.label !== 'Unassigned').map(card => (
          <button
            key={card.label}
            type="button"
            onClick={() => {
              if (card.label === 'My Open Tickets') setActiveTab('mine');
              if (card.label === 'Resolved') setActiveTab('resolved');
              if (card.label === 'Unassigned') setActiveTab('unassigned');
              if (card.label === 'SLA Breached') { setActiveTab(showAllTab ? 'all' : 'mine'); setSlaFilter('breached'); }
            }}
            className="text-left bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4 hover:border-blue-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition-all"
          >
            <div className={`w-12 h-12 rounded-lg ${card.bg} flex items-center justify-center flex-shrink-0`}>
              <span className={`material-symbols-outlined ${card.color} text-2xl`}>{card.icon}</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{loading ? '—' : card.value}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Needs attention */}
      {attentionTickets.length > 0 && (
        <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50/70 p-4" aria-labelledby="needs-attention-heading">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <h2 id="needs-attention-heading" className="text-sm font-bold text-gray-900">Needs attention</h2>
              <p className="text-xs text-gray-600 mt-0.5">Prioritised by SLA risk and ticket urgency.</p>
            </div>
            <button type="button" onClick={() => { setActiveTab(showAllTab ? 'all' : 'mine'); setSlaFilter('breached'); }} className="text-xs font-semibold text-blue-700 hover:text-blue-900">View breached</button>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {attentionTickets.map((ticket) => {
              const sla = getSlaDisplay(ticket.slaDeadline);
              return (
                <button key={ticket.id} type="button" onClick={() => navigate(`/request/${ticket.reference || ticket.id}`)} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white px-3 py-2 text-left hover:border-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                  <span className="min-w-0">
                    <span className="block text-xs font-mono font-semibold text-gray-600">{ticket.reference}</span>
                    <span className="block truncate text-sm font-medium text-gray-900">{stripHtml(ticket.summary)}</span>
                  </span>
                  <span className={`shrink-0 text-xs font-semibold ${sla.breached ? 'text-red-600' : 'text-amber-700'}`}>{sla.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Queue filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2" role="search" aria-label="Filter tickets">
        <label className="sr-only" htmlFor="ticket-search">Search tickets</label>
        <input id="ticket-search" type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search tickets, requesters, or summaries" className="w-full md:w-80 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none" />
        <select
          aria-label="Request type"
          className="pl-3 pr-8 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-500 dark:text-gray-400"
          value={selectedRequestTypeId || ''}
          onChange={(e) => setSelectedRequestTypeId(e.target.value || null)}
        >
          <option value="">All request types</option>
          {requestTypeOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.name}</option>
          ))}
        </select>
        <select aria-label="Priority" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none">
          <option value="">All priorities</option>
          <option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
        </select>
        <select aria-label="SLA status" value={slaFilter} onChange={(e) => setSlaFilter(e.target.value)} className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none">
          <option value="">All SLA states</option><option value="breached">Breached</option><option value="at-risk">Due soon</option><option value="on-track">On track</option>
        </select>
        <select aria-label="Sort tickets" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none">
          <option value="urgency">Sort: SLA urgency</option>
          <option value="created-desc">Sort: Latest created</option>
          <option value="created-asc">Sort: Oldest created</option>
        </select>
        {(searchQuery || priorityFilter || slaFilter || selectedRequestTypeId) && <button type="button" onClick={() => { setSearchQuery(''); setPriorityFilter(''); setSlaFilter(''); setSelectedRequestTypeId(null); }} className="px-3 py-2 text-sm font-medium text-blue-700 hover:text-blue-900">Clear filters</button>}
        <span className="ml-auto text-xs text-gray-500" aria-live="polite">Showing {visibleTickets.length} of {tickets.length}</span>
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 w-fit mb-6">
        <button
          onClick={() => setActiveTab('mine')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'mine'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          My Queue
          {!loading && openTickets.length > 0 && (
            <span className="ml-2 bg-blue-100 text-blue-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
              {openTickets.length}
            </span>
          )}
        </button>
        {showUnassignedTab && (
          <button
            onClick={() => setActiveTab('unassigned')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'unassigned'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Unassigned
            {!loading && unassignedTickets.length > 0 && (
              <span className="ml-2 bg-orange-100 text-orange-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                {unassignedTickets.length}
              </span>
            )}
          </button>
        )}
        {showAllTab && (
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {allTabLabel}
            {!loading && allTickets.length > 0 && (
              <span className="ml-2 bg-purple-100 text-purple-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                {allTickets.length}
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => setActiveTab('resolved')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'resolved'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Resolved
          {!loading && resolvedTickets.length > 0 && (
            <span className="ml-2 bg-green-100 text-green-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
              {resolvedTickets.length}
            </span>
          )}
        </button>
      </div>

      {/* Export toolbar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportXlsx}
            disabled={exportingXlsx}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0052cc] text-white text-sm font-medium rounded-lg hover:bg-[#003d99] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-base">
              {exportingXlsx ? 'hourglass_top' : 'download'}
            </span>
            {exportingXlsx ? 'Exporting...' : `Export (${selectedIds.size})`}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-[#44546f] hover:text-[#0052cc] underline whitespace-nowrap"
          >
            Clear
          </button>
        </div>
      )}

      {/* Ticket Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto -mx-6 px-6">
          <table className="min-w-[800px] w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all visible tickets"
                    checked={visibleTickets.length > 0 && selectedIds.size === visibleTickets.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-[#0052cc] focus:ring-[#0052cc]"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-28">Ref</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Summary</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-36">Request Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-28">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-36">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-36">SLA</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-44">Requester</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <SkeletonRow key={i} cols={8} widths={['w-4', 'w-20', 'w-40', 'w-28', 'w-16', 'w-24', 'w-16', 'w-28']} />
              ))}
            </tbody>
          </table>
          </div>
        ) : visibleTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <span className="material-symbols-outlined text-5xl opacity-40">
              {selectedRequestTypeId ? 'filter_alt_off' : 'inbox'}
            </span>
            <p className="text-base font-semibold text-gray-500 dark:text-gray-400">
              {selectedRequestTypeId ? 'No tickets match this filter' : 'No tickets here'}
            </p>
            <p className="text-sm text-center max-w-xs">
              {selectedRequestTypeId
                ? 'Try clearing the request type filter to see all tickets.'
                : activeTab === 'mine'
                ? 'You have no active tickets assigned to you.'
                : activeTab === 'resolved'
                ? 'You have no resolved tickets yet.'
                : activeTab === 'all'
                ? 'No tickets found in your team queue.'
                : 'No unassigned tickets at the moment.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
          <table className="min-w-[800px] w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all visible tickets"
                    checked={visibleTickets.length > 0 && selectedIds.size === visibleTickets.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-[#0052cc] focus:ring-[#0052cc]"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-28">Ref</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Summary</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-36">Request Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-28">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-36">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-36">SLA</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-44">Requester</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleTickets.map(ticket => {
                const sla = getSlaDisplay(ticket.slaDeadline);
                const priorityCfg = PRIORITY_CONFIG[ticket.priority] ?? PRIORITY_CONFIG.MEDIUM;
                const statusCfg = STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG];
                const requesterName = ticket.requester
                  ? `${ticket.requester.firstName} ${ticket.requester.lastName}`
                  : '—';

                return (
                  <tr
                    key={ticket.id}
                    onClick={() => navigate(`/request/${ticket.reference || ticket.id}`)}
                    tabIndex={0}
                    role="link"
                    aria-label={`View request ${ticket.reference || ticket.id}`}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/request/${ticket.reference || ticket.id}`); } }}
                    className={`cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052cc] focus-visible:ring-inset ${sla.breached ? 'bg-red-50 hover:bg-red-100' : ''} ${selectedIds.has(ticket.id) ? 'bg-blue-50 hover:bg-blue-100' : ''}`}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${ticket.reference}`}
                        checked={selectedIds.has(ticket.id)}
                        onChange={() => toggleSelect(ticket.id)}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-[#0052cc] focus:ring-[#0052cc]"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400 font-medium">{ticket.reference}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100 max-w-xs truncate">{stripHtml(ticket.summary)}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{ticket.requestType?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${priorityCfg.bg} ${priorityCfg.color}`}>
                        {priorityCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {statusCfg ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                          {statusCfg.icon && (
                            <span className="material-symbols-outlined text-[11px] leading-none" aria-hidden="true">
                              {statusCfg.icon}
                            </span>
                          )}
                          {statusCfg.label}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">{ticket.status}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${sla.breached ? 'text-red-600' : sla.label === 'No SLA' ? 'text-gray-400' : 'text-green-600'}`}>
                        {sla.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 truncate max-w-[11rem]">{requesterName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
