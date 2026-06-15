import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import crmService, { CrmLead, CrmUser, Pagination, LeadSource, LeadStatus } from '../src/services/crm.service';
import BulkActionBar, { BulkAction } from '../src/components/crm/BulkActionBar';
import { cleanFormPayload, NUMERIC_KEYS } from '../src/utils/crmFormHelper';
import { validateLead, ValidationError } from '../src/utils/crmValidation';
import ConfirmDialog from '../src/components/ConfirmDialog';
import EmptyState from '../src/components/ui/EmptyState';
import CrmCardSkeleton from '../src/components/crm/CrmCardSkeleton';
import CrmTableSkeleton from '../src/components/crm/CrmTableSkeleton';
import LeadsTable, { SortConfig } from '../src/components/crm/LeadsTable';
import { useCrmUpdate } from '../src/hooks/useCrmUpdate';
import { hasPermission } from '../src/utils/permissions';
import { useAuth } from '../src/context/AuthContext';
import {
  STATUS_STYLES,
  LEAD_SOURCES,
  formatCurrency,
  formatDate,
  formatShortDate,
  isToday,
  isOverdue,
  isStale,
  type UrgencyBadge,
  scoreStyle,
} from '../src/components/crm/crmConstants';

const TEAL = '#006a61';
const TEAL_LIGHT = '#86f2e4';

export const ACTIVITY_ICONS: Record<string, { icon: string; color: string }> = {
  CALL: { icon: 'call', color: '#2563eb' },
  EMAIL: { icon: 'mail', color: '#7c3aed' },
  MEETING: { icon: 'groups', color: '#059669' },
  NOTE: { icon: 'note', color: 'var(--color-text-secondary)' },
  TASK: { icon: 'task_alt', color: '#d97706' },
  FOLLOW_UP: { icon: 'event_repeat', color: '#ea580c' },
  WHATSAPP: { icon: 'chat', color: '#16a34a' },
  SITE_VISIT: { icon: 'location_on', color: 'var(--color-danger)' },
};

const getUrgencyBadge = (lead: CrmLead): UrgencyBadge => {
  if (lead.followUpDate) {
    if (isOverdue(lead.followUpDate) && !isToday(lead.followUpDate))
      return { label: 'Overdue', bg: 'rgba(220,38,38,0.06)', text: 'var(--color-danger)', icon: 'error' };
    if (isToday(lead.followUpDate))
      return { label: 'Due Today', bg: 'var(--color-fin-50)', text: 'var(--color-warning)', icon: 'schedule' };
  }
  if (isStale(lead.updatedAt) && lead.status !== 'CONVERTED' && lead.status !== 'LOST')
    return { label: 'Stale', bg: 'var(--color-surface-muted)', text: 'var(--color-text-secondary)', icon: 'hourglass_empty' };
  return null;
};

const CrmLeads = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get('filter') || '';
  const [prioritySort, setPrioritySort] = useState(false);
  const { user } = useAuth();

  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Partial<CrmLead>>({});
  const [saving, setSaving] = useState(false);
  const [crmUsers, setCrmUsers] = useState<CrmUser[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<CrmLead | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [deleteItem, setDeleteItem] = useState<CrmLead | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formErrors, setFormErrors] = useState<ValidationError[]>([]);

  const [viewMode, setViewMode] = useState<'table' | 'card'>(() => {
    try { return (localStorage.getItem('crm-leads-view') as 'table' | 'card') || 'table'; } catch { return 'table'; }
  });
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  useEffect(() => { try { localStorage.setItem('crm-leads-view', viewMode); } catch {} }, [viewMode]);

  const handleSort = useCallback((field: SortConfig['field']) => {
    setSortConfig(prev => {
      if (prev?.field === field) {
        return prev.direction === 'asc' ? { field, direction: 'desc' } : prev.direction === 'desc' ? null : { field, direction: 'asc' };
      }
      return { field, direction: 'asc' };
    });
  }, []);

  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
    try {
      await crmService.updateLead(leadId, { status: newStatus });
    } catch {
      fetchLeads();
    }
  };

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkToast, setBulkToast] = useState<string | null>(null);
  const [showBulkOwnerSelect, setShowBulkOwnerSelect] = useState(false);
  const [showBulkStatusSelect, setShowBulkStatusSelect] = useState(false);
  const ownerIdParam = searchParams.get('ownerId') || '';

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(displayedLeads.map(l => l.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkAssignOwner = async (newOwnerId: string) => {
    setBulkProcessing(true);
    let count = 0;
    for (const id of selectedIds) {
      try { await crmService.updateLead(id, { ownerId: newOwnerId }); count++; } catch {}
    }
    setSelectedIds(new Set());
    setShowBulkOwnerSelect(false);
    setBulkProcessing(false);
    setBulkToast(`Assigned ${count} lead${count > 1 ? 's' : ''} to new owner`);
    fetchLeads();
    setTimeout(() => setBulkToast(null), 3000);
  };

  const handleBulkChangeStatus = async (newStatus: string) => {
    setBulkProcessing(true);
    let count = 0;
    for (const id of selectedIds) {
      try { await crmService.updateLead(id, { status: newStatus as LeadStatus }); count++; } catch {}
    }
    setSelectedIds(new Set());
    setShowBulkStatusSelect(false);
    setBulkProcessing(false);
    setBulkToast(`Changed status of ${count} lead${count > 1 ? 's' : ''}`);
    fetchLeads();
    setTimeout(() => setBulkToast(null), 3000);
  };

  const handleBulkDelete = async () => {
    setBulkProcessing(true);
    let count = 0;
    for (const id of selectedIds) {
      try { await crmService.deleteLead(id); count++; } catch {}
    }
    setSelectedIds(new Set());
    setBulkProcessing(false);
    setBulkToast(`Deleted ${count} lead${count > 1 ? 's' : ''}`);
    fetchLeads();
    setTimeout(() => setBulkToast(null), 3000);
  };

  const bulkActions: BulkAction[] = hasPermission(user, 'crm:admin') ? [
    { label: 'Assign Owner', icon: 'person_add', onClick: async () => { setShowBulkOwnerSelect(true); } },
    { label: 'Change Status', icon: 'swap_horiz', onClick: async () => { setShowBulkStatusSelect(true); } },
    { label: 'Delete', icon: 'delete', variant: 'danger', onClick: handleBulkDelete },
  ] : [];

  const checkDuplicateLead = async (field: 'contactEmail' | 'contactPhone', value: string) => {
    if (!value.trim()) { setDuplicateWarning(null); return; }
    try {
      const data = await crmService.listLeads({ search: value.trim(), limit: 5 });
      const matches = data.leads.filter(l =>
        field === 'contactEmail'
          ? l.contactEmail?.toLowerCase() === value.trim().toLowerCase()
          : l.contactPhone?.replace(/\s/g, '') === value.trim().replace(/\s/g, '')
      );
      if (matches.length > 0) {
        const label = field === 'contactEmail' ? 'email' : 'phone';
        setDuplicateWarning(`Possible duplicate: "${matches[0].title}" (${matches[0].status}) already has this ${label}.`);
      } else {
        setDuplicateWarning(null);
      }
    } catch { setDuplicateWarning(null); }
  };

  useEffect(() => {
    crmService.listCrmUsers().then(setCrmUsers).catch(() => {});
  }, []);

  const fetchLeads = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const stale = filterParam === 'stale';
      const followup = filterParam === 'followup';
      const data = await crmService.listLeads({ page, limit: 20, search: search || undefined, status: (stale || followup) ? undefined : (statusFilter || undefined), source: sourceFilter || undefined, stale: stale || undefined, followup: followup || undefined, ownerId: ownerIdParam || undefined });
      setLeads(data.leads); setPagination(data.pagination);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [search, statusFilter, sourceFilter, filterParam, ownerIdParam]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useCrmUpdate(['lead'], () => { fetchLeads(); });

  const displayedLeads = useMemo(() => {
    let result = leads;
    if (prioritySort) {
      result = [...result].sort((a, b) => {
        if (a.aiScore == null && b.aiScore == null) return 0;
        if (a.aiScore == null) return 1;
        if (b.aiScore == null) return -1;
        return b.aiScore - a.aiScore;
      });
    }
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const aVal: any = sortConfig.field === 'followUpDate' ? (a as any).followUpDate : (a as any)[sortConfig.field];
        const bVal: any = sortConfig.field === 'followUpDate' ? (b as any).followUpDate : (b as any)[sortConfig.field];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        let cmp = 0;
        if (sortConfig.field === 'estimatedValue' || sortConfig.field === 'aiScore') {
          cmp = (aVal as number) - (bVal as number);
        } else if (sortConfig.field === 'followUpDate' || sortConfig.field === 'createdAt') {
          cmp = new Date(aVal).getTime() - new Date(bVal).getTime();
        } else {
          cmp = String(aVal).localeCompare(String(bVal));
        }
        return sortConfig.direction === 'desc' ? -cmp : cmp;
      });
    }
    return result;
  }, [leads, prioritySort, sortConfig]);

  // Derived stats for bottom bar
  const statsBar = useMemo(() => {
    const todayLeads = leads.filter(l => isToday(l.createdAt)).length;
    const pendingFollowUps = leads.filter(l => l.followUpDate && (isToday(l.followUpDate) || isOverdue(l.followUpDate))).length;
    const converted = leads.filter(l => l.status === 'CONVERTED').length;
    const convRate = leads.length > 0 ? ((converted / leads.length) * 100).toFixed(1) : '0.0';
    return { todayLeads, pendingFollowUps, convRate };
  }, [leads]);

  const clearFilterParam = () => {
    searchParams.delete('filter');
    setSearchParams(searchParams);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateLead(form);
    if (errors.length > 0) { setFormErrors(errors); return; }
    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(form)) {
      if (v === '' || v === undefined || v === null) continue;
      if (k === 'estimatedValue') { payload[k] = Number(v); if (isNaN(payload[k])) delete payload[k]; }
      else payload[k] = v;
    }
    try { setSaving(true); await crmService.createLead(payload); setShowCreate(false); setForm({}); setFormErrors([]); setDuplicateWarning(null); fetchLeads(); }
    catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const openEdit = (lead: CrmLead) => {
    setEditingItem(lead);
    setForm({
      title: lead.title,
      contactName: lead.contactName || '',
      contactEmail: lead.contactEmail || '',
      contactPhone: lead.contactPhone || '',
      companyName: lead.companyName || '',
      ownerId: lead.ownerId,
      source: lead.source,
      estimatedValue: lead.estimatedValue ?? undefined,
    });
    setDuplicateWarning(null);
    setShowEdit(true);
  };

  const closeEdit = () => {
    setShowEdit(false);
    setEditingItem(null);
    setForm({});
    setDuplicateWarning(null);
    setFormErrors([]);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const errors = validateLead(form);
    if (errors.length > 0) { setFormErrors(errors); return; }
    const payload = cleanFormPayload(form as Record<string, any>, NUMERIC_KEYS.lead);
    delete payload.status;
    try {
      setSaving(true);
      await crmService.updateLead(editingItem.id, payload);
      closeEdit();
      fetchLeads();
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      setDeleting(true);
      await crmService.deleteLead(deleteItem.id);
      setShowDelete(false);
      setDeleteItem(null);
      fetchLeads();
    } catch (e) { console.error(e); } finally { setDeleting(false); }
  };

  // Shared input/select classes for modals
  const inputCls = (hasError = false) =>
    `w-full px-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 transition-all ${hasError ? 'border-[#ba1a1a] focus:ring-[#ba1a1a]/20' : 'border-[#e2e8f0] focus:ring-[#006a61]/20 focus:border-[#006a61]'}`;

  return (
    <>
      <div className="min-h-full bg-[#f8f9ff]" style={{ paddingBottom: selectedIds.size > 0 ? '80px' : '32px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }} className="px-6 py-6">

          {/* ── Header ── */}
          <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
            <div>
              <div className="flex items-center gap-1.5 text-[12px] text-[#45464d] opacity-70 mb-1">
                <Link to="/crm" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:opacity-100">CRM</Link>
                <span>/</span>
                <span className="text-[#0b1c30] opacity-100 font-semibold">Leads</span>
              </div>
              <h1 className="text-[28px] font-bold text-[#0b1c30] tracking-tight leading-tight">
                Leads
                {ownerIdParam && (
                  <span className="ml-3 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: TEAL_LIGHT, color: TEAL }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>person</span>
                    {crmUsers.find(u => u.id === ownerIdParam)?.firstName ?? 'Owner'}&apos;s leads
                    <button onClick={() => { searchParams.delete('ownerId'); setSearchParams(searchParams); }} className="ml-0.5" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}>✕</button>
                  </span>
                )}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex items-center bg-white border border-[#e2e8f0] rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('table')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'table' ? 'text-white shadow-sm' : 'text-[#45464d] hover:text-[#0b1c30]'}`}
                  style={{ border: 'none', cursor: 'pointer', background: viewMode === 'table' ? TEAL : 'none' }}
                >
                  <span className="material-symbols-outlined text-[15px]">table_rows</span>
                  Table
                </button>
                <button
                  onClick={() => setViewMode('card')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'card' ? 'text-white shadow-sm' : 'text-[#45464d] hover:text-[#0b1c30]'}`}
                  style={{ border: 'none', cursor: 'pointer', background: viewMode === 'card' ? TEAL : 'none' }}
                >
                  <span className="material-symbols-outlined text-[15px]">grid_view</span>
                  Cards
                </button>
              </div>

              <button
                onClick={() => setPrioritySort(p => !p)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all"
                style={{
                  background: prioritySort ? '#d97706' : 'white',
                  color: prioritySort ? 'white' : '#45464d',
                  borderColor: prioritySort ? '#d97706' : '#e2e8f0',
                  cursor: 'pointer',
                }}
              >
                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                Priority
              </button>

              <button
                onClick={() => navigate('/crm/import-export')}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-[#e2e8f0] text-[#45464d] text-sm font-semibold rounded-full hover:bg-[#f8f9ff] transition-all"
                style={{ cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined text-[16px]">upload_file</span>
                Import Leads
              </button>

              <button
                onClick={() => { setShowCreate(true); setFormErrors([]); }}
                className="flex items-center gap-1.5 px-5 py-2 text-white text-sm font-semibold rounded-full transition-all hover:opacity-90 shadow-sm"
                style={{ background: TEAL, border: 'none', cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Create Lead
              </button>
            </div>
          </div>

          {/* ── Filter bar ── */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#45464d] opacity-50 text-[18px]">search</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search lead name, company or ID..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-[#e2e8f0] rounded-full text-sm text-[#0b1c30] outline-none transition-all"
                style={{ fontFamily: 'Inter, sans-serif' }}
              />
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-white border border-[#e2e8f0] rounded-full text-sm text-[#45464d] outline-none cursor-pointer"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              <option value="">All Statuses</option>
              {['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST'].map(s => (
                <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
              ))}
            </select>

            <select
              value={ownerIdParam}
              onChange={e => { const p = new URLSearchParams(searchParams); if (e.target.value) p.set('ownerId', e.target.value); else p.delete('ownerId'); setSearchParams(p); }}
              className="px-4 py-2 bg-white border border-[#e2e8f0] rounded-full text-sm text-[#45464d] outline-none cursor-pointer"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              <option value="">All Owners</option>
              {crmUsers.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
            </select>

            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="px-4 py-2 bg-white border border-[#e2e8f0] rounded-full text-sm text-[#45464d] outline-none cursor-pointer"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              <option value="">All Sources</option>
              {['WEBSITE', 'REFERRAL', 'COLD_CALL', 'TRADE_SHOW', 'LINKEDIN', 'ADVERTISEMENT', 'PARTNER', 'OTHER'].map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>

            <div className="ml-auto flex items-center gap-2">
              <button className="p-2 bg-white border border-[#e2e8f0] rounded-full text-[#45464d] hover:bg-[#f8f9ff] transition-all" style={{ background: 'white', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                <span className="material-symbols-outlined text-[18px]">tune</span>
              </button>
              <button className="p-2 bg-white border border-[#e2e8f0] rounded-full text-[#45464d] hover:bg-[#f8f9ff] transition-all" style={{ background: 'white', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                <span className="material-symbols-outlined text-[18px]">download</span>
              </button>
            </div>
          </div>

          {/* Active filter badge */}
          {filterParam && (
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-white border border-[#e2e8f0] text-[#45464d]">
                <span className="material-symbols-outlined text-sm">{filterParam === 'stale' ? 'hourglass_empty' : 'event_repeat'}</span>
                {filterParam === 'followup' ? 'Follow-ups Due Today & Overdue' : 'Stale Leads (7+ days inactive)'}
              </span>
              <button onClick={clearFilterParam} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#45464d' }}>
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          )}

          {/* ── Table / Card view ── */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm mb-5">
            {viewMode === 'table' && (
              loading ? (
                <CrmTableSkeleton rows={6} cols={11} />
              ) : displayedLeads.length === 0 ? (
                <div className="p-8">
                  <EmptyState icon="lightbulb" title="No leads yet" description="Create your first lead to start tracking potential customers." action={{ label: 'Create Lead', onClick: () => setShowCreate(true) }} />
                </div>
              ) : (
                <LeadsTable
                  leads={displayedLeads}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onSelectAll={selectAll}
                  onClearSelection={clearSelection}
                  onEdit={openEdit}
                  onDelete={(lead) => { setDeleteItem(lead); setShowDelete(true); }}
                  onStatusChange={handleStatusChange}
                  isAllSelected={displayedLeads.length > 0 && displayedLeads.every(l => selectedIds.has(l.id))}
                  user={user}
                />
              )
            )}

            {viewMode === 'card' && (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? [0,1,2,3,4,5].map(i => <CrmCardSkeleton key={i} />) :
                  displayedLeads.length === 0 ? (
                    <div className="col-span-full">
                      <EmptyState icon="lightbulb" title="No leads yet" description="Create your first lead to start tracking potential customers." action={{ label: 'Create Lead', onClick: () => setShowCreate(true) }} />
                    </div>
                  ) : displayedLeads.map(lead => {
                    const st = STATUS_STYLES[lead.status] || STATUS_STYLES.NEW;
                    const badge = getUrgencyBadge(lead);
                    const followUpOverdue = lead.followUpDate && isOverdue(lead.followUpDate) && !isToday(lead.followUpDate);
                    const isSelected = selectedIds.has(lead.id);
                    return (
                      <div
                        key={lead.id}
                        className={`bg-white border rounded-xl p-5 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${isSelected ? 'border-[#006a61] ring-2 ring-[#86f2e4]' : 'border-[#e2e8f0] hover:border-[#006a61]'}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(lead.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded cursor-pointer"
                              style={{ accentColor: TEAL }}
                            />
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: st.bg, color: st.text }}>
                              <span className="material-symbols-outlined text-[11px]">{st.icon}</span>
                              {lead.status.replace(/_/g, ' ')}
                            </span>
                            {badge && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: badge.bg, color: badge.text }}>
                                <span className="material-symbols-outlined text-[11px]">{badge.icon}</span>{badge.label}
                              </span>
                            )}
                            {lead.aiScore != null && (() => {
                              const s = scoreStyle(lead.aiScore!);
                              return (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: s.bg, color: s.text }} title={lead.aiScoreReason ?? ''}>
                                  <span className="material-symbols-outlined text-[11px]">auto_awesome</span>
                                  {lead.aiScore}/100
                                </span>
                              );
                            })()}
                          </div>
                          <span className="text-[11px] text-[#45464d] opacity-60">{formatDate(lead.createdAt)}</span>
                        </div>

                        <h3 className="text-sm font-bold text-[#0b1c30] mb-2 line-clamp-2 hover:text-[#006a61] cursor-pointer" onClick={() => navigate(`/crm/leads/${lead.id}`)}>{lead.title}</h3>

                        {(lead.contactName || lead.companyName) && (
                          <div className="text-xs text-[#45464d] opacity-70 mb-1">
                            {lead.contactName && <span>{lead.contactName}</span>}
                            {lead.contactName && lead.companyName && <span> · </span>}
                            {lead.companyName && <span className="font-medium">{lead.companyName}</span>}
                          </div>
                        )}

                        {lead.followUpDate && (
                          <div className="flex items-center gap-1.5 text-xs mt-1" style={{ color: followUpOverdue ? '#ba1a1a' : '#45464d' }}>
                            <span className="material-symbols-outlined text-[13px]">event</span>
                            <span className={followUpOverdue ? 'font-bold' : ''}>{formatShortDate(lead.followUpDate)}</span>
                            {lead.followUpNote && (
                              <span className="opacity-60 truncate max-w-[140px]" title={lead.followUpNote}>— {lead.followUpNote}</span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#e2e8f0]">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold" style={{ color: TEAL, fontFamily: 'JetBrains Mono, monospace' }}>{formatCurrency(lead.estimatedValue)}</span>
                            <button onClick={(e) => { e.stopPropagation(); openEdit(lead); }} className="text-xs font-semibold transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEAL }}>Edit</button>
                            {hasPermission(user, 'crm:delete') && (
                              <button onClick={(e) => { e.stopPropagation(); setDeleteItem(lead); setShowDelete(true); }} className="text-xs font-semibold transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ba1a1a' }}>
                                <span className="material-symbols-outlined text-sm align-middle">delete</span>
                              </button>
                            )}
                          </div>
                          {lead.owner && (
                            <div className="flex items-center gap-1.5">
                              {lead.owner.avatarUrl ? (
                                <img src={lead.owner.avatarUrl} alt={lead.owner.firstName} className="w-5 h-5 rounded-full object-cover" />
                              ) : (
                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: TEAL }}>
                                  {lead.owner.firstName?.[0]}{lead.owner.lastName?.[0]}
                                </div>
                              )}
                              <span className="text-[11px] text-[#45464d] opacity-70">{lead.owner.firstName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mb-5">
            <p className="text-[12px] text-[#45464d] opacity-70">
              Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} leads
            </p>
            {pagination.totalPages > 1 && (
              <div className="flex gap-1">
                {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => fetchLeads(p)}
                    className="w-8 h-8 rounded-lg text-sm font-semibold transition-colors"
                    style={{ border: p === pagination.page ? 'none' : '1px solid #e2e8f0', cursor: 'pointer', background: p === pagination.page ? TEAL : 'white', color: p === pagination.page ? 'white' : '#45464d' }}
                  >{p}</button>
                ))}
              </div>
            )}
          </div>

          {/* ── Bottom stats bar ── */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: TEAL_LIGHT }}>
                <span className="material-symbols-outlined text-[18px]" style={{ color: TEAL }}>person_add</span>
              </div>
              <div>
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#45464d] opacity-70">New Leads Today</p>
                <p className="text-[22px] font-bold text-[#0b1c30] leading-tight">+{statsBar.todayLeads}</p>
              </div>
            </div>
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: TEAL_LIGHT }}>
                <span className="material-symbols-outlined text-[18px]" style={{ color: TEAL }}>percent</span>
              </div>
              <div>
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#45464d] opacity-70">Conversion Rate</p>
                <p className="text-[22px] font-bold leading-tight" style={{ color: TEAL }}>{statsBar.convRate}%</p>
              </div>
            </div>
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#ffdad6' }}>
                <span className="material-symbols-outlined text-[18px]" style={{ color: '#ba1a1a' }}>event_repeat</span>
              </div>
              <div>
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#45464d] opacity-70">Pending Follow-Ups</p>
                <p className="text-[22px] font-bold text-[#0b1c30] leading-tight">{statsBar.pendingFollowUps}</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Bulk Action Bar ── */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={displayedLeads.length}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        actions={bulkActions}
        loading={bulkProcessing}
      />

      {/* Bulk owner select */}
      {showBulkOwnerSelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowBulkOwnerSelect(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#0b1c30] mb-4">Assign Owner</h3>
            <select className={inputCls()} defaultValue="" onChange={(e) => { if (e.target.value) handleBulkAssignOwner(e.target.value); }}>
              <option value="" disabled>Select new owner</option>
              {crmUsers.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
            </select>
            <button onClick={() => setShowBulkOwnerSelect(false)} className="mt-4 w-full px-4 py-2 text-sm text-[#45464d] hover:text-[#0b1c30]" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Bulk status select */}
      {showBulkStatusSelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowBulkStatusSelect(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#0b1c30] mb-4">Change Status</h3>
            <select className={inputCls()} defaultValue="" onChange={(e) => { if (e.target.value) handleBulkChangeStatus(e.target.value); }}>
              <option value="" disabled>Select new status</option>
              {(['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST'] as LeadStatus[]).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            <button onClick={() => setShowBulkStatusSelect(false)} className="mt-4 w-full px-4 py-2 text-sm text-[#45464d]" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Bulk toast */}
      {bulkToast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg text-white text-sm font-semibold flex items-center gap-2 shadow-lg" style={{ background: TEAL }}>
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          {bulkToast}
        </div>
      )}

      {/* ── Create Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowCreate(false); setDuplicateWarning(null); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#e2e8f0]">
              <h2 className="text-lg font-bold text-[#0b1c30]">New Lead</h2>
              <button onClick={() => { setShowCreate(false); setDuplicateWarning(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-outlined text-[#45464d]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {[
                { label: 'Lead Title *', field: 'title', type: 'text', required: true },
                { label: 'Contact Name', field: 'contactName', type: 'text' },
                { label: 'Contact Email', field: 'contactEmail', type: 'email', onBlur: (e: any) => checkDuplicateLead('contactEmail', e.target.value) },
                { label: 'Contact Phone', field: 'contactPhone', type: 'text', onBlur: (e: any) => checkDuplicateLead('contactPhone', e.target.value) },
                { label: 'Company Name', field: 'companyName', type: 'text' },
              ].map(({ label, field, type, required, onBlur }) => (
                <div key={field}>
                  <label className="block text-[12px] font-semibold text-[#0b1c30] mb-1">{label}</label>
                  <input
                    required={required}
                    type={type}
                    value={(form as any)[field] || ''}
                    onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
                    onBlur={onBlur}
                    className={inputCls(formErrors.some(e => e.field === field))}
                  />
                  {formErrors.some(e => e.field === field) && (
                    <p className="text-xs mt-1" style={{ color: '#ba1a1a' }}>{formErrors.find(e => e.field === field)?.message}</p>
                  )}
                </div>
              ))}
              <div>
                <label className="block text-[12px] font-semibold text-[#0b1c30] mb-1">Owner</label>
                <select value={form.ownerId || ''} onChange={e => setForm(prev => ({ ...prev, ownerId: e.target.value || undefined }))} className={inputCls()}>
                  <option value="">Myself (default)</option>
                  {crmUsers.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#0b1c30] mb-1">Source</label>
                <select value={form.source || 'OTHER'} onChange={e => setForm(prev => ({ ...prev, source: e.target.value as LeadSource }))} className={inputCls()}>
                  {['WEBSITE','REFERRAL','COLD_CALL','TRADE_SHOW','LINKEDIN','ADVERTISEMENT','PARTNER','OTHER'].map(s => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#0b1c30] mb-1">Estimated Value (MYR)</label>
                <input type="number" value={form.estimatedValue || ''} onChange={e => setForm(prev => ({ ...prev, estimatedValue: Number(e.target.value) }))} className={inputCls(formErrors.some(e => e.field === 'estimatedValue'))} />
                {formErrors.some(e => e.field === 'estimatedValue') && (
                  <p className="text-xs mt-1" style={{ color: '#ba1a1a' }}>{formErrors.find(e => e.field === 'estimatedValue')?.message}</p>
                )}
              </div>
              {duplicateWarning && (
                <div className="flex items-start gap-2 p-3 rounded-lg border text-sm" style={{ background: '#ffdad6', borderColor: '#ba1a1a', color: '#ba1a1a' }}>
                  <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">warning</span>
                  <div className="flex-1">{duplicateWarning}</div>
                  <button type="button" onClick={() => setDuplicateWarning(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); setDuplicateWarning(null); }} className="px-5 py-2 rounded-full text-sm font-semibold border border-[#e2e8f0] text-[#45464d] hover:bg-[#f8f9ff]" style={{ background: 'white', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 rounded-full text-sm font-semibold text-white disabled:opacity-50" style={{ background: TEAL, border: 'none', cursor: 'pointer' }}>
                  {saving ? 'Creating...' : 'Create Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {showEdit && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={closeEdit}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#e2e8f0]">
              <h2 className="text-lg font-bold text-[#0b1c30]">Edit Lead</h2>
              <button onClick={closeEdit} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-outlined text-[#45464d]">close</span>
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              {[
                { label: 'Lead Title *', field: 'title', type: 'text', required: true },
                { label: 'Contact Name', field: 'contactName', type: 'text' },
                { label: 'Contact Email', field: 'contactEmail', type: 'email', onBlur: (e: any) => checkDuplicateLead('contactEmail', e.target.value) },
                { label: 'Contact Phone', field: 'contactPhone', type: 'text', onBlur: (e: any) => checkDuplicateLead('contactPhone', e.target.value) },
                { label: 'Company Name', field: 'companyName', type: 'text' },
              ].map(({ label, field, type, required, onBlur }) => (
                <div key={field}>
                  <label className="block text-[12px] font-semibold text-[#0b1c30] mb-1">{label}</label>
                  <input
                    required={required}
                    type={type}
                    value={(form as any)[field] || ''}
                    onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
                    onBlur={onBlur}
                    className={inputCls(formErrors.some(e => e.field === field))}
                  />
                  {formErrors.some(e => e.field === field) && (
                    <p className="text-xs mt-1" style={{ color: '#ba1a1a' }}>{formErrors.find(e => e.field === field)?.message}</p>
                  )}
                </div>
              ))}
              <div>
                <label className="block text-[12px] font-semibold text-[#0b1c30] mb-1">Owner</label>
                <select value={form.ownerId || ''} onChange={e => setForm(prev => ({ ...prev, ownerId: e.target.value || undefined }))} className={inputCls()}>
                  <option value="">Myself (default)</option>
                  {crmUsers.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#0b1c30] mb-1">Source</label>
                <select value={form.source || 'OTHER'} onChange={e => setForm(prev => ({ ...prev, source: e.target.value as LeadSource }))} className={inputCls()}>
                  {['WEBSITE','REFERRAL','COLD_CALL','TRADE_SHOW','LINKEDIN','ADVERTISEMENT','PARTNER','OTHER'].map(s => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#0b1c30] mb-1">Estimated Value (MYR)</label>
                <input type="number" value={form.estimatedValue || ''} onChange={e => setForm(prev => ({ ...prev, estimatedValue: Number(e.target.value) }))} className={inputCls(formErrors.some(e => e.field === 'estimatedValue'))} />
                {formErrors.some(e => e.field === 'estimatedValue') && (
                  <p className="text-xs mt-1" style={{ color: '#ba1a1a' }}>{formErrors.find(e => e.field === 'estimatedValue')?.message}</p>
                )}
              </div>
              {duplicateWarning && (
                <div className="flex items-start gap-2 p-3 rounded-lg border text-sm" style={{ background: '#ffdad6', borderColor: '#ba1a1a', color: '#ba1a1a' }}>
                  <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">warning</span>
                  <div className="flex-1">{duplicateWarning}</div>
                  <button type="button" onClick={() => setDuplicateWarning(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeEdit} className="px-5 py-2 rounded-full text-sm font-semibold border border-[#e2e8f0] text-[#45464d] hover:bg-[#f8f9ff]" style={{ background: 'white', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 rounded-full text-sm font-semibold text-white disabled:opacity-50" style={{ background: TEAL, border: 'none', cursor: 'pointer' }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showDelete}
        title="Delete Lead"
        message={`Are you sure you want to delete "${deleteItem?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => { setShowDelete(false); setDeleteItem(null); }}
        loading={deleting}
      />
    </>
  );
};

export default CrmLeads;
