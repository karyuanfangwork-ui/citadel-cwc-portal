import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import crmService, { CrmLead, CrmUser, Pagination, LeadStatus, LeadSource } from '../src/services/crm.service';
import CrmNav from '../src/components/CrmNav';
import { cleanFormPayload, NUMERIC_KEYS } from '../src/utils/crmFormHelper';
import ConfirmDialog from '../src/components/ConfirmDialog';
import { hasPermission } from '../src/utils/permissions';
import { useAuth } from '../src/context/AuthContext';

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  NEW: { bg: 'var(--color-it-50)', text: 'var(--color-it-500)', icon: 'fiber_new' },
  CONTACTED: { bg: 'var(--color-fin-50)', text: 'var(--color-warning)', icon: 'call' },
  QUALIFIED: { bg: 'var(--color-hr-50)', text: 'var(--color-success)', icon: 'verified' },
  UNQUALIFIED: { bg: 'rgba(220,38,38,0.06)', text: 'var(--color-danger)', icon: 'block' },
  CONVERTED: { bg: 'var(--color-hr-50)', text: 'var(--color-success)', icon: 'swap_horiz' },
  LOST: { bg: 'var(--color-surface-muted)', text: 'var(--color-text-secondary)', icon: 'cancel' },
};

// ── Activity type icons (including WHATSAPP & SITE_VISIT) ──────
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

const formatCurrency = (val: number | null) => val != null ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val) : '—';
const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const formatShortDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

// ── Urgency badge helpers ──────────────────────────────────────
const isToday = (d: string) => {
  const dt = new Date(d); const now = new Date();
  return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth() && dt.getDate() === now.getDate();
};
const isOverdue = (d: string) => new Date(d) < new Date(new Date().toDateString());
const isStale = (updatedAt: string) => {
  const diff = Date.now() - new Date(updatedAt).getTime();
  return diff > 7 * 24 * 60 * 60 * 1000; // > 7 days
};

type UrgencyBadge = { label: string; bg: string; text: string; icon: string } | null;

const getUrgencyBadge = (lead: CrmLead): UrgencyBadge => {
  if (lead.followUpDate) {
    if (isOverdue(lead.followUpDate) && !isToday(lead.followUpDate))
      return { label: 'Overdue', bg: 'rgba(220,38,38,0.06)', text: 'var(--color-danger)', icon: 'error' };
    if (isToday(lead.followUpDate))
      return { label: 'Due Today', bg: 'var(--color-fin-50)', text: 'var(--color-warning)', icon: 'schedule' };
  }
  // Stale: no activity in 7+ days and not closed
  if (isStale(lead.updatedAt) && lead.status !== 'CONVERTED' && lead.status !== 'LOST')
    return { label: 'Stale', bg: 'var(--color-surface-muted)', text: 'var(--color-text-secondary)', icon: 'hourglass_empty' };
  return null;
};

// AI score colour helper
const scoreStyle = (score: number) =>
  score >= 70
    ? { bg: 'var(--color-hr-50)', text: 'var(--color-success)' }
    : score >= 40
    ? { bg: 'var(--color-fin-50)', text: 'var(--color-warning)' }
    : { bg: 'rgba(220,38,38,0.06)', text: 'var(--color-danger)' };

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
        setDuplicateWarning(
          `Possible duplicate: "${matches[0].title}" (${matches[0].status}) already has this ${label}.`
        );
      } else {
        setDuplicateWarning(null);
      }
    } catch { setDuplicateWarning(null); }
  };

  // Fetch CRM team users for owner dropdown
  useEffect(() => {
    crmService.listCrmUsers().then(setCrmUsers).catch(() => {});
  }, []);

  const fetchLeads = useCallback(async (page = 1) => {
    try { setLoading(true);
      const stale = filterParam === 'stale';
      const followup = filterParam === 'followup';
      const data = await crmService.listLeads({ page, limit: 20, search: search || undefined, status: (stale || followup) ? undefined : (statusFilter || undefined), source: sourceFilter || undefined, stale: stale || undefined, followup: followup || undefined });
      setLeads(data.leads); setPagination(data.pagination);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [search, statusFilter, sourceFilter, filterParam]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // ── Apply client-side filters (server handles stale/followup) ──
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
    return result;
  }, [leads, prioritySort]);

  const clearFilterParam = () => {
    searchParams.delete('filter');
    setSearchParams(searchParams);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(form)) {
      if (v === '' || v === undefined || v === null) continue;
      if (k === 'estimatedValue') { payload[k] = Number(v); if (isNaN(payload[k])) delete payload[k]; }
      else payload[k] = v;
    }
    try { setSaving(true); await crmService.createLead(payload); setShowCreate(false); setForm({}); setDuplicateWarning(null); fetchLeads(); }
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
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const payload = cleanFormPayload(form as Record<string, any>, NUMERIC_KEYS.lead);
    // Never allow status change through the edit modal
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

  return (
    <>
      <CrmNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
            <Link to="/crm" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700 transition-colors">CRM</Link>
            <span>/</span><span className="font-semibold text-text-primary">Leads</span>
          </div>
          <h1 className="text-2xl font-black text-text-primary">Leads</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPrioritySort(p => !p)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
              prioritySort
                ? 'bg-warning text-white hover:bg-warning/90'
                : 'bg-surface border border-border text-text-secondary hover:bg-gray-100'
            }`}
            style={{ border: prioritySort ? 'none' : undefined, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            title={prioritySort ? 'Showing highest AI score first' : 'Sort by AI priority'}
          >
            <span className="material-symbols-outlined text-lg">auto_awesome</span>
            Priority
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            <span className="material-symbols-outlined text-lg">add</span> New Lead
          </button>
        </div>
      </div>

      {/* Status pills */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {['', 'NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${statusFilter === s ? 'bg-brand-700 text-white' : 'bg-surface-muted text-text-secondary hover:bg-gray-200'}`}
            style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Filter badge for URL-based filter */}
      {filterParam && (
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold" style={{
            background: filterParam === 'stale' ? 'var(--color-surface-muted)' : 'var(--color-fin-50)',
            color: filterParam === 'stale' ? 'var(--color-text-secondary)' : 'var(--color-warning)',
          }}>
            <span className="material-symbols-outlined text-sm">{filterParam === 'stale' ? 'hourglass_empty' : 'event_repeat'}</span>
            {filterParam === 'followup' ? 'Follow-ups Due Today & Overdue' : 'Stale Leads (7+ days inactive)'}
          </span>
          <button onClick={clearFilterParam} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }} className="text-sm hover:text-gray-900">
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-lg">search</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..."
            className="w-full pl-10 pr-4 py-2 bg-surface-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
        </div>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
          className="px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary outline-none cursor-pointer" style={{ fontFamily: 'var(--font-sans)' }}>
          <option value="">All Sources</option>
          {['WEBSITE','REFERRAL','COLD_CALL','TRADE_SHOW','LINKEDIN','ADVERTISEMENT','PARTNER','OTHER'].map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Lead cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? [0,1,2,3,4,5].map(i => (
          <div key={i} className="bg-surface border border-border rounded-xl p-5">
            <div style={{ height: 14, width: '70%', background: 'var(--color-border)', borderRadius: 4, marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ height: 10, width: '50%', background: 'var(--color-border)', borderRadius: 4, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ height: 10, width: '40%', background: 'var(--color-border)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        )) : displayedLeads.length === 0 ? (
          <div className="col-span-full text-center py-16 text-text-secondary">
            <span className="material-symbols-outlined text-5xl mb-3 block opacity-30">lightbulb</span>
            <p className="font-bold">No leads found</p>
            <p className="text-sm mt-1">
              {filterParam ? 'Try clearing the current filter' : 'Create your first lead to start tracking prospects'}
            </p>
          </div>
        ) : displayedLeads.map(lead => {
          const st = STATUS_STYLES[lead.status] || STATUS_STYLES.NEW;
          const badge = getUrgencyBadge(lead);
          const followUpOverdue = lead.followUpDate && isOverdue(lead.followUpDate) && !isToday(lead.followUpDate);
          return (
            <div key={lead.id} onClick={() => navigate(`/crm/leads/${lead.id}`)}
              className="bg-surface border border-border rounded-xl p-5 hover:shadow-md hover:border-brand-200 transition-all cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: st.bg, color: st.text }}>
                    <span className="material-symbols-outlined text-sm">{st.icon}</span>{lead.status.replace(/_/g, ' ')}
                  </span>
                  {badge && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: badge.bg, color: badge.text }}>
                      <span className="material-symbols-outlined text-sm">{badge.icon}</span>{badge.label}
                    </span>
                  )}
                  {/* AI Score badge (persisted from previous scoring) */}
                  {lead.aiScore != null && (() => {
                    const s = scoreStyle(lead.aiScore!);
                    return (
                      <span
                        className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: s.bg, color: s.text }}
                        title={lead.aiScoreReason ?? ''}
                      >
                        <span className="material-symbols-outlined text-sm">auto_awesome</span>
                        {lead.aiScore}/100
                      </span>
                    );
                  })()}
                </div>
                <span className="text-xs text-text-tertiary">{formatDate(lead.createdAt)}</span>
              </div>
              <h3 className="text-sm font-bold text-text-primary mb-2 line-clamp-2">{lead.title}</h3>
              {(lead.contactName || lead.companyName) && (
                <div className="text-xs text-text-secondary mb-1">
                  {lead.contactName && <span>{lead.contactName}</span>}
                  {lead.contactName && lead.companyName && <span> · </span>}
                  {lead.companyName && <span className="font-medium">{lead.companyName}</span>}
                </div>
              )}
              {lead.account && <div className="text-xs text-brand-700 font-medium mb-1">{lead.account.name}</div>}

              {/* Follow-up date row */}
              {lead.followUpDate && (
                <div className="flex items-center gap-1.5 text-xs mt-1" style={{ color: followUpOverdue ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                  <span className="material-symbols-outlined text-sm">event</span>
                  <span className={followUpOverdue ? 'font-bold' : ''}>
                    {formatShortDate(lead.followUpDate)}
                  </span>
                  {lead.followUpNote && (
                    <span className="text-text-tertiary truncate max-w-[140px]" title={lead.followUpNote}>
                      — {lead.followUpNote}
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-brand-600">{formatCurrency(lead.estimatedValue)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(lead); }}
                    className="text-xs text-brand-700 hover:text-brand-900 font-semibold transition-colors"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: 0 }}
                  >
                    Edit
                  </button>
                  {hasPermission(user, 'crm:delete') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteItem(lead); setShowDelete(true); }}
                      className="text-xs text-danger hover:text-red-700 font-semibold transition-colors"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: 0 }}
                    >
                      <span className="material-symbols-outlined text-sm align-middle">delete</span>
                      Delete
                    </button>
                  )}
                </div>
                {lead.owner && (
                  <div className="flex items-center gap-1.5">
                    {lead.owner.avatarUrl ? (
                      <img src={lead.owner.avatarUrl} alt={lead.owner.firstName} className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-brand-600">{lead.owner.firstName?.[0]}{lead.owner.lastName?.[0]}</span>
                      </div>
                    )}
                    <span className="text-xs text-text-tertiary">{lead.owner.firstName}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center mt-6 gap-1">
          {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => fetchLeads(p)} style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${p === pagination.page ? 'bg-brand-700 text-white' : 'bg-transparent text-text-secondary hover:bg-gray-100'}`}>{p}</button>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowCreate(false); setDuplicateWarning(null); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-extrabold text-text-primary">New Lead</h2>
              <button onClick={() => { setShowCreate(false); setDuplicateWarning(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><span className="material-symbols-outlined text-text-secondary">close</span></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Lead Title *</label>
                <input
                  required type="text"
                  value={(form as any).title || ''}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Contact Name</label>
                <input
                  type="text"
                  value={(form as any).contactName || ''}
                  onChange={e => setForm(prev => ({ ...prev, contactName: e.target.value }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Contact Email</label>
                <input
                  type="email"
                  value={(form as any).contactEmail || ''}
                  onChange={e => setForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                  onBlur={e => checkDuplicateLead('contactEmail', e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={(form as any).contactPhone || ''}
                  onChange={e => setForm(prev => ({ ...prev, contactPhone: e.target.value }))}
                  onBlur={e => checkDuplicateLead('contactPhone', e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Company Name</label>
                <input
                  type="text"
                  value={(form as any).companyName || ''}
                  onChange={e => setForm(prev => ({ ...prev, companyName: e.target.value }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Owner</label>
                <select value={(form as any).ownerId || ''} onChange={e => setForm(prev => ({ ...prev, ownerId: e.target.value || undefined }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none" style={{ fontFamily: 'var(--font-sans)' }}>
                  <option value="">Myself (default)</option>
                  {crmUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Source</label>
                <select value={(form as any).source || 'OTHER'} onChange={e => setForm(prev => ({ ...prev, source: e.target.value as LeadSource }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none" style={{ fontFamily: 'var(--font-sans)' }}>
                  {['WEBSITE','REFERRAL','COLD_CALL','TRADE_SHOW','LINKEDIN','ADVERTISEMENT','PARTNER','OTHER'].map(s => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Estimated Value (MYR)</label>
                <input type="number" value={(form as any).estimatedValue || ''} onChange={e => setForm(prev => ({ ...prev, estimatedValue: Number(e.target.value) }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                {duplicateWarning && (
                  <div className="flex-1 flex items-start gap-2 p-3 bg-warning/10 border border-warning rounded-lg text-sm text-warning">
                    <span className="material-symbols-outlined text-base shrink-0 mt-0.5">warning</span>
                    <div className="flex-1">{duplicateWarning}</div>
                    <button
                      type="button"
                      onClick={() => setDuplicateWarning(null)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      className="text-warning hover:text-warning shrink-0"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </div>
                )}
                <button type="button" onClick={() => { setShowCreate(false); setDuplicateWarning(null); }} className="px-5 py-2 rounded-lg text-sm font-bold text-text-secondary hover:bg-gray-100" style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 disabled:opacity-50" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Creating...' : 'Create Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={closeEdit}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-extrabold text-text-primary">Edit Lead</h2>
              <button onClick={closeEdit} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><span className="material-symbols-outlined text-text-secondary">close</span></button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Lead Title *</label>
                <input
                  required type="text"
                  value={(form as any).title || ''}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Contact Name</label>
                <input
                  type="text"
                  value={(form as any).contactName || ''}
                  onChange={e => setForm(prev => ({ ...prev, contactName: e.target.value }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Contact Email</label>
                <input
                  type="email"
                  value={(form as any).contactEmail || ''}
                  onChange={e => setForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                  onBlur={e => checkDuplicateLead('contactEmail', e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={(form as any).contactPhone || ''}
                  onChange={e => setForm(prev => ({ ...prev, contactPhone: e.target.value }))}
                  onBlur={e => checkDuplicateLead('contactPhone', e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Company Name</label>
                <input
                  type="text"
                  value={(form as any).companyName || ''}
                  onChange={e => setForm(prev => ({ ...prev, companyName: e.target.value }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Owner</label>
                <select value={(form as any).ownerId || ''} onChange={e => setForm(prev => ({ ...prev, ownerId: e.target.value || undefined }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none" style={{ fontFamily: 'var(--font-sans)' }}>
                  <option value="">Myself (default)</option>
                  {crmUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Source</label>
                <select value={(form as any).source || 'OTHER'} onChange={e => setForm(prev => ({ ...prev, source: e.target.value as LeadSource }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none" style={{ fontFamily: 'var(--font-sans)' }}>
                  {['WEBSITE','REFERRAL','COLD_CALL','TRADE_SHOW','LINKEDIN','ADVERTISEMENT','PARTNER','OTHER'].map(s => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Estimated Value (MYR)</label>
                <input type="number" value={(form as any).estimatedValue || ''} onChange={e => setForm(prev => ({ ...prev, estimatedValue: Number(e.target.value) }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                {duplicateWarning && (
                  <div className="flex-1 flex items-start gap-2 p-3 bg-warning/10 border border-warning rounded-lg text-sm text-warning">
                    <span className="material-symbols-outlined text-base shrink-0 mt-0.5">warning</span>
                    <div className="flex-1">{duplicateWarning}</div>
                    <button
                      type="button"
                      onClick={() => setDuplicateWarning(null)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      className="text-warning hover:text-warning shrink-0"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </div>
                )}
                <button type="button" onClick={closeEdit} className="px-5 py-2 rounded-lg text-sm font-bold text-text-secondary hover:bg-gray-100" style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
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