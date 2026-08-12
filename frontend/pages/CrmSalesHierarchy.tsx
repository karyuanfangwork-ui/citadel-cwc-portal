import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import crmService, { SalesHierarchy, SalesHierarchyManager, SalesHierarchyUser } from '../src/services/crm.service';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';

const T = {
  teal: '#006a61',
  tealSoft: '#e8f7f4',
  surface: '#f8f9ff',
  border: '#e2e8f0',
  text: '#0b1c30',
  muted: '#64748b',
  danger: '#b42318',
  dangerSoft: '#fff1f0',
};

type FilterState = {
  search: string;
  status: 'ALL' | 'ACTIVE' | 'INACTIVE';
  assignment: 'ALL' | 'ASSIGNED' | 'UNASSIGNED' | 'INVALID';
  managerId: string;
  territory: string;
  sort: 'name' | 'leads' | 'opportunities';
};

const emptyFilters: FilterState = {
  search: '', status: 'ALL', assignment: 'ALL', managerId: '', territory: '', sort: 'name',
};

function nameOf(user: SalesHierarchyUser): string {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
}

function matchesUser(user: SalesHierarchyUser, filters: FilterState): boolean {
  const search = filters.search.trim().toLowerCase();
  const searchMatch = !search || `${nameOf(user)} ${user.email}`.toLowerCase().includes(search);
  const statusMatch = filters.status === 'ALL' || (filters.status === 'ACTIVE' ? user.isActive : !user.isActive);
  const territoryMatch = !filters.territory || user.territories.some((territory) => territory.name === filters.territory);
  return searchMatch && statusMatch && territoryMatch;
}

function sortUsers(users: SalesHierarchyUser[], sort: FilterState['sort']): SalesHierarchyUser[] {
  return [...users].sort((a, b) => {
    if (sort === 'leads') return b.leadCount - a.leadCount || nameOf(a).localeCompare(nameOf(b));
    if (sort === 'opportunities') return b.opportunityCount - a.opportunityCount || nameOf(a).localeCompare(nameOf(b));
    return nameOf(a).localeCompare(nameOf(b));
  });
}

const StatusPill: React.FC<{ isActive: boolean }> = ({ isActive }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
    {isActive ? 'Active' : 'Inactive'}
  </span>
);

const Metric: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-xl border bg-white px-4 py-3" style={{ borderColor: T.border }}>
    <div className="text-2xl font-bold" style={{ color: T.text }}>{value}</div>
    <div className="mt-1 text-xs font-semibold uppercase tracking-wide" style={{ color: T.muted }}>{label}</div>
  </div>
);

const UserStats: React.FC<{ user: SalesHierarchyUser }> = ({ user }) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: T.muted }}>
    <span>{user.leadCount} leads</span>
    <span>{user.opportunityCount} opportunities</span>
    {user.territories.length > 0 && <span>{user.territories.map((territory) => territory.name).join(', ')}</span>}
  </div>
);

const UserIdentity: React.FC<{ user: SalesHierarchyUser; roleLabel: string }> = ({ user, roleLabel }) => (
  <div className="min-w-0">
    <div className="flex flex-wrap items-center gap-2">
      <span className="truncate font-semibold" style={{ color: T.text }}>{nameOf(user)}</span>
      <StatusPill isActive={user.isActive} />
      <span className="text-[11px] font-medium" style={{ color: T.muted }}>{roleLabel}</span>
    </div>
    <div className="truncate text-xs" style={{ color: T.muted }}>{user.email}</div>
    <UserStats user={user} />
  </div>
);

const CrmSalesHierarchy: React.FC = () => {
  const { user } = useAuth();
  const canManageHierarchy = hasPermission(user, 'crm:admin');
  const [hierarchy, setHierarchy] = useState<SalesHierarchy | null>(null);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedRep, setSelectedRep] = useState<SalesHierarchyUser | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (!canManageHierarchy) return;
    setError('');
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const result = await crmService.getSalesHierarchy();
      setHierarchy(result);
      setExpanded(new Set(result.managers.map((manager) => manager.id)));
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Unable to load the sales hierarchy.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canManageHierarchy]);

  useEffect(() => { void load(); }, [load]);

  const territories = useMemo(() => {
    if (!hierarchy) return [];
    const allUsers = hierarchy.managers.flatMap((manager) => [manager, ...manager.directReports])
      .concat(hierarchy.unassignedReps, hierarchy.invalidAssignments.map((item) => item.representative));
    return [...new Set(allUsers.flatMap((item) => item.territories.map((territory) => territory.name)))].sort();
  }, [hierarchy]);

  const visibleManagers = useMemo(() => {
    if (!hierarchy) return [];
    return hierarchy.managers.map((manager) => {
      const managerMatches = matchesUser(manager, filters) && (!filters.managerId || manager.id === filters.managerId);
      const reps = sortUsers(manager.directReports.filter((rep) => {
        if (filters.assignment === 'UNASSIGNED' || filters.assignment === 'INVALID') return false;
        if (filters.managerId && filters.managerId !== manager.id) return false;
        return matchesUser(rep, filters);
      }), filters.sort);
      return managerMatches || reps.length > 0 ? { manager, reps } : null;
    }).filter((item): item is { manager: SalesHierarchyManager; reps: SalesHierarchyUser[] } => item !== null);
  }, [filters, hierarchy]);

  const visibleUnassigned = useMemo(() => {
    if (!hierarchy || (filters.assignment !== 'ALL' && filters.assignment !== 'UNASSIGNED')) return [];
    return sortUsers(hierarchy.unassignedReps.filter((rep) => matchesUser(rep, filters)), filters.sort);
  }, [filters, hierarchy]);

  const visibleInvalid = useMemo(() => {
    if (!hierarchy || (filters.assignment !== 'ALL' && filters.assignment !== 'INVALID')) return [];
    return hierarchy.invalidAssignments
      .filter((item) => matchesUser(item.representative, filters))
      .filter((item) => !filters.managerId || item.managerId === filters.managerId)
      .sort((a, b) => nameOf(a.representative).localeCompare(nameOf(b.representative)));
  }, [filters, hierarchy]);

  if (!canManageHierarchy) return <Navigate to="/crm" replace />;

  const openReassign = (rep: SalesHierarchyUser) => {
    setSelectedRep(rep);
    setSelectedManagerId(rep.managerId ?? '');
    setSaveError('');
  };

  const saveReassignment = async () => {
    if (!selectedRep) return;
    setSaving(true);
    setSaveError('');
    try {
      await crmService.updateSalesRepManager(selectedRep.id, selectedManagerId || null);
      setSelectedRep(null);
      await load(true);
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || err?.message || 'Unable to update the manager assignment.');
    } finally {
      setSaving(false);
    }
  };

  const setFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => setFilters((current) => ({ ...current, [key]: value }));
  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="min-h-full p-4 sm:p-6" style={{ background: T.surface }} data-testid="sales-hierarchy-page">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: T.teal }}>CRM Administration</div>
            <h1 className="text-2xl font-bold" style={{ color: T.text }}>Sales Hierarchy</h1>
            <p className="mt-1 max-w-2xl text-sm" style={{ color: T.muted }}>Maintain reporting relationships without changing lead or opportunity ownership.</p>
          </div>
          <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ borderColor: T.border, color: T.text }}>
            <span className="material-symbols-outlined text-base">refresh</span>{refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {error && <div role="alert" className="mb-5 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: '#f4b8b4', background: T.dangerSoft, color: T.danger }}>{error}</div>}
        {loading && <div className="rounded-xl border bg-white p-10 text-center text-sm" style={{ borderColor: T.border, color: T.muted }}>Loading sales hierarchy…</div>}

        {!loading && hierarchy && <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5" data-testid="sales-hierarchy-summary">
            <Metric label="Sales managers" value={hierarchy.summary.managerCount} />
            <Metric label="Sales reps" value={hierarchy.summary.salesRepCount} />
            <Metric label="Assigned reps" value={hierarchy.summary.assignedRepCount} />
            <Metric label="Unassigned reps" value={hierarchy.summary.unassignedRepCount} />
            <Metric label="Invalid assignments" value={hierarchy.summary.invalidAssignmentCount} />
          </div>

          <div className="mb-6 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-2 xl:grid-cols-6" style={{ borderColor: T.border }}>
            <input type="search" aria-label="Search managers or representatives" placeholder="Search name or email" value={filters.search} onChange={(event) => setFilter('search', event.target.value)} className="rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: T.border }} />
            <select aria-label="Status filter" value={filters.status} onChange={(event) => setFilter('status', event.target.value as FilterState['status'])} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: T.border }}><option value="ALL">All statuses</option><option value="ACTIVE">Active only</option><option value="INACTIVE">Inactive only</option></select>
            <select aria-label="Assignment filter" value={filters.assignment} onChange={(event) => setFilter('assignment', event.target.value as FilterState['assignment'])} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: T.border }}><option value="ALL">All assignments</option><option value="ASSIGNED">Assigned only</option><option value="UNASSIGNED">Unassigned only</option><option value="INVALID">Invalid only</option></select>
            <select aria-label="Manager filter" value={filters.managerId} onChange={(event) => setFilter('managerId', event.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: T.border }}><option value="">All managers</option>{hierarchy.managers.map((manager) => <option key={manager.id} value={manager.id}>{nameOf(manager)}</option>)}</select>
            <select aria-label="Territory filter" value={filters.territory} onChange={(event) => setFilter('territory', event.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: T.border }}><option value="">All territories</option>{territories.map((territory) => <option key={territory} value={territory}>{territory}</option>)}</select>
            <select aria-label="Sort hierarchy" value={filters.sort} onChange={(event) => setFilter('sort', event.target.value as FilterState['sort'])} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: T.border }}><option value="name">Sort by name</option><option value="leads">Sort by leads</option><option value="opportunities">Sort by opportunities</option></select>
            <div className="flex gap-2 md:col-span-2 xl:col-span-6"><button type="button" onClick={() => setExpanded(new Set(hierarchy.managers.map((manager) => manager.id)))} className="text-xs font-semibold" style={{ color: T.teal }}>Expand all</button><button type="button" onClick={() => setExpanded(new Set())} className="text-xs font-semibold" style={{ color: T.muted }}>Collapse all</button></div>
          </div>

          <div className="space-y-4">
            {visibleManagers.map(({ manager, reps }) => <section key={manager.id} className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: T.border }}>
              <div className="flex items-center justify-between gap-3 border-b px-4 py-4" style={{ borderColor: T.border }}>
                <button type="button" onClick={() => toggle(manager.id)} aria-label={`${expanded.has(manager.id) ? 'Collapse' : 'Expand'} ${nameOf(manager)}`} className="flex min-w-0 flex-1 items-start gap-3 text-left"><span className="material-symbols-outlined mt-0.5" style={{ color: T.teal }}>{expanded.has(manager.id) ? 'expand_more' : 'chevron_right'}</span><UserIdentity user={manager} roleLabel="Sales manager" /></button>
                <div className="hidden text-right text-xs sm:block" style={{ color: T.muted }}><div>{manager.directReports.length} direct reports</div><div>{manager.indirectReportCount} indirect reports</div></div>
              </div>
              {expanded.has(manager.id) && <div className="divide-y" style={{ borderColor: T.border }}>{reps.map((rep) => <div key={rep.id} className="flex items-center gap-3 px-4 py-3 pl-12"><div className="min-w-0 flex-1"><UserIdentity user={rep} roleLabel="Sales representative" /></div><button type="button" onClick={() => openReassign(rep)} className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold" style={{ borderColor: T.border, color: T.teal }}>Change manager</button></div>)}{reps.length === 0 && <div className="px-12 py-4 text-sm" style={{ color: T.muted }}>No representatives match the current filters.</div>}</div>}
            </section>)}

            {(visibleUnassigned.length > 0 || filters.assignment === 'UNASSIGNED') && <section className="overflow-hidden rounded-xl border" style={{ borderColor: '#f5c26b', background: '#fffaf0' }}><div className="border-b px-4 py-4" style={{ borderColor: '#f5c26b' }}><h2 className="font-bold" style={{ color: T.text }}>Unassigned sales representatives</h2><p className="mt-1 text-xs" style={{ color: T.muted }}>These users have no managerId and remain visible for cleanup.</p></div>{visibleUnassigned.map((rep) => <div key={rep.id} className="flex items-center gap-3 border-b px-4 py-3 pl-6 last:border-b-0" style={{ borderColor: '#f5c26b' }}><div className="min-w-0 flex-1"><UserIdentity user={rep} roleLabel="Sales representative" /></div><button type="button" onClick={() => openReassign(rep)} className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold" style={{ borderColor: T.border, color: T.teal }}>Assign manager</button></div>)}{visibleUnassigned.length === 0 && <div className="px-6 py-4 text-sm" style={{ color: T.muted }}>No unassigned representatives match the current filters.</div>}</section>}

            {(visibleInvalid.length > 0 || filters.assignment === 'INVALID') && <section className="overflow-hidden rounded-xl border" style={{ borderColor: '#f4b8b4', background: T.dangerSoft }}><div className="border-b px-4 py-4" style={{ borderColor: '#f4b8b4' }}><h2 className="font-bold" style={{ color: T.danger }}>Invalid manager assignments</h2><p className="mt-1 text-xs" style={{ color: T.muted }}>These relationships are not included in the hierarchy until corrected.</p></div>{visibleInvalid.map((item) => <div key={item.representative.id} className="flex items-center gap-3 border-b px-4 py-3 pl-6 last:border-b-0" style={{ borderColor: '#f4b8b4' }}><div className="min-w-0 flex-1"><UserIdentity user={item.representative} roleLabel={item.reasonLabel} /></div><button type="button" onClick={() => openReassign(item.representative)} className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold" style={{ borderColor: T.border, color: T.teal }}>Fix assignment</button></div>)}{visibleInvalid.length === 0 && <div className="px-6 py-4 text-sm" style={{ color: T.muted }}>No invalid assignments match the current filters.</div>}</section>}

            {visibleManagers.length === 0 && visibleUnassigned.length === 0 && visibleInvalid.length === 0 && <div className="rounded-xl border bg-white p-10 text-center text-sm" style={{ borderColor: T.border, color: T.muted }}>No hierarchy entries match the current filters.</div>}
          </div>
        </>}
      </div>

      {selectedRep && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="reassign-title"><div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"><h2 id="reassign-title" className="text-lg font-bold" style={{ color: T.text }}>Change manager</h2><p className="mt-2 text-sm" style={{ color: T.muted }}>Update reporting visibility and notifications for {nameOf(selectedRep)}. This does not transfer lead or opportunity ownership.</p><label className="mt-5 block text-sm font-semibold" style={{ color: T.text }}>Manager<select aria-label="New manager" value={selectedManagerId} onChange={(event) => setSelectedManagerId(event.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: T.border }}><option value="">No manager assigned</option>{hierarchy?.managerOptions.filter((manager) => manager.id !== selectedRep.id).map((manager) => <option key={manager.id} value={manager.id}>{nameOf(manager)} — {manager.email}</option>)}</select></label>{saveError && <div role="alert" className="mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: T.dangerSoft, color: T.danger }}>{saveError}</div>}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setSelectedRep(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold" style={{ borderColor: T.border, color: T.muted }}>Cancel</button><button type="button" onClick={() => void saveReassignment()} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: T.teal }}>{saving ? 'Saving…' : 'Save assignment'}</button></div></div></div>}
    </div>
  );
};

export default CrmSalesHierarchy;
