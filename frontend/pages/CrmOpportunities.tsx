import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import crmService, { CrmOpportunity, CrmUser, Pagination } from '../src/services/crm.service';
import BulkActionBar, { BulkAction } from '../src/components/crm/BulkActionBar';
import { cleanFormPayload, NUMERIC_KEYS } from '../src/utils/crmFormHelper';
import { validateOpportunity, ValidationError } from '../src/utils/crmValidation';
import ConfirmDialog from '../src/components/ConfirmDialog';
import EmptyState from '../src/components/ui/EmptyState';
import CrmTableSkeleton from '../src/components/crm/CrmTableSkeleton';
import OpportunitiesTable, { SortConfig } from '../src/components/crm/OpportunitiesTable';
import { formatCurrency, formatDate } from '../src/components/crm/crmConstants';
import { hasPermission } from '../src/utils/permissions';
import { useAuth } from '../src/context/AuthContext';
import { useCrmUpdate } from '../src/hooks/useCrmUpdate';

const CrmOpportunities = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get('filter') || '';
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState<CrmOpportunity[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Partial<CrmOpportunity>>({});
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [pipelines, setPipelines] = useState<{ id: string; name: string; stages?: { id: string; name: string; probability: number; displayOrder?: number; color?: string; isWonStage?: boolean; isLostStage?: boolean }[] }[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<CrmOpportunity | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [deleteItem, setDeleteItem] = useState<CrmOpportunity | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formErrors, setFormErrors] = useState<ValidationError[]>([]);

  // ── Sort state (3-cycle: asc → desc → none) ─────────────────
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const handleSort = useCallback((field: SortConfig['field']) => {
    setSortConfig(prev => {
      if (!prev || prev.field !== field) return { field, direction: 'asc' };
      if (prev.direction === 'asc') return { field, direction: 'desc' };
      return null; // third click clears sort
    });
  }, []);

  // Sort opportunities client-side
  const sortedOpportunities = React.useMemo(() => {
    if (!sortConfig) return opportunities;
    const sorted = [...opportunities];
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortConfig.field) {
        case 'name': cmp = (a.name ?? '').localeCompare(b.name ?? ''); break;
        case 'stageId': cmp = (a.stage?.name ?? '').localeCompare(b.stage?.name ?? ''); break;
        case 'value': cmp = (a.value ?? 0) - (b.value ?? 0); break;
        case 'probability': cmp = (a.probability ?? 0) - (b.probability ?? 0); break;
        case 'expectedCloseDate':
          const da = a.expectedCloseDate ? new Date(a.expectedCloseDate).getTime() : 0;
          const db = b.expectedCloseDate ? new Date(b.expectedCloseDate).getTime() : 0;
          cmp = da - db; break;
        case 'createdAt':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
      }
      return cmp * dir;
    });
    return sorted;
  }, [opportunities, sortConfig]);

  // ── Inline stage change with optimistic update ──────────────
  const handleStageChange = useCallback(async (oppId: string, stageId: string, lostReason?: string) => {
    const prev = opportunities.find(o => o.id === oppId);
    if (!prev) return;
    // Find the stage object for optimistic update
    const stageObj = pipelines.flatMap(p => p.stages ?? []).find(s => s.id === stageId);
    // Optimistic update
    setOpportunities(opps => opps.map(o => o.id === oppId ? { ...o, stageId, stage: stageObj ? { ...stageObj, pipelineId: prev.pipelineId, opportunities: o.stage?.opportunities, _count: o.stage?._count } as any : o.stage } : o));
    try {
      await crmService.moveStage(oppId, stageId, lostReason);
      fetchOpportunities();
    } catch (e: any) {
      // Revert on failure
      setOpportunities(opps => opps.map(o => o.id === oppId ? prev : o));
      // Surface stage-gate rejection
      const gateMsg = e?.response?.data?.error as string | undefined;
      if (gateMsg) setBulkToast(gateMsg);
      else setBulkToast('Stage move failed');
      setTimeout(() => setBulkToast(null), 5000);
    }
  }, [opportunities, pipelines]);

  // ── Bulk Selection (Sprint 2) ──────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkToast, setBulkToast] = useState<string | null>(null);
  const [showBulkOwnerSelect, setShowBulkOwnerSelect] = useState(false);
  const [showBulkStageSelect, setShowBulkStageSelect] = useState(false);
  const [crmUsers, setCrmUsers] = useState<CrmUser[]>([]);
  const ownerIdParam = searchParams.get('ownerId') || '';

  useEffect(() => { crmService.listCrmUsers().then(setCrmUsers).catch(() => {}); }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(opportunities.map(o => o.id)));
  const clearSelection = () => setSelectedIds(new Set());

  // Fixed isAllSelected: every item must be selected, and there must be items
  const isAllSelected = opportunities.length > 0 && opportunities.every(o => selectedIds.has(o.id));

  const handleBulkAssignOwner = async (newOwnerId: string) => {
    setBulkProcessing(true);
    let count = 0;
    for (const id of selectedIds) {
      try { await crmService.updateOpportunity(id, { ownerId: newOwnerId }); count++; } catch {}
    }
    setSelectedIds(new Set());
    setShowBulkOwnerSelect(false);
    setBulkProcessing(false);
    setBulkToast(`Assigned ${count} deal${count > 1 ? 's' : ''} to new owner`);
    fetchOpportunities();
    setTimeout(() => setBulkToast(null), 3000);
  };

  const handleBulkChangeStage = async (stageId: string) => {
    setBulkProcessing(true);
    let count = 0;
    for (const id of selectedIds) {
      try { await crmService.moveStage(id, stageId); count++; } catch {}
    }
    setSelectedIds(new Set());
    setShowBulkStageSelect(false);
    setBulkProcessing(false);
    setBulkToast(`Changed stage of ${count} deal${count > 1 ? 's' : ''}`);
    fetchOpportunities();
    setTimeout(() => setBulkToast(null), 3000);
  };

  const handleBulkDelete = async () => {
    setBulkProcessing(true);
    let count = 0;
    for (const id of selectedIds) {
      try { await crmService.deleteOpportunity(id); count++; } catch {}
    }
    setSelectedIds(new Set());
    setBulkProcessing(false);
    setBulkToast(`Deleted ${count} deal${count > 1 ? 's' : ''}`);
    fetchOpportunities();
    setTimeout(() => setBulkToast(null), 3000);
  };

  const bulkActions: BulkAction[] = hasPermission(user, 'crm:admin') ? [
    { label: 'Assign Owner', icon: 'person_add', onClick: async () => { setShowBulkOwnerSelect(true); } },
    { label: 'Change Stage', icon: 'swap_horiz', onClick: async () => { setShowBulkStageSelect(true); } },
    { label: 'Delete', icon: 'delete', variant: 'danger', onClick: handleBulkDelete },
  ] : [];

  const fetchOpportunities = useCallback(async (page = 1) => {
    try { setLoading(true);
      const overdue = filterParam === 'overdue';
      const data = await crmService.listOpportunities({ page, limit: 20, search: search || undefined, pipelineId: (overdue ? '' : pipelineFilter) || undefined, stageId: (overdue ? '' : stageFilter) || undefined, overdue: overdue || undefined, ownerId: ownerIdParam || undefined });
      setOpportunities(data.opportunities); setPagination(data.pagination);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [search, pipelineFilter, stageFilter, filterParam, ownerIdParam]);

  const fetchAccounts = useCallback(async () => {
    try {
      const data = await crmService.listAccounts({ limit: 100 });
      setAccounts(data.accounts);
    } catch (e) { console.error(e); }
  }, []);

  const fetchPipelines = useCallback(async () => {
    try {
      const data = await crmService.listPipelines();
      setPipelines(data);
      if (data.length > 0 && !form.pipelineId) {
        setForm(prev => ({ ...prev, pipelineId: data[0].id, stageId: data[0].stages[0]?.id, probability: data[0].stages[0]?.probability ?? 0 }));
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchOpportunities(); fetchAccounts(); fetchPipelines(); }, [fetchOpportunities, fetchAccounts, fetchPipelines]);

  // Auto-refresh when another user creates/updates/deletes an opportunity
  useCrmUpdate(['opportunity'], () => {
    fetchOpportunities();
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateOpportunity(form);
    if (errors.length > 0) { setFormErrors(errors); return; }
    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(form)) {
      if (v === '' || v === undefined || v === null) continue;
      if (k === 'value' || k === 'probability') { payload[k] = Number(v); if (isNaN(payload[k])) delete payload[k]; }
      else payload[k] = v;
    }
    try { setSaving(true); await crmService.createOpportunity(payload); setShowCreate(false); setForm({}); fetchOpportunities(); }
    catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const openEdit = async (opp: CrmOpportunity) => {
    setFormErrors([]);
    setEditingItem(opp);
    setForm({
      name: opp.name ?? '',
      accountId: opp.accountId ?? '',
      pipelineId: opp.pipelineId ?? '',
      stageId: opp.stageId ?? '',
      value: opp.value ?? 0,
      probability: opp.probability ?? 0,
      expectedCloseDate: opp.expectedCloseDate ? opp.expectedCloseDate.split('T')[0] : '',
      description: opp.description ?? '',
    });
    setShowEdit(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const errors = validateOpportunity(form);
    if (errors.length > 0) { setFormErrors(errors); return; }
    try {
      setSaving(true);
      const payload = cleanFormPayload(form as Record<string, any>, NUMERIC_KEYS.opportunity);
      await crmService.updateOpportunity(editingItem.id, payload);
      setShowEdit(false); setEditingItem(null); setForm({});
      fetchOpportunities();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      setDeleting(true);
      await crmService.deleteOpportunity(deleteItem.id);
      setShowDelete(false);
      setDeleteItem(null);
      fetchOpportunities();
    } catch (e) { console.error(e); } finally { setDeleting(false); }
  };

  return (
    <>
      <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: selectedIds.size > 0 ? '80px' : 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
            <Link to="/crm" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700 transition-colors">CRM</Link>
            <span>/</span><span className="font-semibold text-text-primary">Opportunities</span>
          </div>
          <h1 className="text-2xl font-black text-text-primary">
            Opportunities
            {ownerIdParam && (
              <span className="ml-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700">
                <span className="material-symbols-outlined" style={{fontSize:12}}>person</span>
                {crmUsers.find(u => u.id === ownerIdParam)?.firstName ?? 'Owner'}&apos;s deals
                <button onClick={() => { searchParams.delete('ownerId'); setSearchParams(searchParams); }} className="ml-0.5 hover:text-brand-900" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>✕</button>
              </span>
            )}
          </h1>
        </div>
        <button onClick={() => { setFormErrors([]); setShowCreate(true); }} className="flex items-center gap-2 bg-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          <span className="material-symbols-outlined text-lg">add</span> New Opportunity
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-lg">search</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search opportunities..."
            className="w-full pl-10 pr-4 py-2 bg-surface-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
        </div>
        {pipelines.length > 1 && (
          <select value={pipelineFilter} onChange={e => { setPipelineFilter(e.target.value); setStageFilter(''); }}
            className="px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary outline-none cursor-pointer" style={{ fontFamily: 'var(--font-sans)' }}>
            <option value="">All Pipelines</option>
            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
          className="px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary outline-none cursor-pointer" style={{ fontFamily: 'var(--font-sans)' }}>
          <option value="">All Stages</option>
          {(pipelineFilter ? pipelines.filter(p => p.id === pipelineFilter) : pipelines).flatMap(p =>
            (p.stages || []).map(s => ({ id: s.id, name: s.name, pipelineName: p.name }))
          ).map(s => (
            <option key={s.id} value={s.id}>{pipelines.length > 1 && !pipelineFilter ? s.pipelineName + ' \u2013 ' + s.name : s.name}</option>
          ))}
        </select>
      </div>

      {/* Overdue filter badge */}
      {filterParam && (
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold" style={{
            background: filterParam === 'overdue' ? 'rgba(220,38,38,0.06)' : 'var(--color-surface-muted)',
            color: filterParam === 'overdue' ? 'var(--color-danger)' : 'var(--color-text-secondary)',
          }}>
            <span className="material-symbols-outlined text-sm">{filterParam === 'overdue' ? 'notifications_active' : 'filter_list'}</span>
            {filterParam === 'overdue' ? 'Overdue Deals (past expected close date)' : `Filtered: ${filterParam}`}
          </span>
          <button onClick={() => { searchParams.delete('filter'); setSearchParams(searchParams); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }} className="text-sm hover:text-text-primary">
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {/* Opportunities Table (extracted component) */}
      {loading ? (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <CrmTableSkeleton rows={6} cols={10} />
        </div>
      ) : (
        <OpportunitiesTable
          opportunities={sortedOpportunities}
          pipelines={pipelines}
          sortConfig={sortConfig}
          onSort={handleSort}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          onEdit={openEdit}
          onDelete={(opp) => { setDeleteItem(opp); setShowDelete(true); }}
          onStageChange={handleStageChange}
          isAllSelected={isAllSelected}
          user={user}
        />
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center mt-6 gap-1">
          {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => fetchOpportunities(p)} style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${p === pagination.page ? 'bg-brand-700 text-white' : 'bg-transparent text-text-secondary hover:bg-surface-muted'}`}>{p}</button>
          ))}
        </div>
      )}

      {/* Bulk Action Bar (Sprint 2) */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={opportunities.length}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        actions={bulkActions}
        loading={bulkProcessing}
      />

      {/* Bulk owner select dropdown */}
      {showBulkOwnerSelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowBulkOwnerSelect(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-4">Assign Owner</h3>
            <select
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              defaultValue=""
              onChange={(e) => { if (e.target.value) handleBulkAssignOwner(e.target.value); }}
            >
              <option value="" disabled>Select new owner</option>
              {crmUsers.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
            </select>
            <button onClick={() => setShowBulkOwnerSelect(false)} className="mt-4 w-full px-4 py-2 text-sm text-text-secondary hover:text-text-primary" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Bulk stage select dropdown */}
      {showBulkStageSelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowBulkStageSelect(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-4">Change Stage</h3>
            <select
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              defaultValue=""
              onChange={(e) => { if (e.target.value) handleBulkChangeStage(e.target.value); }}
            >
              <option value="" disabled>Select new stage</option>
              {pipelines.map(p => (p.stages ?? []).map(s => <option key={s.id} value={s.id}>{s.name} ({p.name})</option>))}
            </select>
            <button onClick={() => setShowBulkStageSelect(false)} className="mt-4 w-full px-4 py-2 text-sm text-text-secondary hover:text-text-primary" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Bulk toast */}
      {bulkToast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg bg-success/10 border border-success text-success text-sm font-semibold flex items-center gap-2 shadow-lg">
          <span className="material-symbols-outlined text-base">check_circle</span>
          {bulkToast}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setFormErrors([]); setShowCreate(false); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-extrabold text-text-primary">New Opportunity</h2>
              <button onClick={() => { setFormErrors([]); setShowCreate(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><span className="material-symbols-outlined text-text-secondary">close</span></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Opportunity Name *</label>
                <input value={form.name || ''} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} required
                  className={`w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all${formErrors.some(e => e.field === 'name') ? ' !border-red-500 focus:!ring-red-200' : ''}`} />
                {formErrors.some(e => e.field === 'name') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'name')?.message}</p>)}
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Account *</label>
                <select value={form.accountId || ''} onChange={e => setForm(prev => ({ ...prev, accountId: e.target.value }))} required
                  className={`w-full px-4 py-2 border border-border rounded-lg text-sm outline-none${formErrors.some(e => e.field === 'accountId') ? ' !border-red-500 focus:!ring-red-200' : ''}`} style={{ fontFamily: 'var(--font-sans)' }}>
                  <option value="">Select Account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                {formErrors.some(e => e.field === 'accountId') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'accountId')?.message}</p>)}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Pipeline *</label>
                  <select value={form.pipelineId || ''} onChange={e => { const p = pipelines.find(x => x.id === e.target.value); const firstStage = p?.stages?.[0]; setForm(prev => ({ ...prev, pipelineId: e.target.value, stageId: firstStage?.id, probability: firstStage?.probability ?? 0 })); }} required
                    className={`w-full px-4 py-2 border border-border rounded-lg text-sm outline-none${formErrors.some(e => e.field === 'pipelineId') ? ' !border-red-500 focus:!ring-red-200' : ''}`} style={{ fontFamily: 'var(--font-sans)' }}>
                    <option value="">Select Pipeline</option>
                    {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {formErrors.some(e => e.field === 'pipelineId') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'pipelineId')?.message}</p>)}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Stage *</label>
                  <select value={form.stageId || ''} onChange={e => { const selP = pipelines.find(p => p.id === form.pipelineId); const selS = selP?.stages?.find(s => s.id === e.target.value); setForm(prev => ({ ...prev, stageId: e.target.value, probability: selS?.probability ?? prev.probability ?? 0 })); }} required
                    className={`w-full px-4 py-2 border border-border rounded-lg text-sm outline-none${formErrors.some(e => e.field === 'stageId') ? ' !border-red-500 focus:!ring-red-200' : ''}`} style={{ fontFamily: 'var(--font-sans)' }}>
                    <option value="">Select Stage</option>
                    {pipelines.find(p => p.id === form.pipelineId)?.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {formErrors.some(e => e.field === 'stageId') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'stageId')?.message}</p>)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Value (MYR)</label>
                  <input type="number" value={form.value || ''} onChange={e => setForm(prev => ({ ...prev, value: Number(e.target.value) }))}
                    className={`w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all${formErrors.some(e => e.field === 'value') ? ' !border-red-500 focus:!ring-red-200' : ''}`} />
                  {formErrors.some(e => e.field === 'value') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'value')?.message}</p>)}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Probability (%)</label>
                  <input type="number" min={0} max={100} value={form.probability || 0} onChange={e => setForm(prev => ({ ...prev, probability: Number(e.target.value) }))}
                    className={`w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all${formErrors.some(e => e.field === 'probability') ? ' !border-red-500 focus:!ring-red-200' : ''}`} />
                  {formErrors.some(e => e.field === 'probability') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'probability')?.message}</p>)}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Expected Close Date</label>
                <input type="date" value={form.expectedCloseDate || ''} onChange={e => setForm(prev => ({ ...prev, expectedCloseDate: e.target.value }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Description</label>
                <textarea value={form.description || ''} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={3}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setFormErrors([]); setShowCreate(false); }} className="px-5 py-2 rounded-lg text-sm font-bold text-text-secondary hover:bg-surface-muted" style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 disabled:opacity-50" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Creating...' : 'Create Opportunity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEdit && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setFormErrors([]); setShowEdit(false); setEditingItem(null); setForm({}); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-extrabold text-text-primary">Edit Opportunity</h2>
              <button onClick={() => { setFormErrors([]); setShowEdit(false); setEditingItem(null); setForm({}); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><span className="material-symbols-outlined text-text-secondary">close</span></button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Opportunity Name *</label>
                <input value={form.name || ''} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} required
                  className={`w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all${formErrors.some(e => e.field === 'name') ? ' !border-red-500 focus:!ring-red-200' : ''}`} />
                {formErrors.some(e => e.field === 'name') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'name')?.message}</p>)}
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Account *</label>
                <select value={form.accountId || ''} onChange={e => setForm(prev => ({ ...prev, accountId: e.target.value }))} required
                  className={`w-full px-4 py-2 border border-border rounded-lg text-sm outline-none${formErrors.some(e => e.field === 'accountId') ? ' !border-red-500 focus:!ring-red-200' : ''}`} style={{ fontFamily: 'var(--font-sans)' }}>
                  <option value="">Select Account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                {formErrors.some(e => e.field === 'accountId') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'accountId')?.message}</p>)}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Pipeline *</label>
                  <select value={form.pipelineId || ''} onChange={e => { const p = pipelines.find(x => x.id === e.target.value); const firstStage = p?.stages?.[0]; setForm(prev => ({ ...prev, pipelineId: e.target.value, stageId: firstStage?.id, probability: firstStage?.probability ?? 0 })); }} required
                    className={`w-full px-4 py-2 border border-border rounded-lg text-sm outline-none${formErrors.some(e => e.field === 'pipelineId') ? ' !border-red-500 focus:!ring-red-200' : ''}`} style={{ fontFamily: 'var(--font-sans)' }}>
                    <option value="">Select Pipeline</option>
                    {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {formErrors.some(e => e.field === 'pipelineId') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'pipelineId')?.message}</p>)}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Stage *</label>
                  <select value={form.stageId || ''} onChange={e => { const selP = pipelines.find(p => p.id === form.pipelineId); const selS = selP?.stages?.find(s => s.id === e.target.value); setForm(prev => ({ ...prev, stageId: e.target.value, probability: selS?.probability ?? prev.probability ?? 0 })); }} required
                    className={`w-full px-4 py-2 border border-border rounded-lg text-sm outline-none${formErrors.some(e => e.field === 'stageId') ? ' !border-red-500 focus:!ring-red-200' : ''}`} style={{ fontFamily: 'var(--font-sans)' }}>
                    <option value="">Select Stage</option>
                    {pipelines.find(p => p.id === form.pipelineId)?.stages?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {formErrors.some(e => e.field === 'stageId') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'stageId')?.message}</p>)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Value (MYR)</label>
                  <input type="number" value={form.value || ''} onChange={e => setForm(prev => ({ ...prev, value: Number(e.target.value) }))}
                    className={`w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all${formErrors.some(e => e.field === 'value') ? ' !border-red-500 focus:!ring-red-200' : ''}`} />
                  {formErrors.some(e => e.field === 'value') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'value')?.message}</p>)}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Probability (%)</label>
                  <input type="number" min={0} max={100} value={form.probability ?? 0} onChange={e => setForm(prev => ({ ...prev, probability: Number(e.target.value) }))}
                    className={`w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all${formErrors.some(e => e.field === 'probability') ? ' !border-red-500 focus:!ring-red-200' : ''}`} />
                  {formErrors.some(e => e.field === 'probability') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'probability')?.message}</p>)}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Expected Close Date</label>
                <input type="date" value={form.expectedCloseDate || ''} onChange={e => setForm(prev => ({ ...prev, expectedCloseDate: e.target.value }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Description</label>
                <textarea value={form.description || ''} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={3}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setFormErrors([]); setShowEdit(false); setEditingItem(null); setForm({}); }} className="px-5 py-2 rounded-lg text-sm font-bold text-text-secondary hover:bg-surface-muted" style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 disabled:opacity-50" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>

      <ConfirmDialog
        open={showDelete}
        title="Delete Opportunity"
        message={`Are you sure you want to delete "${deleteItem?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => { setShowDelete(false); setDeleteItem(null); }}
        loading={deleting}
      />
    </>
  );
};

export default CrmOpportunities;