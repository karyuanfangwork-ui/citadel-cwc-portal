import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import crmService, { CrmPipeline, CrmPipelineStage, CrmOpportunity, CrmUser } from '../src/services/crm.service';
import CrmNav from '../src/components/CrmNav';
import { useCollapsedColumns, CollapsedColumnPill, ColumnCollapseToggle } from '../src/components/CollapsibleKanbanColumn';
import ConfirmDialog from '../src/components/ConfirmDialog';
import CrmMobilePipeline from '../src/components/crm/CrmMobilePipeline';
import { formatCurrency, formatShortDate, winProbStyle, stageBadgeColor } from '../src/components/crm/crmConstants';
import OpportunitiesTable, { SortConfig } from '../src/components/crm/OpportunitiesTable';
import BulkActionBar, { BulkAction } from '../src/components/crm/BulkActionBar';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';

const CrmPipelineView = () => {
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState<CrmPipeline[]>([]);
  const [activePipeline, setActivePipeline] = useState<string>('');
  const [stages, setStages] = useState<CrmPipelineStage[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [draggedOpp, setDraggedOpp] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [oppForm, setOppForm] = useState<Partial<CrmOpportunity & { accountName?: string }>>({});
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const { isCollapsed, toggle: toggleCollapse } = useCollapsedColumns('crm-pipeline');
  const [showLostReason, setShowLostReason] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [pendingLostOpp, setPendingLostOpp] = useState<{ oppId: string; stageId: string } | null>(null);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string>('');

  // View mode: list (default) or kanban
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>(() => {
    try { return (localStorage.getItem('crm-pipeline-view') as 'list' | 'kanban') || 'list'; }
    catch { return 'list'; }
  });
  useEffect(() => {
    try { localStorage.setItem('crm-pipeline-view', viewMode); } catch {}
  }, [viewMode]);

  // Delete confirmation
  const [deleteItem, setDeleteItem] = useState<CrmOpportunity | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Bulk selection
  const { user } = useAuth();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkToast, setBulkToast] = useState<string | null>(null);
  const [showBulkOwnerSelect, setShowBulkOwnerSelect] = useState(false);
  const [showBulkStageSelect, setShowBulkStageSelect] = useState(false);
  const [crmUsers, setCrmUsers] = useState<CrmUser[]>([]);

  useEffect(() => { crmService.listCrmUsers().then(setCrmUsers).catch(() => {}); }, []);

  // Sort state (3-cycle: asc → desc → none)
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  useEffect(() => {
    const init = async () => {
      const pips = await crmService.listPipelines();
      setPipelines(pips);
      if (pips.length > 0) {
        const defaultPip = pips.find(p => p.isDefault) || pips[0];
        setActivePipeline(defaultPip.id);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!activePipeline) return;
    const fetch = async () => {
      try {
        setLoading(true);
        const data = await crmService.getPipeline(activePipeline);
        setStages(data.stages); setTotalValue(data.totalValue);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetch();
  }, [activePipeline]);

  // Derive unique owners from all stages for the filter dropdown
  const owners = useMemo(() => {
    const map = new Map<string, string>();
    stages.forEach(s => (s.opportunities ?? []).forEach(o => {
      if (o.owner && !map.has(o.owner.id)) {
        map.set(o.owner.id, `${o.owner.firstName} ${o.owner.lastName}`);
      }
    }));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [stages]);

  // Filtered stages (applies search + owner filter)
  const filteredStages = useMemo(() => {
    if (!searchQuery && !ownerFilter) return stages;
    const q = searchQuery.toLowerCase();
    return stages.map(stage => ({
      ...stage,
      opportunities: (stage.opportunities ?? []).filter(opp => {
        const matchesSearch = !searchQuery ||
          opp.name.toLowerCase().includes(q) ||
          opp.account?.name?.toLowerCase().includes(q) ||
          (opp.owner && `${opp.owner.firstName} ${opp.owner.lastName}`.toLowerCase().includes(q));
        const matchesOwner = !ownerFilter || opp.ownerId === ownerFilter;
        return matchesSearch && matchesOwner;
      }),
    }));
  }, [stages, searchQuery, ownerFilter]);

  // Flatten filtered stages → CrmOpportunity[] for list mode
  const flatOpportunities = useMemo(() => {
    return filteredStages.flatMap(stage =>
      (stage.opportunities ?? []).map(opp => ({
        ...opp,
        pipelineId: opp.pipelineId || stage.pipelineId,
        stage: {
          id: stage.id,
          name: stage.name,
          probability: stage.probability,
          displayOrder: stage.displayOrder,
          color: stage.color,
          isWonStage: stage.isWonStage,
          isLostStage: stage.isLostStage,
          pipelineId: stage.pipelineId,
          _count: stage._count,
        },
      }))
    );
  }, [filteredStages]);

  const handleSort = useCallback((field: SortConfig['field']) => {
    setSortConfig(prev => {
      if (!prev || prev.field !== field) return { field, direction: 'asc' };
      if (prev.direction === 'asc') return { field, direction: 'desc' };
      return null;
    });
  }, []);

  const sortedOpportunities = useMemo(() => {
    if (!sortConfig) return flatOpportunities;
    const sorted = [...flatOpportunities];
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
  }, [flatOpportunities, sortConfig]);

  // Bulk selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(sortedOpportunities.map(o => o.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const isAllSelected = sortedOpportunities.length > 0 && sortedOpportunities.every(o => selectedIds.has(o.id));

  // Re-fetch pipeline data after bulk actions
  const refetchPipeline = async () => {
    if (!activePipeline) return;
    try {
      const pls = await crmService.listPipelines();
      setPipelines(pls);
      const data = await crmService.getPipeline(activePipeline);
      setStages(data.stages);
      setTotalValue(data.totalValue);
    } catch (e) { console.error(e); }
  };

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
    refetchPipeline();
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
    refetchPipeline();
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
    refetchPipeline();
    setTimeout(() => setBulkToast(null), 3000);
  };

  const bulkActions: BulkAction[] = hasPermission(user, 'crm:admin') ? [
    { label: 'Assign Owner', icon: 'person_add', onClick: async () => { setShowBulkOwnerSelect(true); } },
    { label: 'Change Stage', icon: 'swap_horiz', onClick: async () => { setShowBulkStageSelect(true); } },
    { label: 'Delete', icon: 'delete', variant: 'danger', onClick: handleBulkDelete },
  ] : [];

  // Delete single opportunity
  const handleConfirmDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      await crmService.deleteOpportunity(deleteItem.id);
      setShowDelete(false);
      setDeleteItem(null);
      refetchPipeline();
    } catch (e) { console.error(e); }
    finally { setDeleting(false); }
  };

  // Helper: find which stage an opp belongs to + the opp itself
  const findOppAndSourceStage = (oppId: string, stagesArr: CrmPipelineStage[]) => {
    for (const stage of stagesArr) {
      const opp = stage.opportunities?.find(o => o.id === oppId);
      if (opp) return { opp, sourceStageId: stage.id };
    }
    return null;
  };

  // Optimistic move: update local state immediately, revert on API failure
  const applyOptimisticMove = (oppId: string, targetStageId: string, lostReasonArg?: string) => {
    const found = findOppAndSourceStage(oppId, stages);
    if (!found) return false;
    const { opp, sourceStageId } = found;
    if (sourceStageId === targetStageId) return false;

    const prevStages = stages;
    setStages(prev => prev.map(s => {
      if (s.id === sourceStageId) {
        return { ...s, opportunities: (s.opportunities ?? []).filter(o => o.id !== oppId) };
      }
      if (s.id === targetStageId) {
        return { ...s, opportunities: [...(s.opportunities ?? []), { ...opp, stageId: targetStageId }] };
      }
      return s;
    }));

    return { prevStages, opp };
  };

  const handleDragStart = (e: React.DragEvent, oppId: string) => {
    setDraggedOpp(oppId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', oppId);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageId);
  };

  const handleDragLeave = () => setDragOverStage(null);

  const handleDrop = async (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStage(null);
    const oppId = e.dataTransfer.getData('text/plain');
    if (!oppId) return;

    const targetStage = stages.find(s => s.id === stageId);
    if (targetStage?.isLostStage) {
      setPendingLostOpp({ oppId, stageId });
      setShowLostReason(true);
      setDraggedOpp(null);
      return;
    }

    const result = applyOptimisticMove(oppId, stageId);
    if (!result) { setDraggedOpp(null); return; }

    setDraggedOpp(null);
    try {
      await crmService.moveStage(oppId, stageId);
    } catch (e) {
      console.error(e);
      setStages(result.prevStages);
    }
  };

  const handleConfirmLost = async () => {
    if (!pendingLostOpp) return;
    const { oppId, stageId } = pendingLostOpp;

    const result = applyOptimisticMove(oppId, stageId, lostReason || undefined);

    setShowLostReason(false);
    setLostReason('');
    setPendingLostOpp(null);

    if (!result) return;
    try {
      await crmService.moveStage(oppId, stageId, lostReason || undefined);
    } catch (e) {
      console.error(e);
      setStages(result.prevStages);
    }
  };

  // Mobile stage change (from swipe/button in CrmMobilePipeline)
  const handleMobileStageChange = async (oppId: string, stageId: string, lostReasonArg?: string) => {
    const targetStage = stages.find(s => s.id === stageId);

    if (targetStage?.isLostStage && !lostReasonArg) {
      setPendingLostOpp({ oppId, stageId });
      setShowLostReason(true);
      return;
    }

    const result = applyOptimisticMove(oppId, stageId, lostReasonArg);
    if (!result) return;
    try {
      await crmService.moveStage(oppId, stageId, lostReasonArg);
    } catch (e) {
      console.error(e);
      setStages(result.prevStages);
    }
  };

  const selectedPipeline = pipelines.find(p => p.id === activePipeline);

  const handleCreateOpp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPipeline) return;
    const firstStage = selectedPipeline.stages?.[0];
    try {
      setSaving(true);
      await crmService.createOpportunity({
        ...oppForm,
        pipelineId: selectedPipeline.id,
        stageId: oppForm.stageId ?? firstStage?.id,
        value: oppForm.value ?? 0,
        probability: oppForm.probability ?? firstStage?.probability ?? 0,
        currency: 'MYR',
      });
      setShowCreate(false);
      setOppForm({});
      const pls = await crmService.listPipelines();
      setPipelines(pls);
      const data = await crmService.getPipeline(activePipeline);
      setStages(data.stages); setTotalValue(data.totalValue);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const openCreateOpp = async () => {
    try {
      const accs = await crmService.listAccounts({ limit: 100 });
      setAccounts(accs.accounts.map(a => ({ id: a.id, name: a.name })));
    } catch (e) { console.error(e); }
    if (selectedPipeline?.stages?.[0]) {
      setOppForm({ stageId: selectedPipeline.stages[0].id, probability: selectedPipeline.stages[0].probability });
    }
    setShowCreate(true);
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <CrmNav />
      {/* Header */}
      <div className="px-4 sm:px-8 py-4 sm:py-8" style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
              <Link to="/crm" className="hover:text-brand-700 transition-colors" style={{ textDecoration: 'none', color: 'inherit' }}>CRM</Link>
              <span>/</span><span className="font-semibold text-text-primary">Pipeline</span>
            </div>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-black text-text-primary">Sales Pipeline</h1>
              <span className="text-lg font-bold text-success">{formatCurrency(totalValue)} total</span>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative min-w-[200px] max-w-xs">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-lg">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search opportunities..."
                className="w-full pl-10 pr-4 py-2 bg-surface-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all"
              />
            </div>
            {owners.length > 1 && (
              <select
                value={ownerFilter}
                onChange={e => setOwnerFilter(e.target.value)}
                className="px-3 py-1.5 bg-surface border border-border rounded-lg text-sm font-medium text-text-primary outline-none cursor-pointer"
              >
                <option value="">All owners</option>
                {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            )}
            {(searchQuery || ownerFilter) && (
              <button
                onClick={() => { setSearchQuery(''); setOwnerFilter(''); }}
                className="text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors border-0 cursor-pointer bg-transparent"
              >
                Clear
              </button>
            )}
            {pipelines.length > 1 && (
              <select value={activePipeline} onChange={e => setActivePipeline(e.target.value)}
                className="px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary outline-none cursor-pointer" style={{ fontFamily: 'var(--font-sans)' }}>
                {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <button onClick={openCreateOpp}
              className="flex items-center gap-2 bg-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors border-0 cursor-pointer"
              style={{ fontFamily: 'var(--font-sans)' }}>
              <span className="material-symbols-outlined text-lg">add</span> New Opportunity
            </button>
            <div className="flex items-center gap-1 border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 text-sm border-0 cursor-pointer ${viewMode === 'list' ? 'bg-brand-700 text-white' : 'bg-surface text-text-secondary hover:bg-bg-subtle'}`}
                title="Table view"
              >
                <span className="material-symbols-outlined text-base">view_list</span>
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-2 text-sm border-0 cursor-pointer ${viewMode === 'kanban' ? 'bg-brand-700 text-white' : 'bg-surface text-text-secondary hover:bg-bg-subtle'}`}
                title="Kanban view"
              >
                <span className="material-symbols-outlined text-base">view_kanban</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Board / Table area */}
      <div className={`flex-1 overflow-auto px-4 sm:px-8 py-5 ${viewMode === 'kanban' ? 'overflow-x-auto' : ''}`} style={{ background: 'var(--color-surface-muted)' }}>
        {loading ? (
          viewMode === 'list' ? (
            <div className="bg-surface rounded-xl border border-border p-8 text-center text-text-secondary text-sm">Loading opportunities...</div>
          ) : (
          <div className="flex gap-4 h-full">
            {[0,1,2,3,4].map(i => (
              <div key={i} className="w-72 shrink-0 bg-surface border border-border rounded-xl p-4">
                <div style={{ height: 16, width: '60%', background: 'var(--color-border)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite', marginBottom: 16 }} />
                {[0,1,2].map(j => (
                  <div key={j} className="bg-surface-muted rounded-lg p-4 mb-3" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
                    <div style={{ height: 12, width: '80%', background: 'var(--color-border)', borderRadius: 4, marginBottom: 8 }} />
                    <div style={{ height: 10, width: '50%', background: 'var(--color-border)', borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            ))}
          </div>
          )
        ) : viewMode === 'list' ? (
          <>
            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <BulkActionBar
                selectedCount={selectedIds.size}
                totalCount={sortedOpportunities.length}
                onSelectAll={selectAll}
                onClearSelection={clearSelection}
                actions={bulkActions}
                loading={bulkProcessing}
              />
            )}
            {bulkToast && (
              <div className="mb-3 px-4 py-2 bg-brand-50 text-brand-700 text-sm font-semibold rounded-lg border border-brand-200">
                {bulkToast}
              </div>
            )}
            <OpportunitiesTable
              opportunities={sortedOpportunities}
              pipelines={pipelines.map(p => ({
                id: p.id,
                stages: p.stages?.map(s => ({
                  id: s.id, name: s.name, probability: s.probability,
                  displayOrder: s.displayOrder, color: s.color,
                  isWonStage: s.isWonStage, isLostStage: s.isLostStage,
                })),
              }))}
              sortConfig={sortConfig}
              onSort={handleSort}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onSelectAll={selectAll}
              onClearSelection={clearSelection}
              onEdit={(opp) => navigate(`/crm/opportunities/${opp.id}`)}
              onDelete={(opp) => { setDeleteItem(opp); setShowDelete(true); }}
              onStageChange={handleMobileStageChange}
              isAllSelected={isAllSelected}
              user={user}
            />
            {/* Bulk owner select modal */}
            {showBulkOwnerSelect && (
              <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowBulkOwnerSelect(false)}>
                <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
                <div className="relative bg-surface rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-black text-text-primary mb-4">Assign Owner</h3>
                  <select
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface-muted outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 mb-4"
                    style={{ fontFamily: 'var(--font-sans)' }}
                    defaultValue=""
                    onChange={e => { if (e.target.value) handleBulkAssignOwner(e.target.value); }}
                  >
                    <option value="">Select owner...</option>
                    {crmUsers.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                  </select>
                  <button onClick={() => setShowBulkOwnerSelect(false)} className="text-sm text-text-secondary hover:text-text-primary" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
            {/* Bulk stage select modal */}
            {showBulkStageSelect && selectedPipeline && (
              <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowBulkStageSelect(false)}>
                <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
                <div className="relative bg-surface rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-black text-text-primary mb-4">Change Stage</h3>
                  <select
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface-muted outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 mb-4"
                    style={{ fontFamily: 'var(--font-sans)' }}
                    defaultValue=""
                    onChange={e => { if (e.target.value) handleBulkChangeStage(e.target.value); }}
                  >
                    <option value="">Select stage...</option>
                    {(selectedPipeline.stages ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button onClick={() => setShowBulkStageSelect(false)} className="text-sm text-text-secondary hover:text-text-primary" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Desktop: kanban columns — hidden below lg */}
            <div className="hidden lg:flex gap-4 h-full min-w-max items-stretch">
              {filteredStages.map(stage => {
                const opps = stage.opportunities || [];
                const stageValue = opps.reduce((s, o) => s + Number(o.value), 0);
                const isOver = dragOverStage === stage.id;
                const collapsed = isCollapsed(stage.id);
                const stageColor = stageBadgeColor(stage);

                if (collapsed) {
                  return (
                    <CollapsedColumnPill
                      key={stage.id}
                      label={stage.name}
                      color={stageColor}
                      count={opps.length}
                      onClick={() => toggleCollapse(stage.id)}
                    />
                  );
                }

                return (
                  <div
                    key={stage.id}
                    className={`w-72 shrink-0 bg-surface border rounded-xl flex flex-col transition-all ${isOver ? 'border-brand-400 ring-2 ring-brand-200' : 'border-border'}`}
                    style={{ borderTop: `3px solid ${stageColor}` }}
                    onDragOver={e => handleDragOver(e, stage.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, stage.id)}
                  >
                    {/* Stage Header */}
                    <div className="p-4 border-b border-border shrink-0 group">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center gap-1 font-bold rounded-full text-[10px] px-1.5 py-0.5"
                            style={{
                              background: `${stageColor}18`,
                              color: stageColor,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                              {stage.isWonStage ? 'emoji_events' : stage.isLostStage ? 'trending_down' : 'group'}
                            </span>
                            {stage.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold bg-surface-muted text-text-secondary px-2 py-0.5 rounded-full">{opps.length}</span>
                          <ColumnCollapseToggle onClick={() => toggleCollapse(stage.id)} />
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-text-tertiary">{formatCurrency(stageValue)} · {stage.probability}% prob</div>
                    </div>

                    {/* Cards */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5" style={{ minHeight: 100 }}>
                      {opps.length === 0 && (
                        <div className="text-center py-8 text-text-tertiary text-xs">
                          {isOver ? <span className="font-bold text-brand-600">Drop here</span> : 'No opportunities'}
                        </div>
                      )}
                      {opps.map(opp => (
                        <div
                          key={opp.id}
                          draggable
                          onDragStart={e => handleDragStart(e, opp.id)}
                          onDragEnd={() => setDraggedOpp(null)}
                          onClick={() => navigate(`/crm/opportunities/${opp.id}`)}
                          className={`bg-surface border border-border rounded-lg p-3.5 cursor-grab hover:shadow-md hover:border-brand-200 transition-all ${draggedOpp === opp.id ? 'opacity-40 scale-95' : ''}`}
                          style={{ userSelect: 'none' }}
                        >
                          <div className="text-sm font-bold text-text-primary mb-1 line-clamp-2" title={opp.name}>{opp.name}</div>
                          <div className="text-lg font-black text-brand-600 mb-2">{formatCurrency(Number(opp.value))}</div>
                          {opp.aiWinProbability != null && (() => {
                            const ws = winProbStyle(opp.aiWinProbability);
                            return (
                              <span
                                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold mb-2"
                                style={{ background: ws.bg, color: ws.text }}
                                title={opp.aiWinReason ?? 'AI Win Probability'}
                              >
                                <span className="material-symbols-outlined text-sm">{ws.icon}</span>
                                AI {opp.aiWinProbability}%
                              </span>
                            );
                          })()}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-text-tertiary text-sm">business</span>
                              <span className="text-xs text-text-secondary truncate max-w-[120px]" title={opp.account?.name ?? ''}>{opp.account?.name}</span>
                            </div>
                            {opp.expectedCloseDate && (
                              <span className="text-xs text-text-tertiary">{formatShortDate(opp.expectedCloseDate)}</span>
                            )}
                          </div>
                          {opp.owner && (
                            <div className="flex items-center gap-1.5 mt-2">
                              <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center">
                                <span className="text-[10px] font-bold text-brand-600">{opp.owner.firstName?.[0]}{opp.owner.lastName?.[0]}</span>
                              </div>
                              <span className="text-xs text-text-tertiary" title={`${opp.owner.firstName} ${opp.owner.lastName}`}>{opp.owner.firstName} {opp.owner.lastName}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile: tabbed stage view — hidden above lg */}
            <div className="lg:hidden h-full">
              <CrmMobilePipeline
                stages={filteredStages}
                onCardClick={(oppId) => navigate(`/crm/opportunities/${oppId}`)}
                onStageChange={handleMobileStageChange}
                searchQuery={searchQuery}
              />
            </div>
          </>
        )}
      </div>

      {showCreate && selectedPipeline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowCreate(false); setOppForm({}); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-surface rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-md mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 pb-4 border-b border-border shrink-0">
              <h2 className="text-lg font-black text-text-primary">New Opportunity</h2>
              <button onClick={() => { setShowCreate(false); setOppForm({}); }}
                className="text-text-secondary hover:text-text-primary transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateOpp} className="p-6 pt-4 space-y-3 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Opportunity Name *</label>
                <input required value={oppForm.name ?? ''} onChange={e => setOppForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface-muted outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all" style={{ fontFamily: 'var(--font-sans)' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Account *</label>
                <select required value={oppForm.accountId ?? ''} onChange={e => setOppForm(f => ({ ...f, accountId: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface-muted outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all" style={{ fontFamily: 'var(--font-sans)' }}>
                  <option value="">Select account...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Stage</label>
                <select value={oppForm.stageId ?? ''} onChange={e => {
                  const stage = selectedPipeline.stages?.find(s => s.id === e.target.value);
                  setOppForm(f => ({ ...f, stageId: e.target.value, probability: stage?.probability ?? f.probability }));
                }} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface-muted outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all" style={{ fontFamily: 'var(--font-sans)' }}>
                  {(selectedPipeline.stages ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Value (MYR)</label>
                  <input type="number" min="0" value={oppForm.value ?? ''} onChange={e => setOppForm(f => ({ ...f, value: Number(e.target.value) }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface-muted outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all" style={{ fontFamily: 'var(--font-sans)' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Close Date</label>
                  <input type="date" value={oppForm.expectedCloseDate ?? ''} onChange={e => setOppForm(f => ({ ...f, expectedCloseDate: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface-muted outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all" style={{ fontFamily: 'var(--font-sans)' }} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); setOppForm({}); }}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Creating...' : 'Create Opportunity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={showLostReason}
        title="Mark as Lost"
        message="Please provide a reason for marking this deal as lost."
        confirmLabel="Confirm Lost"
        confirmVariant="danger"
        onConfirm={handleConfirmLost}
        onCancel={() => { setShowLostReason(false); setLostReason(''); setPendingLostOpp(null); }}
      >
        <textarea
          value={lostReason}
          onChange={e => setLostReason(e.target.value)}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary resize-none mb-2"
          style={{ fontFamily: 'var(--font-sans)' }}
          rows={3}
          placeholder="Reason for loss..."
          autoFocus
        />
      </ConfirmDialog>

      {/* Delete opportunity confirmation */}
      <ConfirmDialog
        open={showDelete}
        title="Delete Opportunity"
        message={`Are you sure you want to delete "${deleteItem?.name ?? 'this opportunity'}"? This action cannot be undone.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        confirmVariant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => { setShowDelete(false); setDeleteItem(null); }}
      />
    </div>
  );
};

export default CrmPipelineView;