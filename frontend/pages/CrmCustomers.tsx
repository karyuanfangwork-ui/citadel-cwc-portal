import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CrmKpiCard from '@/src/components/crm/CrmKpiCard';
import HealthRing from '@/src/components/crm/HealthRing';
import CustomerNameCell, { type Segment } from '@/src/components/crm/CustomerNameCell';
import BulkActionBar, { type BulkAction } from '@/src/components/crm/BulkActionBar';
import { formatCurrency } from '@/src/components/crm/crmConstants';
import crmService from '@/src/services/crm.service';
import api from '@/src/services/api';

/* ── Types ─────────────────────────────────────────────────────── */

interface CustomerRow {
  id: string;
  type: 'account' | 'contact';
  name: string;
  segment: Segment;
  segmentLabel: string;
  contactInfo: { phone: string | null; email: string | null };
  relationshipMgr: { id: string; firstName: string; lastName: string } | null;
  opptyCount: number;
  pipelineValue: number;
  health: number;
  lastActivity: string | null;
  nextFollowUp: { label: string; overdue: boolean };
  isActive: boolean;
  createdAt: string;
}

interface CustomerStats {
  total: number;
  retail: number;
  sme: number;
  corporate: number;
  active: number;
  followUpRequired: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type TabKey = 'all' | 'mine' | 'active' | 'follow-up' | 'open-opp';

const TAB_CONFIG: Record<TabKey, { label: string; tooltip: string }> = {
  all: { label: 'Team Clients', tooltip: 'All clients visible to you and your team' },
  mine: { label: 'Managed by Me', tooltip: 'Clients where you are the assigned Relationship Manager' },
  active: { label: 'Active', tooltip: 'Clients with active status' },
  'follow-up': { label: 'Overdue Follow-Ups', tooltip: 'Contacts with past-due follow-up dates' },
  'open-opp': { label: 'Open Opportunities', tooltip: 'Clients with at least one open opportunity' },
};

const PAGE_SIZE = 25;

/* ── Helpers ────────────────────────────────────────────────────── */

const formatLastActivity = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const compactCurrency = (val: number) =>
  new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', notation: 'compact', maximumFractionDigits: 1 }).format(val);

const mgrInitials = (mgr: CustomerRow['relationshipMgr']) => {
  if (!mgr) return '—';
  return (mgr.firstName[0] + mgr.lastName[0]).toUpperCase();
};

/* ── Avatar color hash ─────────────────────────────────────────── */
const AVATAR_COLORS = ['#006a61', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#ef4444'];
const avatarColor = (id: string) => AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];

/* ── Component ─────────────────────────────────────────────────── */

const CrmCustomers: React.FC = () => {
  const navigate = useNavigate();

  // Data
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [tab, setTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'account' | 'contact'>('account');

  /* ── Fetch data ─────────────────────────────────────────────── */

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/crm/customers', {
        params: { page, limit: PAGE_SIZE, tab, search: search || undefined },
      });
      setCustomers(res.data.data.customers);
      setPagination(res.data.data.pagination);
    } catch (err) {
      console.error('Failed to fetch clients', err);
    } finally {
      setLoading(false);
    }
  }, [page, tab, search]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/crm/customers/stats');
      setStats(res.data.data);
    } catch (err) {
      console.error('Failed to fetch client stats', err);
    }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  /* ── Search debounce ──────────────────────────────────────── */
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  /* ── Selection ────────────────────────────────────────────── */
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === customers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(customers.map(c => c.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  /* ── Row click ────────────────────────────────────────────── */
  const handleRowClick = (c: CustomerRow) => {
    navigate(c.type === 'account' ? `/crm/accounts/${c.id}` : `/crm/contacts/${c.id}`);
  };

  /* ── Pagination ───────────────────────────────────────────── */
  const pageNumbers = (): (number | string)[] => {
    const { totalPages } = pagination;
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | string)[] = [1];
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
    return pages;
  };

  /* ── Bulk actions ─────────────────────────────────────────── */
  const bulkActions: BulkAction[] = [
    {
      label: 'Delete',
      icon: 'delete',
      variant: 'danger',
      onClick: async (ids: string[]) => {
        for (const id of ids) {
          const c = customers.find(x => x.id === id);
          if (!c) continue;
          if (c.type === 'account') await crmService.deleteAccount(id);
          else await crmService.deleteContact(id);
        }
        clearSelection();
        fetchCustomers();
        fetchStats();
      },
    },
  ];

  /* ── Create modal state ──────────────────────────────────── */
  const [createAccountData, setCreateAccountData] = useState({ name: '', industry: '', phone: '', email: '', website: '' });
  const [createContactData, setCreateContactData] = useState({ firstName: '', lastName: '', email: '', phone: '', mobile: '', accountId: '' });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');

  const handleCreate = async () => {
    setCreateSubmitting(true);
    setCreateError('');
    try {
      if (createType === 'account') {
        await crmService.createAccount(createAccountData as any);
      } else {
        await crmService.createContact(createContactData as any);
      }
      setShowCreateModal(false);
      setCreateAccountData({ name: '', industry: '', phone: '', email: '', website: '' });
      setCreateContactData({ firstName: '', lastName: '', email: '', phone: '', mobile: '', accountId: '' });
      fetchCustomers();
      fetchStats();
    } catch (err: any) {
      setCreateError(err?.response?.data?.message || 'Failed to create');
    } finally {
      setCreateSubmitting(false);
    }
  };

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <div className="space-y-6" style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#45464d] mb-1">
            <span className="material-symbols-outlined text-lg">group</span>
            <span className="text-[11px] font-bold tracking-widest uppercase">CRM</span>
            <span className="text-[11px] text-[#45464d]/40">›</span>
            <span className="text-[11px] font-bold tracking-widest uppercase text-[#006a61]">Clients</span>
          </div>
          <h2 className="text-[36px] font-bold text-[#0b1c30] leading-tight">Client Management</h2>
          <p className="text-[#45464d] text-sm">Manage and maintain client relationships.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchCustomers(); fetchStats(); }}
            className="flex items-center gap-2 px-4 py-2 border border-[#e2e8f0] hover:bg-[#eff4ff] transition-colors rounded text-sm font-medium"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            Refresh
          </button>
          <button onClick={() => navigate('/crm/import-export?entity=ACCOUNT')} className="flex items-center gap-2 px-4 py-2 border border-[#e2e8f0] hover:bg-[#eff4ff] transition-colors rounded text-sm font-medium">
            <span className="material-symbols-outlined text-lg">file_upload</span>
            Import
          </button>
          <button onClick={() => navigate('/crm/import-export?entity=ACCOUNT&tab=export')} className="flex items-center gap-2 px-4 py-2 border border-[#e2e8f0] hover:bg-[#eff4ff] transition-colors rounded text-sm font-medium">
            <span className="material-symbols-outlined text-lg">file_download</span>
            Export
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2 bg-[#006a61] text-white hover:opacity-90 transition-opacity rounded font-medium shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            New Client
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <CrmKpiCard label="Total Clients" value={stats.total.toLocaleString()} icon="groups" trendPercent={4} />
          <CrmKpiCard label="Retail" value={stats.retail.toLocaleString()} icon="person" />
          <CrmKpiCard label="SME" value={stats.sme.toLocaleString()} icon="business_center" />
          <CrmKpiCard label="Corporate" value={stats.corporate.toLocaleString()} icon="apartment" />
          <CrmKpiCard label="Active" value={stats.active.toLocaleString()} icon="check_circle" />
          <CrmKpiCard label="Overdue Follow-ups" value={stats.followUpRequired.toLocaleString()} icon="notification_important" highlight />
        </div>
      )}

      {/* Tab scope context */}
      {tab !== 'all' && (
        <div className="flex items-center gap-2 text-sm text-[#45464d] bg-[#eff4ff]/60 border border-[#e2e8f0] rounded-lg px-4 py-2">
          <span className="material-symbols-outlined text-base text-[#006a61]">info</span>
          <span>
            Showing <span className="font-semibold text-[#0b1c30]">{pagination.total.toLocaleString()}</span> of <span className="font-semibold text-[#0b1c30]">{stats?.total.toLocaleString() ?? '—'}</span> team clients filtered by <span className="font-semibold text-[#006a61]">{TAB_CONFIG[tab].label}</span>
          </span>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Tabs + Search */}
        <div className="px-6 py-3 border-b border-[#e2e8f0] flex flex-col lg:flex-row justify-between gap-4 bg-[#eff4ff]/50">
          <div className="flex items-center gap-6 overflow-x-auto">
            {(Object.keys(TAB_CONFIG) as TabKey[]).map(key => (
              <button
                key={key}
                onClick={() => { setTab(key); setPage(1); }}
                title={TAB_CONFIG[key].tooltip}
                className={`px-1 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  tab === key
                    ? 'text-[#006a61] font-bold'
                    : 'text-[#45464d] hover:text-[#0b1c30]'
                }`}
                style={tab === key ? { boxShadow: 'inset 0 -2px 0 0 #006a61' } : undefined}
              >
                {TAB_CONFIG[key].label}
                {key === 'follow-up' && stats?.followUpRequired ? (
                  <span className="ml-2 bg-[#ba1a1a] text-white text-[10px] px-1.5 py-0.5 rounded-full">
                    {stats.followUpRequired}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#76777d] text-xl">filter_list</span>
              <input
                className="pl-10 pr-4 py-2 border border-[#e2e8f0] bg-white rounded-lg w-72 focus:ring-1 focus:ring-[#006a61] focus:border-[#006a61] text-sm outline-none"
                placeholder="Search client, company, or ID..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Bulk Action Bar */}
        <BulkActionBar
          selectedCount={selectedIds.size}
          totalCount={customers.length}
          onSelectAll={toggleSelectAll}
          onClearSelection={clearSelection}
          actions={bulkActions}
          selectedIds={Array.from(selectedIds)}
        />

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1400px]">
            <thead>
              <tr className="bg-[#e5eeff] border-b border-[#e2e8f0]">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === customers.length && customers.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-[#c6c6cd]"
                  />
                </th>
                <th className="px-6 py-3 text-[11px] font-bold tracking-widest uppercase text-[#45464d]">Client Name</th>
                <th className="px-4 py-3 text-[11px] font-bold tracking-widest uppercase text-[#45464d] text-center">Segment</th>
                <th className="px-4 py-3 text-[11px] font-bold tracking-widest uppercase text-[#45464d]">Contact Info</th>
                <th className="px-4 py-3 text-[11px] font-bold tracking-widest uppercase text-[#45464d]">Relationship Mgr</th>
                <th className="px-4 py-3 text-[11px] font-bold tracking-widest uppercase text-[#45464d] text-center">Oppty</th>
                <th className="px-4 py-3 text-[11px] font-bold tracking-widest uppercase text-[#45464d]">Pipeline Value</th>
                <th className="px-4 py-3 text-[11px] font-bold tracking-widest uppercase text-[#45464d] text-center">Health</th>
                <th className="px-4 py-3 text-[11px] font-bold tracking-widest uppercase text-[#45464d]">Last Activity</th>
                <th className="px-4 py-3 text-[11px] font-bold tracking-widest uppercase text-[#45464d]">Next Follow-up</th>
                <th className="px-6 py-3 text-[11px] font-bold tracking-widest uppercase text-[#45464d] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {loading ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-[#45464d]">
                    <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
                    <div className="mt-2 text-sm">Loading clients...</div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-[#45464d]">
                    <span className="material-symbols-outlined text-4xl mb-2 block">group_off</span>
                    <div className="text-sm">No clients found.</div>
                  </td>
                </tr>
              ) : (
                customers.map(c => (
                  <tr
                    key={`${c.type}-${c.id}`}
                    className={`hover:bg-[#f8f9ff] transition-colors cursor-pointer ${
                      selectedIds.has(c.id) ? 'bg-[#86f2e4]/10' : ''
                    }`}
                    onClick={() => handleRowClick(c)}
                  >
                    <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="rounded border-[#c6c6cd]"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <CustomerNameCell name={c.name} type={c.type} segment={c.segment} />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-sm font-medium">{c.segmentLabel}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm">{c.contactInfo.phone || '—'}</div>
                      <div className="text-[11px] text-[#45464d]">{c.contactInfo.email || ''}</div>
                    </td>
                    <td className="px-4 py-4">
                      {c.relationshipMgr ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white shrink-0"
                            style={{ backgroundColor: avatarColor(c.relationshipMgr.id) }}
                          >
                            {mgrInitials(c.relationshipMgr)}
                          </div>
                          <span className="text-sm">{c.relationshipMgr.firstName} {c.relationshipMgr.lastName}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-[#45464d]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="font-[JetBrains_Mono] text-sm">{c.opptyCount}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-[JetBrains_Mono] text-sm">{compactCurrency(c.pipelineValue)}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <HealthRing score={c.health} />
                    </td>
                    <td className="px-4 py-4 text-sm text-[#45464d]">
                      {formatLastActivity(c.lastActivity)}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-sm font-medium ${c.nextFollowUp.overdue ? 'text-[#ba1a1a] font-bold' : 'text-[#006a61]'}`}>
                        {c.nextFollowUp.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {c.contactInfo.phone && (
                          <button
                            className="p-2 hover:bg-[#dce9ff] rounded text-[#45464d] transition-colors"
                            title="Call"
                          >
                            <span className="material-symbols-outlined text-lg">call</span>
                          </button>
                        )}
                        {c.contactInfo.phone && (
                          <button
                            className="p-2 hover:bg-[#dce9ff] rounded text-[#45464d] transition-colors"
                            title="WhatsApp"
                          >
                            <span className="material-symbols-outlined text-lg">chat</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleRowClick(c)}
                          className="flex items-center gap-1 px-3 py-1.5 border border-[#e2e8f0] hover:bg-[#0b1c30] hover:text-white rounded text-xs font-medium transition-all"
                          title="Open 360 View"
                        >
                          360 View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-[#e2e8f0] flex items-center justify-between bg-[#eff4ff]/30">
          <div className="text-sm text-[#45464d]">
            Showing <span className="font-medium text-[#0b1c30]">{Math.min((page - 1) * PAGE_SIZE + 1, pagination.total)}-{Math.min(page * PAGE_SIZE, pagination.total)}</span> of <span className="font-medium text-[#0b1c30]">{pagination.total.toLocaleString()}</span> clients
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 border border-[#e2e8f0] rounded hover:bg-[#dce9ff] transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">chevron_left</span>
            </button>
            {pageNumbers().map((p, i) =>
              typeof p === 'string' ? (
                <span key={`dots-${i}`} className="px-1 text-[#45464d]">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded text-xs transition-colors ${
                    page === p
                      ? 'bg-[#006a61] text-white font-medium'
                      : 'hover:bg-[#dce9ff]'
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="p-2 border border-[#e2e8f0] rounded hover:bg-[#dce9ff] transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Create Client Modal ──────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#0b1c30]">New Client</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-[#eff4ff] rounded">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Type Toggle */}
            <div className="px-6 pt-4">
              <div className="flex border border-[#e2e8f0] rounded-lg overflow-hidden">
                <button
                  onClick={() => setCreateType('account')}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    createType === 'account'
                      ? 'bg-[#006a61] text-white'
                      : 'bg-white text-[#45464d] hover:bg-[#eff4ff]'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm align-middle mr-1">business</span>
                  Account
                </button>
                <button
                  onClick={() => setCreateType('contact')}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    createType === 'contact'
                      ? 'bg-[#006a61] text-white'
                      : 'bg-white text-[#45464d] hover:bg-[#eff4ff]'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm align-middle mr-1">person</span>
                  Contact
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="px-6 py-4 space-y-4">
              {createError && (
                <div className="bg-[#ffdad6] text-[#ba1a1a] text-sm px-4 py-2 rounded">{createError}</div>
              )}

              {createType === 'account' ? (
                <>
                  <div>
                    <label className="block text-[11px] font-bold tracking-widest uppercase text-[#45464d] mb-1">Company Name *</label>
                    <input
                      className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#006a61] outline-none"
                      value={createAccountData.name}
                      onChange={e => setCreateAccountData(d => ({ ...d, name: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold tracking-widest uppercase text-[#45464d] mb-1">Industry</label>
                      <input
                        className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#006a61] outline-none"
                        value={createAccountData.industry}
                        onChange={e => setCreateAccountData(d => ({ ...d, industry: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold tracking-widest uppercase text-[#45464d] mb-1">Website</label>
                      <input
                        className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#006a61] outline-none"
                        value={createAccountData.website}
                        onChange={e => setCreateAccountData(d => ({ ...d, website: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold tracking-widest uppercase text-[#45464d] mb-1">Phone</label>
                      <input
                        className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#006a61] outline-none"
                        value={createAccountData.phone}
                        onChange={e => setCreateAccountData(d => ({ ...d, phone: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold tracking-widest uppercase text-[#45464d] mb-1">Email</label>
                      <input
                        className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#006a61] outline-none"
                        value={createAccountData.email}
                        onChange={e => setCreateAccountData(d => ({ ...d, email: e.target.value }))}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold tracking-widest uppercase text-[#45464d] mb-1">First Name *</label>
                      <input
                        className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#006a61] outline-none"
                        value={createContactData.firstName}
                        onChange={e => setCreateContactData(d => ({ ...d, firstName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold tracking-widest uppercase text-[#45464d] mb-1">Last Name *</label>
                      <input
                        className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#006a61] outline-none"
                        value={createContactData.lastName}
                        onChange={e => setCreateContactData(d => ({ ...d, lastName: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold tracking-widest uppercase text-[#45464d] mb-1">Email</label>
                    <input
                      className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#006a61] outline-none"
                      value={createContactData.email}
                      onChange={e => setCreateContactData(d => ({ ...d, email: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold tracking-widest uppercase text-[#45464d] mb-1">Phone</label>
                      <input
                        className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#006a61] outline-none"
                        value={createContactData.phone}
                        onChange={e => setCreateContactData(d => ({ ...d, phone: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold tracking-widest uppercase text-[#45464d] mb-1">Mobile</label>
                      <input
                        className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#006a61] outline-none"
                        value={createContactData.mobile}
                        onChange={e => setCreateContactData(d => ({ ...d, mobile: e.target.value }))}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#e2e8f0] flex justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-[#e2e8f0] rounded text-sm font-medium hover:bg-[#eff4ff] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={createSubmitting}
                className="px-5 py-2 bg-[#006a61] text-white rounded font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {createSubmitting ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrmCustomers;