import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import DateInput from '../src/components/crm/DateInput';
import { useCrmUpdate } from '../src/hooks/useCrmUpdate';
import { hasPermission } from '../src/utils/permissions';
import { useAuth } from '../src/context/AuthContext';
import {
  STATUS_STYLES,
  ALL_STATUSES,
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
  const [exporting, setExporting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const forceCreateRef = useRef(false);
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

  const hotLeads = useMemo(() =>
    leads.filter(l => (l.aiScore ?? 0) >= 80 && l.status !== 'CONVERTED' && l.status !== 'LOST').slice(0, 5),
  [leads]);

  const followUpsToday = useMemo(() =>
    leads.filter(l => l.followUpDate && isToday(l.followUpDate)),
  [leads]);

  const overdueLeads = useMemo(() =>
    leads.filter(l => l.followUpDate && isOverdue(l.followUpDate) && !isToday(l.followUpDate)),
  [leads]);

  const convertedCount = useMemo(() =>
    leads.filter(l => l.status === 'CONVERTED').length,
  [leads]);

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
    try {
      setSaving(true);
      await crmService.createLead(payload, forceCreateRef.current);
      forceCreateRef.current = false;
      setShowCreate(false); setForm({}); setFormErrors([]); setDuplicateWarning(null); fetchLeads();
    } catch (e: any) {
      const status = e?.response?.status ?? e?.status;
      const matchData = e?.response?.data?.data?.match;
      if (status === 409 && matchData) {
        const m = matchData;
        const fields = (m.matchFields || []).join(', ');
        setDuplicateWarning(`Duplicate lead detected: "${m.name || 'Unknown'}" (confidence ${Math.round(m.confidence * 100)}%, matched on ${fields}). Click "Save Lead" again to create anyway.`);
        forceCreateRef.current = true;
      } else {
        console.error(e);
        forceCreateRef.current = false;
      }
    } finally { setSaving(false); }
  };

  const handleExport = async () => {
    if (exporting) return;
    try {
      setExporting(true);
      const { jobId } = await crmService.requestExport('LEAD', {
        selectedIds: selectedIds.size > 0 ? Array.from(selectedIds) : undefined,
        search: search || undefined,
        status: statusFilter || undefined,
        source: sourceFilter || undefined,
        ownerId: ownerIdParam || undefined,
        filter: filterParam || undefined,
      }, 'XLSX');
      await crmService.downloadExport(jobId, 'XLSX');
    } catch (error) {
      console.error('Failed to export leads', error);
    } finally {
      setExporting(false);
    }
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
      followUpDate: lead.followUpDate ? lead.followUpDate.slice(0, 10) : '',
      followUpNote: lead.followUpNote ?? '',
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
    const normalizedForm = {
      ...form,
      contactEmail: typeof form.contactEmail === 'string' ? form.contactEmail.trim() : form.contactEmail,
    };
    const errors = validateLead(normalizedForm);
    if (errors.length > 0) { setFormErrors(errors); return; }
    const payload = cleanFormPayload(normalizedForm as Record<string, any>, NUMERIC_KEYS.lead);
    delete payload.status;
    // Send null when follow-up date was cleared but previously had a value
    if (form.followUpDate === '' && editingItem.followUpDate) payload.followUpDate = null;
    if (form.followUpNote === '' && editingItem.followUpNote) payload.followUpNote = null;
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

          {/* ── Header ── Kinetic Enterprise design ── */}
          <div className="flex justify-between items-end mb-8">
            <div>
              <nav className="flex items-center gap-2 mb-2" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#45464d' }}>
                <Link to="/crm" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-[#006a61] transition-colors">CRM</Link>
                <span style={{ color: '#45464d', opacity: 0.4 }}>›</span>
                <span style={{ color: '#006a61', fontWeight: 700 }}>Leads</span>
              </nav>
              <h1 style={{ fontSize: 36, fontWeight: 700, lineHeight: '44px', letterSpacing: '-0.02em', color: '#0b1c30', fontFamily: 'Inter, sans-serif' }}>
                My Leads
                {ownerIdParam && (
                  <span className="ml-3 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: TEAL_LIGHT, color: TEAL }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>person</span>
                    {crmUsers.find(u => u.id === ownerIdParam)?.firstName ?? 'Owner'}&apos;s leads
                    <button onClick={() => { searchParams.delete('ownerId'); setSearchParams(searchParams); }} className="ml-0.5" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
                  </span>
                )}
              </h1>
              <p style={{ fontSize: 14, color: '#45464d', marginTop: 4, fontFamily: 'Inter, sans-serif' }}>Managing your lending pipeline and retail applications.</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchLeads(pagination.page)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#e2e8f0] text-[#45464d] text-[13px] font-semibold rounded-lg hover:bg-[#eff4ff] transition-all"
                style={{ cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
                Refresh
              </button>

              {/* View toggle */}
              <div className="flex items-center bg-white border border-[#e2e8f0] rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('table')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'table' ? 'text-white shadow-sm' : 'text-[#45464d] hover:text-[#0b1c30]'}`}
                  style={{ border: 'none', cursor: 'pointer', background: viewMode === 'table' ? TEAL : 'none' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>table_rows</span>
                  Table
                </button>
                <button
                  onClick={() => setViewMode('card')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'card' ? 'text-white shadow-sm' : 'text-[#45464d] hover:text-[#0b1c30]'}`}
                  style={{ border: 'none', cursor: 'pointer', background: viewMode === 'card' ? TEAL : 'none' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>grid_view</span>
                  Cards
                </button>
              </div>

              <button
                onClick={() => setPrioritySort(p => !p)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all"
                style={{
                  background: prioritySort ? '#d97706' : 'white',
                  color: prioritySort ? 'white' : '#45464d',
                  borderColor: prioritySort ? '#d97706' : '#e2e8f0',
                  cursor: 'pointer',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
                Priority
              </button>

              <button
                onClick={() => navigate('/crm/import-export')}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#e2e8f0] text-[#45464d] text-[13px] font-semibold rounded-lg hover:bg-[#eff4ff] transition-all"
                style={{ cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>upload_file</span>
                Import Leads
              </button>

              <button
                onClick={() => { setShowCreate(true); setFormErrors([]); }}
                className="flex items-center gap-2 px-5 py-2.5 text-white text-[13px] font-bold rounded-lg transition-all hover:opacity-90 shadow-sm"
                style={{ background: TEAL, border: 'none', cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>person_add</span>
                New Lead
              </button>
            </div>
          </div>

          {/* ── 5-Card Metrics Row ── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <div className="bg-white p-4 border border-[#e2e8f0] rounded-lg hover:border-[#006a61] hover:-translate-y-0.5 transition-all duration-200 cursor-default">
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#45464d' }}>My Leads</p>
              <p style={{ fontSize: 24, fontWeight: 600, color: '#0b1c30', fontFamily: 'Inter, sans-serif', marginTop: 4 }}>{pagination.total}</p>
            </div>
            <div className="bg-white p-4 border-l-4 border-l-[#ba1a1a] border-y border-r border-[#e2e8f0] rounded-lg hover:-translate-y-0.5 transition-all duration-200 cursor-default">
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#ba1a1a' }}>Hot Leads</p>
              <p style={{ fontSize: 24, fontWeight: 600, color: '#ba1a1a', fontFamily: 'Inter, sans-serif', marginTop: 4 }}>{hotLeads.length}</p>
            </div>
            <div className="bg-white p-4 border border-[#e2e8f0] rounded-lg hover:border-[#006a61] hover:-translate-y-0.5 transition-all duration-200 cursor-default">
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#45464d' }}>Follow Ups Today</p>
              <p style={{ fontSize: 24, fontWeight: 600, color: '#0b1c30', fontFamily: 'Inter, sans-serif', marginTop: 4 }}>{followUpsToday.length}</p>
            </div>
            <div className="bg-[#ffdad6] p-4 border border-[#ba1a1a]/20 rounded-lg hover:-translate-y-0.5 transition-all duration-200 cursor-default">
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#93000a' }}>Overdue</p>
              <p style={{ fontSize: 24, fontWeight: 600, color: '#93000a', fontFamily: 'Inter, sans-serif', marginTop: 4 }}>{overdueLeads.length}</p>
            </div>
            <div className="bg-[#86f2e4] p-4 border border-[#006a61]/20 rounded-lg hover:-translate-y-0.5 transition-all duration-200 cursor-default">
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#006f66' }}>Converted</p>
              <p style={{ fontSize: 24, fontWeight: 600, color: '#006f66', fontFamily: 'Inter, sans-serif', marginTop: 4 }}>{convertedCount}</p>
            </div>
          </div>

          {/* ── Main View ── */}
          <div className="space-y-6">

              {/* ── Filter bar — Kinetic Enterprise card ── */}
              <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-sm flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[280px]">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#45464d] text-[20px]">search</span>
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search lead name, company or ID..."
                      className="w-full pl-10 pr-4 py-2 bg-[#eff4ff] border border-[#e2e8f0] rounded-lg text-sm text-[#0b1c30] outline-none transition-all focus:ring-2 focus:ring-[#006a61]/20 focus:border-[#006a61]"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                    />
                  </div>
                </div>
                <div className="flex flex-col">
                  <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#45464d', marginBottom: 4, display: 'block' }}>Status</label>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-white border border-[#e2e8f0] rounded-lg text-sm text-[#45464d] outline-none cursor-pointer min-w-[140px] focus:ring-2 focus:ring-[#006a61]/20 focus:border-[#006a61]"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    <option value="">All Statuses</option>
                    {['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST'].map(s => (
                      <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#45464d', marginBottom: 4, display: 'block' }}>Owner</label>
                  <select
                    value={ownerIdParam}
                    onChange={e => { const p = new URLSearchParams(searchParams); if (e.target.value) p.set('ownerId', e.target.value); else p.delete('ownerId'); setSearchParams(p); }}
                    className="px-3 py-2 bg-white border border-[#e2e8f0] rounded-lg text-sm text-[#45464d] outline-none cursor-pointer min-w-[140px] focus:ring-2 focus:ring-[#006a61]/20 focus:border-[#006a61]"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    <option value="">All Owners</option>
                    {crmUsers.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#45464d', marginBottom: 4, display: 'block' }}>Source</label>
                  <select
                    value={sourceFilter}
                    onChange={e => setSourceFilter(e.target.value)}
                    className="px-3 py-2 bg-white border border-[#e2e8f0] rounded-lg text-sm text-[#45464d] outline-none cursor-pointer min-w-[140px] focus:ring-2 focus:ring-[#006a61]/20 focus:border-[#006a61]"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    <option value="">All Sources</option>
                    {['WEBSITE', 'REFERRAL', 'COLD_CALL', 'TRADE_SHOW', 'LINKEDIN', 'ADVERTISEMENT', 'PARTNER', 'WHATSAPP', 'OTHER'].map(s => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-2 pt-4">
                  <button className="p-2 text-[#45464d] hover:bg-[#eff4ff] rounded-lg transition-colors" style={{ background: 'none', border: '1px solid #e2e8f0', cursor: 'pointer' }} title="More Filters">
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>filter_list</span>
                  </button>
                  <button onClick={handleExport} disabled={exporting} className="p-2 text-[#45464d] hover:bg-[#eff4ff] rounded-lg transition-colors disabled:opacity-50" style={{ background: 'none', border: '1px solid #e2e8f0', cursor: exporting ? 'wait' : 'pointer' }} title={exporting ? 'Exporting...' : 'Export'} aria-label={exporting ? 'Exporting leads' : 'Export leads'}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{exporting ? 'progress_activity' : 'download'}</span>
                  </button>
                </div>
              </div>

              {/* Active filter badge */}
              {filterParam && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-white border border-[#e2e8f0] text-[#45464d]">
                    <span className="material-symbols-outlined text-sm">{filterParam === 'stale' ? 'hourglass_empty' : 'event_repeat'}</span>
                    {filterParam === 'followup' ? 'Follow-ups Due Today & Overdue' : 'Stale Leads (7+ days inactive)'}
                  </span>
                  <button onClick={clearFilterParam} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#45464d' }}>
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              )}

              {/* ── HOT LEADS ── */}
              {hotLeads.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#ba1a1a]" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                      <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0b1c30', fontFamily: 'Inter, sans-serif' }}>Hot Leads</h2>
                    </div>
                    <button onClick={() => { setPrioritySort(true); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: TEAL, fontWeight: 700, fontSize: 13 }} className="hover:underline">View All</button>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                    {hotLeads.map(lead => {
                      const initials = lead.title.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                      const followUpDisplay = lead.followUpDate
                        ? isOverdue(lead.followUpDate) && !isToday(lead.followUpDate) ? { text: 'Overdue', color: '#ba1a1a' }
                        : isToday(lead.followUpDate) ? { text: 'Call Today', color: '#ba1a1a' }
                        : { text: formatShortDate(lead.followUpDate), color: '#45464d' }
                        : { text: 'No follow-up set', color: '#76777d' };
                      return (
                        <div key={lead.id} className="min-w-[300px] bg-white border border-[#e2e8f0] rounded-lg p-5 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
                          <div className="absolute top-0 left-0 w-1 h-full bg-[#ba1a1a]" />
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="font-bold text-[16px] text-[#0b1c30] line-clamp-1 cursor-pointer hover:text-[#006a61]" onClick={() => navigate(`/crm/leads/${lead.id}`)}>{lead.title}</h3>
                              <p style={{ fontSize: 13, color: '#45464d' }}>{lead.companyName || lead.source?.replace(/_/g, ' ') || 'Lead'}</p>
                            </div>
                            <div className="bg-[#ffdad6] text-[#93000a] px-2 py-1 rounded font-bold" style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace' }}>
                              Score: {lead.aiScore}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#45464d' }}>Amount</p>
                              <p className="font-bold text-[#0b1c30]" style={{ fontSize: 14 }}>{formatCurrency(lead.estimatedValue)}</p>
                            </div>
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#45464d' }}>Next Action</p>
                              <p className="font-bold" style={{ color: followUpDisplay.color, fontSize: 14 }}>{followUpDisplay.text}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => navigate(`/crm/leads/${lead.id}`)} className="flex-1 bg-[#006a61] text-white py-2 rounded font-bold text-[13px] flex items-center justify-center gap-2 hover:opacity-90 transition-opacity" style={{ border: 'none', cursor: 'pointer' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>visibility</span> View
                            </button>
                            <button onClick={() => openEdit(lead)} className="w-10 bg-[#eff4ff] flex items-center justify-center rounded hover:bg-[#dce9ff] transition-colors" style={{ border: 'none', cursor: 'pointer' }}>
                              <span className="material-symbols-outlined text-[#0b1c30]" style={{ fontSize: 18 }}>edit</span>
                            </button>
                            <button onClick={() => navigate(`/crm/leads/${lead.id}`)} className="w-10 bg-[#eff4ff] flex items-center justify-center rounded hover:bg-[#dce9ff] transition-colors" style={{ border: 'none', cursor: 'pointer' }}>
                              <span className="material-symbols-outlined text-[#0b1c30]" style={{ fontSize: 18 }}>open_in_new</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ── TODAY'S FOLLOW-UPS ── */}
              {followUpsToday.length > 0 && (
                <section className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-[#e2e8f0] flex justify-between items-center bg-[#eff4ff]">
                    <h2 className="font-bold text-[16px] text-[#0b1c30]">Today's Follow Ups</h2>
                    <span className="bg-[#006a61]/10 text-[#006a61] px-2 py-0.5 rounded" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>{followUpsToday.length} Tasks</span>
                  </div>
                  <div className="divide-y divide-[#e2e8f0]">
                    {followUpsToday.slice(0, 6).map(lead => {
                      const initials = lead.title.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                      return (
                        <div key={lead.id} className="p-4 flex items-center gap-4 hover:bg-[#f8f9ff] transition-colors group">
                          <input className="h-5 w-5 rounded border-[#e2e8f0] accent-[#006a61] cursor-pointer" type="checkbox" />
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: '#86f2e4', color: '#006f66' }}>{initials}</div>
                          <div className="flex-1 grid grid-cols-4 items-center gap-4">
                            <div>
                              <p className="font-bold text-[#0b1c30] text-[14px] cursor-pointer hover:text-[#006a61]" onClick={() => navigate(`/crm/leads/${lead.id}`)}>{lead.title}</p>
                              <p style={{ fontSize: 13, color: '#45464d' }}>{lead.companyName || lead.source?.replace(/_/g, ' ') || 'Lead'}</p>
                            </div>
                            <div className="text-center">
                              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#45464d' }}>Follow-up</p>
                              <p className="text-[14px] font-medium text-[#0b1c30]">Today</p>
                            </div>
                            <div className="text-center">
                              <span className="bg-[#eff4ff] text-[#0b1c30] px-3 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', border: '1px solid #e2e8f0' }}>Follow-up Call</span>
                            </div>
                            <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEdit(lead)} className="text-[#006a61] hover:underline font-bold" style={{ fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>Edit</button>
                              <button onClick={() => navigate(`/crm/leads/${lead.id}`)} className="text-[#45464d] hover:text-[#0b1c30] material-symbols-outlined" style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer' }}>visibility</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
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

          {/* Pagination — Kinetic Enterprise style */}
          <div className="flex items-center justify-between py-4 px-6 mt-0 rounded-xl border border-[#e2e8f0] shadow-sm" style={{ background: '#eff4ff' }}>
            <p className="text-[13px]" style={{ color: '#45464d' }}>
              Showing <span className="font-bold" style={{ color: '#0b1c30' }}>{((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-bold" style={{ color: '#0b1c30' }}>{pagination.total}</span> leads
            </p>
            {pagination.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => pagination.page > 1 && fetchLeads(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="w-8 h-8 flex items-center justify-center rounded border border-[#e2e8f0] hover:bg-white transition-colors disabled:opacity-50"
                  style={{ background: 'white', cursor: pagination.page > 1 ? 'pointer' : 'default', color: '#45464d' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
                </button>
                {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => fetchLeads(p)}
                    className="w-8 h-8 flex items-center justify-center rounded text-xs font-bold transition-colors"
                    style={{ border: p === pagination.page ? 'none' : '1px solid #e2e8f0', cursor: 'pointer', background: p === pagination.page ? TEAL : 'white', color: p === pagination.page ? 'white' : '#45464d' }}
                  >{p}</button>
                ))}
                <button
                  onClick={() => pagination.page < pagination.totalPages && fetchLeads(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded border border-[#e2e8f0] hover:bg-white transition-colors disabled:opacity-50"
                  style={{ background: 'white', cursor: pagination.page < pagination.totalPages ? 'pointer' : 'default', color: '#45464d' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
                </button>
              </div>
            )}
          </div>

          </div>{/* ── End Main View ── */}

        </div>
      </div>

      {/* ── Bulk Action Bar ── */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={displayedLeads.length}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        actions={bulkActions}
        selectedIds={Array.from(selectedIds)}
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

      {/* ── Create Modal — Kinetic Enterprise design ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={() => { setShowCreate(false); setDuplicateWarning(null); setFormErrors([]); forceCreateRef.current = false; }}>
          <div className="absolute inset-0 bg-[#213145]/40 backdrop-blur-sm" />
          <div className="relative bg-white w-full max-w-5xl max-h-[90vh] rounded-xl shadow-xl flex flex-col overflow-hidden border border-[#e2e8f0]/30" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-8 py-6 border-b border-[#e2e8f0] flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-[24px] font-semibold text-[#0b1c30]" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.01em' }}>Create New Lead</h2>
                <p className="text-[13px] text-[#45464d] mt-1">Capture essential lead information to begin the qualification workflow.</p>
              </div>
              <button onClick={() => { setShowCreate(false); setDuplicateWarning(null); setFormErrors([]); forceCreateRef.current = false; }} className="p-2 hover:bg-[#dce9ff] rounded-full text-[#45464d] transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Scrollable form body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
              <form id="leadCreateForm" onSubmit={handleCreate} className="space-y-10">
                {/* Section: Lead Information */}
                <section>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 bg-[#d3e4fe] rounded-lg flex items-center justify-center text-[#006a61]">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>person_add</span>
                    </div>
                    <h3 className="text-[18px] font-semibold text-[#0b1c30]" style={{ fontFamily: 'Inter, sans-serif' }}>Lead Information</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Title *</label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. Tan Boon Wah — SME Loan Inquiry"
                        value={form.title || ''}
                        onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                        className={inputCls(formErrors.some(e => e.field === 'title'))}
                      />
                      {formErrors.some(e => e.field === 'title') && (
                        <p className="text-xs" style={{ color: '#ba1a1a' }}>{formErrors.find(e => e.field === 'title')?.message}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Organization / Company</label>
                      <input
                        type="text"
                        placeholder="e.g. Acme FinTech Sdn Bhd (leave blank if individual)"
                        value={form.companyName || ''}
                        onChange={e => setForm(prev => ({ ...prev, companyName: e.target.value }))}
                        className={inputCls(formErrors.some(e => e.field === 'companyName'))}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Contact Name</label>
                      <input
                        type="text"
                        placeholder="e.g. John Doe"
                        value={form.contactName || ''}
                        onChange={e => setForm(prev => ({ ...prev, contactName: e.target.value }))}
                        className={inputCls()}
                      />
                    </div>
                  </div>
                </section>

                {/* Section: Contact Details */}
                <section>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 bg-[#d3e4fe] rounded-lg flex items-center justify-center text-[#006a61]">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>contact_mail</span>
                    </div>
                    <h3 className="text-[18px] font-semibold text-[#0b1c30]" style={{ fontFamily: 'Inter, sans-serif' }}>Contact Details</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Email Address</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-3 flex items-center text-[#76777d]">
                          <span className="material-symbols-outlined text-[18px]">mail</span>
                        </span>
                        <input
                          type="email"
                          placeholder="john.doe@company.com"
                          value={form.contactEmail || ''}
                          onChange={e => { setForm(prev => ({ ...prev, contactEmail: e.target.value })); setFormErrors(errors => errors.filter(error => error.field !== 'contactEmail')); }}
                          onBlur={e => checkDuplicateLead('contactEmail', e.target.value)}
                          className={`pl-10 w-full border border-[#e2e8f0] rounded-lg p-2.5 focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61] outline-none transition-all text-[14px] ${formErrors.some(e => e.field === 'contactEmail') ? 'border-[#ba1a1a] focus:ring-[#ba1a1a]/20' : ''}`}
                          style={{ fontFamily: 'Inter, sans-serif' }}
                        />
                      </div>
                      {formErrors.some(e => e.field === 'contactEmail') && (
                        <p className="text-xs" style={{ color: '#ba1a1a' }}>{formErrors.find(e => e.field === 'contactEmail')?.message}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Mobile Number</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-3 flex items-center text-[#76777d]">
                          <span className="material-symbols-outlined text-[18px]">phone</span>
                        </span>
                        <input
                          type="tel"
                          placeholder="+60 1X-XXX XXXX"
                          value={form.contactPhone || ''}
                          onChange={e => setForm(prev => ({ ...prev, contactPhone: e.target.value }))}
                          onBlur={e => checkDuplicateLead('contactPhone', e.target.value)}
                          className="pl-10 w-full border border-[#e2e8f0] rounded-lg p-2.5 focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61] outline-none transition-all text-[14px]"
                          style={{ fontFamily: 'Inter, sans-serif' }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Owner</label>
                      <select
                        value={form.ownerId || ''}
                        onChange={e => setForm(prev => ({ ...prev, ownerId: e.target.value || undefined }))}
                        className={inputCls()}
                      >
                        <option value="">Myself (default)</option>
                        {crmUsers.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                      </select>
                    </div>
                  </div>
                </section>

                {/* Section: Lead Source & Qualification */}
                <section>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 bg-[#d3e4fe] rounded-lg flex items-center justify-center text-[#006a61]">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
                    </div>
                    <h3 className="text-[18px] font-semibold text-[#0b1c30]" style={{ fontFamily: 'Inter, sans-serif' }}>Lead Source & Qualification</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Lead Source</label>
                        <select value={form.source || 'OTHER'} onChange={e => setForm(prev => ({ ...prev, source: e.target.value as LeadSource }))} className={inputCls()}>
                          {['WEBSITE','REFERRAL','COLD_CALL','TRADE_SHOW','LINKEDIN','ADVERTISEMENT','PARTNER','WHATSAPP','OTHER'].map(s => (
                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Status</label>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: STATUS_STYLES[form.status || 'NEW']?.bg || STATUS_STYLES.NEW.bg, border: `2px solid ${STATUS_STYLES[form.status || 'NEW']?.text || STATUS_STYLES.NEW.text}` }} />
                          <select
                            value={form.status || 'NEW'}
                            onChange={e => setForm(prev => ({ ...prev, status: e.target.value as LeadStatus }))}
                            className="flex-1 border border-[#e2e8f0] rounded-lg p-2.5 focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61] outline-none transition-all text-[14px] bg-white"
                            style={{ fontFamily: 'Inter, sans-serif' }}
                          >
                            {ALL_STATUSES.map(s => (
                              <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Estimated Value (MYR)</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-3 flex items-center text-[#0b1c30] font-bold text-xs">RM</span>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={form.estimatedValue || ''}
                            onChange={e => setForm(prev => ({ ...prev, estimatedValue: Number(e.target.value) }))}
                            className="pl-10 w-full border border-[#e2e8f0] rounded-lg p-2.5 focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61] outline-none transition-all text-[14px]"
                            style={{ fontFamily: 'Inter, sans-serif' }}
                          />
                        </div>
                        {formErrors.some(e => e.field === 'estimatedValue') && (
                          <p className="text-xs" style={{ color: '#ba1a1a' }}>{formErrors.find(e => e.field === 'estimatedValue')?.message}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Follow-Up Date</label>
                        <DateInput
                          value={form.followUpDate ? form.followUpDate.slice(0, 10) : ''}
                          onChange={value => setForm(prev => ({ ...prev, followUpDate: value || undefined }))}
                          className="border border-[#e2e8f0] rounded-lg p-2.5 focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61] outline-none transition-all text-[14px]"
                          style={{ fontFamily: 'Inter, sans-serif' }}
                        />
                      </div>
                    </div>
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Follow-Up Note</label>
                      <input
                        type="text"
                        placeholder="e.g. Call back to discuss financing requirements"
                        value={form.followUpNote || ''}
                        onChange={e => setForm(prev => ({ ...prev, followUpNote: e.target.value || undefined }))}
                        className="border border-[#e2e8f0] rounded-lg p-2.5 focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61] outline-none transition-all text-[14px]"
                        style={{ fontFamily: 'Inter, sans-serif' }}
                      />
                    </div>
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Qualification Notes</label>
                      <p className="text-[11px] text-[#45464d] opacity-60">Supports markdown — use **bold**, - bullets, 1. numbering, or line breaks for formatting.</p>
                      <textarea
                        placeholder="Add details regarding the business model, credit history highlights, or specific financing requirements..."
                        rows={5}
                        value={form.description || ''}
                        onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                        className="border border-[#e2e8f0] rounded-lg p-2.5 focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61] outline-none transition-all text-[14px] resize-vertical"
                        style={{ fontFamily: 'Inter, sans-serif' }}
                      />
                    </div>
                  </div>
                </section>

                {/* Duplicate warning */}
                {duplicateWarning && (
                  <div className="flex items-start gap-2 p-3 rounded-lg border text-sm" style={{ background: '#ffdad6', borderColor: '#ba1a1a', color: '#ba1a1a' }}>
                    <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">warning</span>
                    <div className="flex-1">{duplicateWarning}</div>
                    <button type="button" onClick={() => setDuplicateWarning(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                )}
              </form>
            </div>

            {/* Footer */}
            <div className="px-8 py-5 border-t border-[#e2e8f0] bg-[#eff4ff] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2 text-[#45464d]">
                <span className="material-symbols-outlined text-[18px]">info</span>
                <span className="text-[13px] italic">Mandatory fields are marked with an asterisk (*)</span>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => { setShowCreate(false); setDuplicateWarning(null); setFormErrors([]); forceCreateRef.current = false; }} className="px-6 py-2.5 border border-[#e2e8f0] rounded-lg text-[#45464d] font-semibold hover:bg-[#dce9ff] transition-colors" style={{ background: 'white', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" form="leadCreateForm" disabled={saving} className="px-6 py-2.5 bg-[#006a61] text-white rounded-lg font-semibold hover:opacity-90 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50" style={{ border: 'none', cursor: 'pointer' }}>
                  <span className="material-symbols-outlined text-[20px]">save</span>
                  {saving ? 'Saving...' : 'Save Lead'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal — Kinetic Enterprise design ── */}
      {showEdit && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={closeEdit}>
          <div className="absolute inset-0 bg-[#213145]/40 backdrop-blur-sm" />
          <div className="relative bg-white w-full max-w-5xl max-h-[90vh] rounded-xl shadow-xl flex flex-col overflow-hidden border border-[#e2e8f0]/30" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-8 py-6 border-b border-[#e2e8f0] flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-[24px] font-semibold text-[#0b1c30]" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.01em' }}>Edit Lead</h2>
                <p className="text-[13px] text-[#45464d] mt-1">Update lead details and qualification information.</p>
              </div>
              <button onClick={closeEdit} className="p-2 hover:bg-[#dce9ff] rounded-full text-[#45464d] transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Scrollable form body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
              <form id="leadEditForm" onSubmit={handleEdit} className="space-y-10">
                {/* Section: Lead Information */}
                <section>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 bg-[#d3e4fe] rounded-lg flex items-center justify-center text-[#006a61]">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>person_add</span>
                    </div>
                    <h3 className="text-[18px] font-semibold text-[#0b1c30]" style={{ fontFamily: 'Inter, sans-serif' }}>Lead Information</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Title *</label>
                      <input required type="text" value={form.title || ''} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} className={inputCls(formErrors.some(e => e.field === 'title'))} />
                      {formErrors.some(e => e.field === 'title') && <p className="text-xs" style={{ color: '#ba1a1a' }}>{formErrors.find(e => e.field === 'title')?.message}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Organization / Company</label>
                      <input type="text" placeholder="Leave blank if individual" value={form.companyName || ''} onChange={e => setForm(prev => ({ ...prev, companyName: e.target.value }))} className={inputCls()} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Contact Name</label>
                      <input type="text" value={form.contactName || ''} onChange={e => setForm(prev => ({ ...prev, contactName: e.target.value }))} className={inputCls()} />
                    </div>
                  </div>
                </section>

                {/* Section: Contact Details */}
                <section>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 bg-[#d3e4fe] rounded-lg flex items-center justify-center text-[#006a61]">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>contact_mail</span>
                    </div>
                    <h3 className="text-[18px] font-semibold text-[#0b1c30]" style={{ fontFamily: 'Inter, sans-serif' }}>Contact Details</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Email Address</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-3 flex items-center text-[#76777d]">
                          <span className="material-symbols-outlined text-[18px]">mail</span>
                        </span>
                        <input type="email" value={form.contactEmail || ''} onChange={e => setForm(prev => ({ ...prev, contactEmail: e.target.value }))} onBlur={e => checkDuplicateLead('contactEmail', e.target.value)} className={`pl-10 w-full border border-[#e2e8f0] rounded-lg p-2.5 focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61] outline-none transition-all text-[14px] ${formErrors.some(e => e.field === 'contactEmail') ? 'border-[#ba1a1a] focus:ring-[#ba1a1a]/20' : ''}`} style={{ fontFamily: 'Inter, sans-serif' }} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Phone</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-3 flex items-center text-[#76777d]">
                          <span className="material-symbols-outlined text-[18px]">phone</span>
                        </span>
                        <input type="tel" value={form.contactPhone || ''} onChange={e => setForm(prev => ({ ...prev, contactPhone: e.target.value }))} onBlur={e => checkDuplicateLead('contactPhone', e.target.value)} className="pl-10 w-full border border-[#e2e8f0] rounded-lg p-2.5 focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61] outline-none transition-all text-[14px]" style={{ fontFamily: 'Inter, sans-serif' }} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Owner</label>
                      <select value={form.ownerId || ''} onChange={e => setForm(prev => ({ ...prev, ownerId: e.target.value || undefined }))} className={inputCls()}>
                        <option value="">Myself (default)</option>
                        {crmUsers.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                      </select>
                    </div>
                  </div>
                </section>

                {/* Section: Lead Source & Qualification */}
                <section>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 bg-[#d3e4fe] rounded-lg flex items-center justify-center text-[#006a61]">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
                    </div>
                    <h3 className="text-[18px] font-semibold text-[#0b1c30]" style={{ fontFamily: 'Inter, sans-serif' }}>Lead Source & Qualification</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Lead Source</label>
                        <select value={form.source || 'OTHER'} onChange={e => setForm(prev => ({ ...prev, source: e.target.value as LeadSource }))} className={inputCls()}>
                          {['WEBSITE','REFERRAL','COLD_CALL','TRADE_SHOW','LINKEDIN','ADVERTISEMENT','PARTNER','WHATSAPP','OTHER'].map(s => (
                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Estimated Value (MYR)</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-3 flex items-center text-[#0b1c30] font-bold text-xs">RM</span>
                          <input type="number" placeholder="0.00" value={form.estimatedValue || ''} onChange={e => setForm(prev => ({ ...prev, estimatedValue: Number(e.target.value) }))} className="pl-10 w-full border border-[#e2e8f0] rounded-lg p-2.5 focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61] outline-none transition-all text-[14px]" style={{ fontFamily: 'Inter, sans-serif' }} />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Follow-Up Date</label>
                      <DateInput value={form.followUpDate ? form.followUpDate.slice(0, 10) : ''} onChange={value => setForm(prev => ({ ...prev, followUpDate: value || undefined }))} className="border border-[#e2e8f0] rounded-lg p-2.5 focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61] outline-none transition-all text-[14px]" style={{ fontFamily: 'Inter, sans-serif' }} />
                    </div>
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Follow-Up Note</label>
                      <input type="text" placeholder="e.g. Call back to discuss financing requirements" value={form.followUpNote || ''} onChange={e => setForm(prev => ({ ...prev, followUpNote: e.target.value || undefined }))} className="border border-[#e2e8f0] rounded-lg p-2.5 focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61] outline-none transition-all text-[14px]" style={{ fontFamily: 'Inter, sans-serif' }} />
                    </div>
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Qualification Notes</label>
                      <p className="text-[11px] text-[#45464d] opacity-60">Supports markdown — use **bold**, - bullets, 1. numbering, or line breaks for formatting.</p>
                      <textarea placeholder="Add details regarding the business model, credit history highlights, or specific financing requirements..." rows={5} value={form.description || ''} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} className="border border-[#e2e8f0] rounded-lg p-2.5 focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61] outline-none transition-all text-[14px] resize-vertical" style={{ fontFamily: 'Inter, sans-serif' }} />
                    </div>
                  </div>
                </section>

                {duplicateWarning && (
                  <div className="flex items-start gap-2 p-3 rounded-lg border text-sm" style={{ background: '#ffdad6', borderColor: '#ba1a1a', color: '#ba1a1a' }}>
                    <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">warning</span>
                    <div className="flex-1">{duplicateWarning}</div>
                    <button type="button" onClick={() => setDuplicateWarning(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                )}
              </form>
            </div>

            {/* Footer */}
            <div className="px-8 py-5 border-t border-[#e2e8f0] bg-[#eff4ff] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2 text-[#45464d]">
                <span className="material-symbols-outlined text-[18px]">info</span>
                <span className="text-[13px] italic">Mandatory fields are marked with an asterisk (*)</span>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={closeEdit} className="px-6 py-2.5 border border-[#e2e8f0] rounded-lg text-[#45464d] font-semibold hover:bg-[#dce9ff] transition-colors" style={{ background: 'white', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" form="leadEditForm" disabled={saving} className="px-6 py-2.5 bg-[#006a61] text-white rounded-lg font-semibold hover:opacity-90 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50" style={{ border: 'none', cursor: 'pointer' }}>
                  <span className="material-symbols-outlined text-[20px]">save</span>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
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
