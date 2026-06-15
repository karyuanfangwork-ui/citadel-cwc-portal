import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import crmService, { CrmOpportunity, CrmUser, Pagination } from '../src/services/crm.service';
import BulkActionBar, { BulkAction } from '../src/components/crm/BulkActionBar';
import { cleanFormPayload, NUMERIC_KEYS } from '../src/utils/crmFormHelper';
import { validateOpportunity, ValidationError } from '../src/utils/crmValidation';
import ConfirmDialog from '../src/components/ConfirmDialog';
import EmptyState from '../src/components/ui/EmptyState';
import CrmTableSkeleton from '../src/components/crm/CrmTableSkeleton';
import OpportunitiesTable, { SortConfig } from '../src/components/crm/OpportunitiesTable';
import { formatCurrency, formatDate, isOverdue } from '../src/components/crm/crmConstants';
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
  const [ownerFilter, setOwnerFilter] = useState('');
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

  // ── Stats bar computed values ──────────────────────────────
  const activeOpportunities = useMemo(() =>
    opportunities.filter(o => !o.stage?.isWonStage && !o.stage?.isLostStage), [opportunities]);
  const avgDealSize = activeOpportunities.length > 0
    ? activeOpportunities.reduce((sum, o) => sum + Math.min(o.value ?? 0, 1e12), 0) / activeOpportunities.length
    : 0;
  const totalPipelineValue = useMemo(() =>
    activeOpportunities.reduce((sum, o) => sum + Math.min(o.value ?? 0, 1e12), 0), [activeOpportunities]);
  const weightedForecast = useMemo(() =>
    activeOpportunities.reduce((sum, o) => sum + Math.min(o.value ?? 0, 1e12) * (o.probability ?? 0) / 100, 0), [activeOpportunities]);
  const compactFmt = useMemo(() =>
    new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', notation: 'compact', maximumFractionDigits: 1 }),
  []);
  const formatCompact = (val: number) => {
    if (!Number.isFinite(val) || val === 0) return 'RM 0';
    return compactFmt.format(val);
  };
  const wonCount = opportunities.filter(o => o.stage?.isWonStage).length;
  const winRate = opportunities.length > 0 ? Math.round((wonCount / opportunities.length) * 100) : 0;
  const overdueCount = opportunities.filter(o => o.expectedCloseDate && isOverdue(o.expectedCloseDate) && !o.stage?.isWonStage && !o.stage?.isLostStage).length;

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

  // Sync owner filter from URL param on mount
  useEffect(() => { if (ownerIdParam) setOwnerFilter(ownerIdParam); }, [ownerIdParam]);

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
  }, [search, pipelineFilter, stageFilter, filterParam, ownerIdParam, ownerFilter]);

  // Also filter client-side by ownerFilter (for the local dropdown)
  const filteredOpportunities = useMemo(() => {
    if (!ownerFilter) return sortedOpportunities;
    return sortedOpportunities.filter(o => o.ownerId === ownerFilter);
  }, [sortedOpportunities, ownerFilter]);

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
      ownerId: opp.ownerId ?? '',
      forecastCategory: opp.forecastCategory ?? 'PIPELINE',
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
          <div className="flex items-center gap-2 text-sm text-[#76777d] mb-1">
            <Link to="/crm" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-[#006a61] transition-colors">CRM</Link>
            <span>/</span><span className="font-semibold text-[#0b1c30]">Opportunities</span>
          </div>
          <h1 className="text-[24px] font-semibold text-[#0b1c30]" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.01em' }}>
            Opportunity Pipeline
            {ownerIdParam && (
              <span className="ml-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#e0f2f1] text-[#006a61]">
                <span className="material-symbols-outlined" style={{fontSize:12}}>person</span>
                {crmUsers.find(u => u.id === ownerIdParam)?.firstName ?? 'Owner'}&apos;s deals
                <button onClick={() => { searchParams.delete('ownerId'); setSearchParams(searchParams); }} className="ml-0.5 hover:text-[#006a61]" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>✕</button>
              </span>
            )}
          </h1>
          <p className="text-[13px] text-[#45464d] mt-0.5">Active lending deals across all commercial segments.</p>
        </div>
        <button onClick={() => { setFormErrors([]); setShowCreate(true); }} className="flex items-center gap-2 bg-[#006a61] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 shadow-sm transition-all" style={{ border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          <span className="material-symbols-outlined text-lg">add</span> Create Opportunity
        </button>
      </div>

      {/* Statistics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#c6c6cd] p-4 rounded-xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1">Total Pipeline (MYR)</p>
          <h3 className="text-[24px] font-semibold text-[#0b1c30]" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.01em' }}>{formatCompact(totalPipelineValue)}</h3>
          <div className="flex items-center gap-1 mt-2 text-[#006a61]">
            <span className="material-symbols-outlined text-sm">trending_up</span>
            <span className="text-[11px] font-bold">{opportunities.length} active deals</span>
          </div>
        </div>
        <div className="bg-white border border-[#c6c6cd] p-4 rounded-xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1">Weighted Forecast</p>
          <h3 className="text-[24px] font-semibold text-[#0b1c30]" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.01em' }}>{formatCompact(weightedForecast)}</h3>
          <div className="flex items-center gap-1 mt-2 text-[#45464d]">
            <span className="material-symbols-outlined text-sm">info</span>
            <span className="text-[11px]">Based on stage probability</span>
          </div>
        </div>
        <div className="bg-white border border-[#c6c6cd] p-4 rounded-xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1">Avg. Deal Size</p>
          <h3 className="text-[24px] font-semibold text-[#0b1c30]" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.01em' }}>{formatCompact(avgDealSize)}</h3>
          <div className="flex items-center gap-1 mt-2 text-[#006a61]">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            <span className="text-[11px] font-bold">Per opportunity</span>
          </div>
        </div>
        <div className="bg-white border border-[#c6c6cd] p-4 rounded-xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1">Win Rate</p>
          <h3 className="text-[24px] font-semibold text-[#0b1c30]" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.01em' }}>{winRate}%</h3>
          <div className={`flex items-center gap-1 mt-2 ${overdueCount > 0 ? 'text-[#ba1a1a]' : 'text-[#006a61]'}`}>
            <span className="material-symbols-outlined text-sm">{overdueCount > 0 ? 'warning' : 'trending_up'}</span>
            <span className="text-[11px] font-bold">{overdueCount > 0 ? `${overdueCount} overdue` : `${wonCount} won deals`}</span>
          </div>
        </div>
      </div>

      {/* Table Controls — Consolidated Card */}
      <div className="bg-white border border-[#c6c6cd] rounded-xl overflow-hidden shadow-sm flex flex-col mb-5">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-[#c6c6cd] flex justify-between items-center bg-white">
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#45464d] text-sm">search</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter opportunities..."
                className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg pl-10 pr-4 py-2 text-[13px] outline-none focus:border-[#006a61] focus:ring-0" />
            </div>
            {pipelines.length > 1 && (
              <select value={pipelineFilter} onChange={e => { setPipelineFilter(e.target.value); setStageFilter(''); }}
                className="px-3 py-2 border border-[#c6c6cd] rounded-lg text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] outline-none cursor-pointer transition-all focus:border-[#006a61]" style={{ fontFamily: 'Inter, sans-serif' }}>
                <option value="">All Pipelines</option>
                {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
              className="px-3 py-2 border border-[#c6c6cd] rounded-lg text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] outline-none cursor-pointer transition-all focus:border-[#006a61]" style={{ fontFamily: 'Inter, sans-serif' }}>
              <option value="">All Stages</option>
              {(pipelineFilter ? pipelines.filter(p => p.id === pipelineFilter) : pipelines).flatMap(p =>
                (p.stages || []).map(s => ({ id: s.id, name: s.name, pipelineName: p.name }))
              ).map(s => (
                <option key={s.id} value={s.id}>{pipelines.length > 1 && !pipelineFilter ? s.pipelineName + ' \u2013 ' + s.name : s.name}</option>
              ))}
            </select>
            <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}
              className="px-3 py-2 border border-[#c6c6cd] rounded-lg text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] outline-none cursor-pointer transition-all focus:border-[#006a61]" style={{ fontFamily: 'Inter, sans-serif' }}>
              <option value="">All Owners</option>
              {crmUsers.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[13px] text-[#45464d] border-l border-[#c6c6cd] pl-4">{filteredOpportunities.length} Results Found</span>
          </div>
        </div>
      </div>

      {/* Opportunities Table (extracted component) */}
      {loading ? (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <CrmTableSkeleton rows={6} cols={10} />
        </div>
      ) : (
        <OpportunitiesTable
          opportunities={filteredOpportunities}
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
        <div className="p-4 bg-[#f8f9ff] border-t border-[#c6c6cd] flex justify-between items-center">
          <div className="text-[13px] text-[#45464d]">
            Showing <span className="font-bold text-[#0b1c30]">{((pagination.page - 1) * 20) + 1}–{Math.min(pagination.page * 20, pagination.total)}</span> of <span className="font-bold text-[#0b1c30]">{pagination.total}</span> deals
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => pagination.page > 1 && fetchOpportunities(pagination.page - 1)} disabled={pagination.page <= 1}
              className="w-8 h-8 flex items-center justify-center border border-[#c6c6cd] rounded hover:bg-white transition-colors disabled:opacity-40" style={{ background: 'none', cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer' }}>
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => fetchOpportunities(p)} style={{ border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                className={`w-8 h-8 flex items-center justify-center rounded text-xs ${p === pagination.page ? 'bg-[#006a61] text-white font-bold' : 'border border-[#c6c6cd] hover:bg-white text-[#0b1c30]'}`}>{p}</button>
            ))}
            <button onClick={() => pagination.page < pagination.totalPages && fetchOpportunities(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}
              className="w-8 h-8 flex items-center justify-center border border-[#c6c6cd] rounded hover:bg-white transition-colors disabled:opacity-40" style={{ background: 'none', cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer' }}>
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
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
          <div className="absolute inset-0 bg-[#213145]/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#0b1c30] mb-4">Assign Owner</h3>
            <select
              className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm"
              defaultValue=""
              onChange={(e) => { if (e.target.value) handleBulkAssignOwner(e.target.value); }}
            >
              <option value="" disabled>Select new owner</option>
              {crmUsers.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
            </select>
            <button onClick={() => setShowBulkOwnerSelect(false)} className="mt-4 w-full px-4 py-2 text-sm text-[#45464d] hover:text-[#0b1c30]" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Bulk stage select dropdown */}
      {showBulkStageSelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowBulkStageSelect(false)}>
          <div className="absolute inset-0 bg-[#213145]/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#0b1c30] mb-4">Change Stage</h3>
            <select
              className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm"
              defaultValue=""
              onChange={(e) => { if (e.target.value) handleBulkChangeStage(e.target.value); }}
            >
              <option value="" disabled>Select new stage</option>
              {pipelines.map(p => (p.stages ?? []).map(s => <option key={s.id} value={s.id}>{s.name} ({p.name})</option>))}
            </select>
            <button onClick={() => setShowBulkStageSelect(false)} className="mt-4 w-full px-4 py-2 text-sm text-[#45464d] hover:text-[#0b1c30]" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
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

      {/* Create Modal — Kinetic Enterprise Redesign */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setFormErrors([]); setShowCreate(false); }}>
          <div className="absolute inset-0 bg-[#213145]/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 flex flex-col overflow-hidden border border-[#e2e8f0]/30" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0]">
              <div>
                <h2 className="text-[24px] font-semibold text-[#0b1c30]" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.01em' }}>New Opportunity</h2>
                <p className="text-[13px] text-[#45464d] mt-1">Define the deal details, pipeline stage, and expected value.</p>
              </div>
              <button onClick={() => { setFormErrors([]); setShowCreate(false); }} className="p-2 hover:bg-[#dce9ff] rounded-full text-[#45464d] transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}><span className="material-symbols-outlined">close</span></button>
            </div>
            {/* Scrollable form body */}
            <form id="oppCreateForm" onSubmit={handleCreate} className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-6">
              {/* Section 1: Deal Information */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#d3e4fe] rounded-lg flex items-center justify-center text-[#006a61]"><span className="material-symbols-outlined">handshake</span></div>
                  <h3 className="text-[18px] font-semibold text-[#0b1c30]">Deal Information</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1.5">Opportunity Name *</label>
                    <input value={form.name || ''} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} required
                      className={`w-full border border-[#e2e8f0] rounded-lg p-2.5 text-[14px] outline-none transition-all focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61]${formErrors.some(e => e.field === 'name') ? ' !border-red-500 !ring-red-200' : ''}`} />
                    {formErrors.some(e => e.field === 'name') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'name')?.message}</p>)}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1.5">Account *</label>
                      <select value={form.accountId || ''} onChange={e => setForm(prev => ({ ...prev, accountId: e.target.value }))} required
                        className={`w-full border border-[#e2e8f0] rounded-lg p-2.5 text-[14px] outline-none transition-all focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61]${formErrors.some(e => e.field === 'accountId') ? ' !border-red-500 !ring-red-200' : ''}`} style={{ fontFamily: 'Inter, sans-serif' }}>
                        <option value="">Select Account</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      {formErrors.some(e => e.field === 'accountId') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'accountId')?.message}</p>)}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1.5">Owner</label>
                      <select value={form.ownerId || ''} onChange={e => setForm(prev => ({ ...prev, ownerId: e.target.value }))}
                        className="w-full border border-[#e2e8f0] rounded-lg p-2.5 text-[14px] outline-none transition-all focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61]" style={{ fontFamily: 'Inter, sans-serif' }}>
                        <option value="">Unassigned</option>
                        {crmUsers.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              {/* Section 2: Pipeline & Value */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#d3e4fe] rounded-lg flex items-center justify-center text-[#006a61]"><span className="material-symbols-outlined">trending_up</span></div>
                  <h3 className="text-[18px] font-semibold text-[#0b1c30]">Pipeline & Value</h3>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1.5">Pipeline *</label>
                      <select value={form.pipelineId || ''} onChange={e => { const p = pipelines.find(x => x.id === e.target.value); const firstStage = p?.stages?.[0]; setForm(prev => ({ ...prev, pipelineId: e.target.value, stageId: firstStage?.id, probability: firstStage?.probability ?? 0 })); }} required
                        className={`w-full border border-[#e2e8f0] rounded-lg p-2.5 text-[14px] outline-none transition-all focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61]${formErrors.some(e => e.field === 'pipelineId') ? ' !border-red-500 !ring-red-200' : ''}`} style={{ fontFamily: 'Inter, sans-serif' }}>
                        <option value="">Select Pipeline</option>
                        {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      {formErrors.some(e => e.field === 'pipelineId') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'pipelineId')?.message}</p>)}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1.5">Stage *</label>
                      <select value={form.stageId || ''} onChange={e => { const selP = pipelines.find(p => p.id === form.pipelineId); const selS = selP?.stages?.find(s => s.id === e.target.value); setForm(prev => ({ ...prev, stageId: e.target.value, probability: selS?.probability ?? prev.probability ?? 0 })); }} required
                        className={`w-full border border-[#e2e8f0] rounded-lg p-2.5 text-[14px] outline-none transition-all focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61]${formErrors.some(e => e.field === 'stageId') ? ' !border-red-500 !ring-red-200' : ''}`} style={{ fontFamily: 'Inter, sans-serif' }}>
                        <option value="">Select Stage</option>
                        {pipelines.find(p => p.id === form.pipelineId)?.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      {formErrors.some(e => e.field === 'stageId') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'stageId')?.message}</p>)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1.5">Estimated Value</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-3 flex items-center text-[#0b1c30] font-bold text-xs">RM</span>
                        <input type="number" value={form.value || ''} onChange={e => setForm(prev => ({ ...prev, value: Number(e.target.value) }))}
                          className={`w-full border border-[#e2e8f0] rounded-lg p-2.5 pl-10 text-[14px] outline-none transition-all focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61]${formErrors.some(e => e.field === 'value') ? ' !border-red-500 !ring-red-200' : ''}`} />
                      </div>
                      {formErrors.some(e => e.field === 'value') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'value')?.message}</p>)}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1.5">Probability</label>
                      <div className="relative">
                        <input type="number" min={0} max={100} value={form.probability ?? 0} onChange={e => setForm(prev => ({ ...prev, probability: Number(e.target.value) }))}
                          className={`w-full border border-[#e2e8f0] rounded-lg p-2.5 pr-8 text-[14px] outline-none transition-all focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61]${formErrors.some(e => e.field === 'probability') ? ' !border-red-500 !ring-red-200' : ''}`} />
                        <span className="absolute inset-y-0 right-3 flex items-center text-[#76777d] text-xs">%</span>
                      </div>
                      {formErrors.some(e => e.field === 'probability') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'probability')?.message}</p>)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1.5">Expected Close Date</label>
                      <input type="date" value={form.expectedCloseDate || ''} onChange={e => setForm(prev => ({ ...prev, expectedCloseDate: e.target.value }))}
                        className="w-full border border-[#e2e8f0] rounded-lg p-2.5 text-[14px] outline-none transition-all focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61]" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1.5">Forecast Category</label>
                      <select value={form.forecastCategory || 'PIPELINE'} onChange={e => setForm(prev => ({ ...prev, forecastCategory: e.target.value }))}
                        className="w-full border border-[#e2e8f0] rounded-lg p-2.5 text-[14px] outline-none transition-all focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61]" style={{ fontFamily: 'Inter, sans-serif' }}>
                        <option value="PIPELINE">Pipeline</option>
                        <option value="COMMIT">Commit</option>
                        <option value="BEST_CASE">Best Case</option>
                        <option value="OMIT">Omit</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              {/* Section 3: Additional Details */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#d3e4fe] rounded-lg flex items-center justify-center text-[#006a61]"><span className="material-symbols-outlined">notes</span></div>
                  <h3 className="text-[18px] font-semibold text-[#0b1c30]">Additional Details</h3>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1.5">Description</label>
                  <textarea value={form.description || ''} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={4}
                    className="w-full border border-[#e2e8f0] rounded-lg p-2.5 text-[14px] outline-none transition-all focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61]" />
                </div>
              </div>
            </form>
            {/* Sticky footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-[#e2e8f0] bg-[#eff4ff]">
              <span className="flex items-center gap-1.5 text-[11px] text-[#76777d]"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>Mandatory fields are marked with an asterisk (*)</span>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setFormErrors([]); setShowCreate(false); }} className="px-5 py-2 border border-[#e2e8f0] rounded-lg text-[#45464d] font-semibold hover:bg-[#dce9ff] bg-white transition-colors" style={{ cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                <button form="oppCreateForm" type="submit" disabled={saving} className="px-5 py-2 bg-[#006a61] text-white rounded-lg font-semibold hover:opacity-90 shadow-sm disabled:opacity-50 transition-all" style={{ border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  {saving ? 'Creating...' : 'Create Opportunity'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal — Kinetic Enterprise Redesign */}
      {showEdit && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setFormErrors([]); setShowEdit(false); setEditingItem(null); setForm({}); }}>
          <div className="absolute inset-0 bg-[#213145]/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 flex flex-col overflow-hidden border border-[#e2e8f0]/30" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0]">
              <div>
                <h2 className="text-[24px] font-semibold text-[#0b1c30]" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.01em' }}>Edit Opportunity</h2>
                <p className="text-[13px] text-[#45464d] mt-1">Update deal details, pipeline stage, and value.</p>
              </div>
              <button onClick={() => { setFormErrors([]); setShowEdit(false); setEditingItem(null); setForm({}); }} className="p-2 hover:bg-[#dce9ff] rounded-full text-[#45464d] transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}><span className="material-symbols-outlined">close</span></button>
            </div>
            {/* Scrollable form body */}
            <form id="oppEditForm" onSubmit={handleEdit} className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-6">
              {/* Section 1: Deal Information */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#d3e4fe] rounded-lg flex items-center justify-center text-[#006a61]"><span className="material-symbols-outlined">handshake</span></div>
                  <h3 className="text-[18px] font-semibold text-[#0b1c30]">Deal Information</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1.5">Opportunity Name *</label>
                    <input value={form.name || ''} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} required
                      className={`w-full border border-[#e2e8f0] rounded-lg p-2.5 text-[14px] outline-none transition-all focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61]${formErrors.some(e => e.field === 'name') ? ' !border-red-500 !ring-red-200' : ''}`} />
                    {formErrors.some(e => e.field === 'name') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'name')?.message}</p>)}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1.5">Account *</label>
                      <select value={form.accountId || ''} onChange={e => setForm(prev => ({ ...prev, accountId: e.target.value }))} required
                        className={`w-full border border-[#e2e8f0] rounded-lg p-2.5 text-[14px] outline-none transition-all focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61]${formErrors.some(e => e.field === 'accountId') ? ' !border-red-500 !ring-red-200' : ''}`} style={{ fontFamily: 'Inter, sans-serif' }}>
                        <option value="">Select Account</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      {formErrors.some(e => e.field === 'accountId') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'accountId')?.message}</p>)}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1.5">Owner</label>
                      <select value={form.ownerId || ''} onChange={e => setForm(prev => ({ ...prev, ownerId: e.target.value }))}
                        className="w-full border border-[#e2e8f0] rounded-lg p-2.5 text-[14px] outline-none transition-all focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61]" style={{ fontFamily: 'Inter, sans-serif' }}>
                        <option value="">Unassigned</option>
                        {crmUsers.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              {/* Section 2: Pipeline & Value */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#d3e4fe] rounded-lg flex items-center justify-center text-[#006a61]"><span className="material-symbols-outlined">trending_up</span></div>
                  <h3 className="text-[18px] font-semibold text-[#0b1c30]">Pipeline & Value</h3>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1.5">Pipeline *</label>
                      <select value={form.pipelineId || ''} onChange={e => { const p = pipelines.find(x => x.id === e.target.value); const firstStage = p?.stages?.[0]; setForm(prev => ({ ...prev, pipelineId: e.target.value, stageId: firstStage?.id, probability: firstStage?.probability ?? 0 })); }} required
                        className={`w-full border border-[#e2e8f0] rounded-lg p-2.5 text-[14px] outline-none transition-all focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61]${formErrors.some(e => e.field === 'pipelineId') ? ' !border-red-500 !ring-red-200' : ''}`} style={{ fontFamily: 'Inter, sans-serif' }}>
                        <option value="">Select Pipeline</option>
                        {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      {formErrors.some(e => e.field === 'pipelineId') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'pipelineId')?.message}</p>)}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1.5">Stage *</label>
                      <select value={form.stageId || ''} onChange={e => { const selP = pipelines.find(p => p.id === form.pipelineId); const selS = selP?.stages?.find(s => s.id === e.target.value); setForm(prev => ({ ...prev, stageId: e.target.value, probability: selS?.probability ?? prev.probability ?? 0 })); }} required
                        className={`w-full border border-[#e2e8f0] rounded-lg p-2.5 text-[14px] outline-none transition-all focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61]${formErrors.some(e => e.field === 'stageId') ? ' !border-red-500 !ring-red-200' : ''}`} style={{ fontFamily: 'Inter, sans-serif' }}>
                        <option value="">Select Stage</option>
                        {pipelines.find(p => p.id === form.pipelineId)?.stages?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      {formErrors.some(e => e.field === 'stageId') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'stageId')?.message}</p>)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1.5">Estimated Value</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-3 flex items-center text-[#0b1c30] font-bold text-xs">RM</span>
                        <input type="number" value={form.value || ''} onChange={e => setForm(prev => ({ ...prev, value: Number(e.target.value) }))}
                          className={`w-full border border-[#e2e8f0] rounded-lg p-2.5 pl-10 text-[14px] outline-none transition-all focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61]${formErrors.some(e => e.field === 'value') ? ' !border-red-500 !ring-red-200' : ''}`} />
                      </div>
                      {formErrors.some(e => e.field === 'value') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'value')?.message}</p>)}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1.5">Probability</label>
                      <div className="relative">
                        <input type="number" min={0} max={100} value={form.probability ?? 0} onChange={e => setForm(prev => ({ ...prev, probability: Number(e.target.value) }))}
                          className={`w-full border border-[#e2e8f0] rounded-lg p-2.5 pr-8 text-[14px] outline-none transition-all focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61]${formErrors.some(e => e.field === 'probability') ? ' !border-red-500 !ring-red-200' : ''}`} />
                        <span className="absolute inset-y-0 right-3 flex items-center text-[#76777d] text-xs">%</span>
                      </div>
                      {formErrors.some(e => e.field === 'probability') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'probability')?.message}</p>)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1.5">Expected Close Date</label>
                      <input type="date" value={form.expectedCloseDate || ''} onChange={e => setForm(prev => ({ ...prev, expectedCloseDate: e.target.value }))}
                        className="w-full border border-[#e2e8f0] rounded-lg p-2.5 text-[14px] outline-none transition-all focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61]" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1.5">Forecast Category</label>
                      <select value={form.forecastCategory || 'PIPELINE'} onChange={e => setForm(prev => ({ ...prev, forecastCategory: e.target.value }))}
                        className="w-full border border-[#e2e8f0] rounded-lg p-2.5 text-[14px] outline-none transition-all focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61]" style={{ fontFamily: 'Inter, sans-serif' }}>
                        <option value="PIPELINE">Pipeline</option>
                        <option value="COMMIT">Commit</option>
                        <option value="BEST_CASE">Best Case</option>
                        <option value="OMIT">Omit</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              {/* Section 3: Additional Details */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#d3e4fe] rounded-lg flex items-center justify-center text-[#006a61]"><span className="material-symbols-outlined">notes</span></div>
                  <h3 className="text-[18px] font-semibold text-[#0b1c30]">Additional Details</h3>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] mb-1.5">Description</label>
                  <textarea value={form.description || ''} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={4}
                    className="w-full border border-[#e2e8f0] rounded-lg p-2.5 text-[14px] outline-none transition-all focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61]" />
                </div>
              </div>
            </form>
            {/* Sticky footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-[#e2e8f0] bg-[#eff4ff]">
              <span className="flex items-center gap-1.5 text-[11px] text-[#76777d]"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>Mandatory fields are marked with an asterisk (*)</span>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setFormErrors([]); setShowEdit(false); setEditingItem(null); setForm({}); }} className="px-5 py-2 border border-[#e2e8f0] rounded-lg text-[#45464d] font-semibold hover:bg-[#dce9ff] bg-white transition-colors" style={{ cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                <button form="oppEditForm" type="submit" disabled={saving} className="px-5 py-2 bg-[#006a61] text-white rounded-lg font-semibold hover:opacity-90 shadow-sm disabled:opacity-50 transition-all" style={{ border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
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
