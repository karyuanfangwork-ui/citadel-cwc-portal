import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import creditService, {
  CreditApplication, ApplicationState, CreditProductType, Pagination,
  BorrowerProfile, dashboardApi, branchApi, Branch,
} from '../src/services/credit.service';
import CreditNav from '../src/components/CreditNav';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../src/utils/errorMessages';
import { sortApplications, type SortColumn, type SortDir } from '../src/utils/creditSort';
import { formatCurrency, formatDate, STATE_COLORS, STATE_LABELS, getSmartDefaults } from './credit/creditUtils';
import { useCollapsedColumns, CollapsedColumnPill, ColumnCollapseToggle } from '../src/components/CollapsibleKanbanColumn';

const KANBAN_COLUMNS: { key: string; label: string; states: ApplicationState[]; color: string }[] = [
  { key: 'pre-submission', label: 'Pre-Submission', states: ['DRAFT'], color: '#6366f1' },
  { key: 'kyc', label: 'KYC', states: ['SUBMITTED', 'KYC_REVIEW', 'KYC_APPROVED', 'KYC_REJECTED'], color: '#f59e0b' },
  { key: 'assessment', label: 'Assessment', states: ['UNDERWRITING', 'CREDIT_ASSESSMENT'], color: '#8b5cf6' },
  { key: 'decision', label: 'Decision', states: ['COMMITTEE_REVIEW', 'APPROVED', 'REJECTED'], color: '#f97316' },
  { key: 'post-decision', label: 'Post-Decision', states: ['OFFER', 'ACCEPTED'], color: '#06b6d4' },
  { key: 'active', label: 'Active', states: ['DISBURSED', 'ACTIVE', 'CLOSED', 'WITHDRAWN'], color: '#22c55e' },
];

const PRODUCT_TYPES: { value: CreditProductType; label: string }[] = [
  { value: 'TERM_LOAN', label: 'Term Loan' },
  { value: 'REVOLVING_CREDIT', label: 'Revolving Credit' },
  { value: 'TRADE_FINANCE', label: 'Trade Finance' },
  { value: 'PROJECT_FINANCE', label: 'Project Finance' },
  { value: 'SYNDICATED', label: 'Syndicated' },
  { value: 'BRIDGE_LOAN', label: 'Bridge Loan' },
  { value: 'OVERDRAFT', label: 'Overdraft' },
  { value: 'LETTER_OF_CREDIT', label: 'Letter of Credit' },
  { value: 'BANK_GUARANTEE', label: 'Bank Guarantee' },
];

const PRODUCT_LABELS: Record<string, string> = Object.fromEntries(PRODUCT_TYPES.map(p => [p.value, p.label]));

const CURRENCIES = ['MYR', 'USD', 'SGD', 'GBP', 'EUR', 'JPY', 'CNY', 'THB', 'IDR', 'AUD', 'HKD'] as const;

// §3.5e — Smart filter quick views
type QuickFilterKey = 'all' | 'mine' | 'pendingApproval' | 'overdueSla' | 'inCommittee' | 'offers';

const PENDING_APPROVAL_STATES: ApplicationState[] = ['SUBMITTED', 'KYC_REVIEW', 'UNDERWRITING', 'CREDIT_ASSESSMENT', 'COMMITTEE_REVIEW'];

const QUICK_FILTERS: { key: QuickFilterKey; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'apps' },
  { key: 'mine', label: 'My Applications', icon: 'person' },
  { key: 'pendingApproval', label: 'Pending Approval', icon: 'hourglass_top' },
  { key: 'overdueSla', label: 'Overdue SLA', icon: 'schedule' },
  { key: 'inCommittee', label: 'In Committee', icon: 'groups' },
  { key: 'offers', label: 'Offers', icon: 'description' },
];

function applyQuickFilter(apps: CreditApplication[], key: QuickFilterKey, currentUserId?: string): CreditApplication[] {
  if (key === 'all') return apps;
  return apps.filter(app => {
    const state = (app.state || app.status) as ApplicationState;
    switch (key) {
      case 'mine':
        return !!currentUserId && (app.rmId === currentUserId || app.analystId === currentUserId);
      case 'pendingApproval':
        return PENDING_APPROVAL_STATES.includes(state);
      case 'overdueSla':
        return getSLAInfo(app.createdAt, state).color === '#dc2626';
      case 'inCommittee':
        return state === 'COMMITTEE_REVIEW';
      case 'offers':
        return state === 'OFFER';
      default:
        return true;
    }
  });
}

function getSLAInfo(createdAt: string, state: ApplicationState): { text: string; color: string } {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  const slaMap: Partial<Record<ApplicationState, number>> = {
    DRAFT: 7, SUBMITTED: 3, KYC_REVIEW: 5, UNDERWRITING: 7, CREDIT_ASSESSMENT: 5,
    COMMITTEE_REVIEW: 3, OFFER: 5, ACCEPTED: 3,
  };
  const limit = slaMap[state];
  if (!limit) return { text: `${days}d`, color: '#6b7280' };
  const remaining = limit - days;
  if (remaining <= 0) return { text: 'Overdue', color: '#dc2626' };
  if (remaining <= 1) return { text: `${remaining}d left`, color: '#ea580c' };
  return { text: `${remaining}d left`, color: '#16a34a' };
}

function getSLAStrip(apps: CreditApplication[]) {
  let overdue = 0, urgent = 0, ok = 0;
  apps.forEach(app => {
    const state = (app.state || app.status) as ApplicationState;
    const info = getSLAInfo(app.createdAt, state);
    if (info.color === '#dc2626') overdue++;
    else if (info.color === '#ea580c') urgent++;
    else if (info.color === '#16a34a') ok++;
  });
  return { overdue, urgent, ok };
}

const CreditApplicationList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const borrowerFilter = searchParams.get('borrowerProfileId') || '';
  const initialQuickFilter = (searchParams.get('quickFilter') as QuickFilterKey) || 'all';

  const [applications, setApplications] = useState<CreditApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [productFilter, setProductFilter] = useState<string>('');
  const [stateFilter, setStateFilter] = useState<string>('');
  // §3.1 — Multi-branch support: branch filter dropdown
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [branches, setBranches] = useState<Branch[]>([]);
  // §3.5e — Smart filter quick views (mutually exclusive chips)
  const [quickFilter, setQuickFilterState] = useState<QuickFilterKey>(initialQuickFilter);
  const setQuickFilter = useCallback((key: QuickFilterKey) => {
    setQuickFilterState(key);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (key === 'all') next.delete('quickFilter');
      else next.set('quickFilter', key);
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Partial<CreditApplication>>({ currency: 'MYR' as any, productType: 'TERM_LOAN' });
  const [saving, setSaving] = useState(false);
  const [borrowerProfiles, setBorrowerProfiles] = useState<BorrowerProfile[]>([]);
  const [loadingBorrowers, setLoadingBorrowers] = useState(false);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const { isCollapsed, toggle: toggleCollapse } = useCollapsedColumns('credit-applications');
  const [sortCol, setSortCol] = useState<SortColumn>('sla');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [view, setView] = useState<'table' | 'kanban'>(() => {
    return (localStorage.getItem('credit-applications-view') as 'table' | 'kanban') ?? 'table';
  });

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const handleViewChange = (v: 'table' | 'kanban') => {
    setView(v);
    localStorage.setItem('credit-applications-view', v);
  };

  const quickFilteredApplications = applyQuickFilter(applications, quickFilter, user?.id);
  const sortedApplications = sortApplications(quickFilteredApplications, sortCol, sortDir);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const canWrite = hasPermission(user, 'credit:write');
  const canCreate = hasPermission(user, 'credit:create');

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await creditService.listApplications({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        productType: productFilter || undefined,
        state: stateFilter || undefined,
        borrowerProfileId: borrowerFilter || undefined,
        branchId: branchFilter || undefined,
      });
      setApplications(data.applications);
      setPagination(data.pagination);
    } catch (e) {
      console.error(e);
      toast.error(friendlyMessage(e, 'Failed to load applications'));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, productFilter, stateFilter, borrowerFilter, branchFilter]);

  // Reset to page 1 when filters change (not page itself)
  useEffect(() => { setPage(1); }, [debouncedSearch, productFilter, stateFilter, borrowerFilter, branchFilter, quickFilter]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  // §3.1 — Load branches for the filter dropdown (visible to Admin)
  useEffect(() => {
    branchApi.list().then(setBranches).catch(() => {});
  }, []);

  // Fetch borrower profiles when create modal opens
  useEffect(() => {
    if (showCreate && borrowerProfiles.length === 0) {
      setLoadingBorrowers(true);
      creditService.listBorrowerProfiles({ limit: 200 })
        .then(res => setBorrowerProfiles(res.profiles))
        .catch((e) => { console.error(e); toast.error(friendlyMessage(e, 'Failed to load borrower profiles')); })
        .finally(() => setLoadingBorrowers(false));
    }
  }, [showCreate]);

  // Fetch pending approval count
  useEffect(() => {
    dashboardApi.getApprovalInbox()
      .then((res: any) => {
        const items = res.data?.data ?? res.data ?? [];
        setPendingApprovalCount(Array.isArray(items) ? items.length : 0);
      })
      .catch(() => { /* silently ignore — non-critical */ });
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, any> = { ...form };
    if (['requestedAmount', 'requestedTenor'].some(k => k in payload)) {
      for (const k of ['requestedAmount', 'requestedTenor']) {
        if (payload[k] !== undefined && payload[k] !== null && payload[k] !== '') {
          payload[k] = Number(payload[k]);
          if (isNaN(payload[k])) delete payload[k];
        }
      }
    }
    if (borrowerFilter) payload.borrowerProfileId = borrowerFilter;
    // Auto-assign RM: if current user has CREDIT_RM role, set them as RM
    const { assignedRmId } = getSmartDefaults({ currentUser: user, productType: form.productType });
    if (assignedRmId) payload.assignedRmId = assignedRmId;
    try {
      setSaving(true);
      const newApp = await creditService.createApplication(payload);
      toast.success('Application submitted successfully');
      setShowCreate(false);
      setForm({ currency: 'MYR' as any, productType: 'TERM_LOAN' });
      // Navigate to the new application's Header tab for CA Memo entry
      navigate(`/credit/applications/${newApp.id}?new=1`);
    } catch (e) {
      console.error(e);
      toast.error(friendlyMessage(e, 'Failed to create application'));
    } finally {
      setSaving(false);
    }
  };

  // Group by kanban column
  const grouped = KANBAN_COLUMNS.map(col => ({
    ...col,
    items: applications.filter(a => col.states.includes((a.state || a.status) as ApplicationState)),
  }));

  return (
    <>
      <CreditNav />
      <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
              <Link to="/credit" className="hover:text-brand-700 transition-colors" style={{ textDecoration: 'none', color: 'inherit' }}>Credit</Link>
              <span>/</span><span className="font-semibold text-text-primary">Applications</span>
            </div>
            <h1 className="text-2xl font-black text-text-primary">Credit Applications{pendingApprovalCount > 0 && (
              <span className="text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded-full ml-2">
                {pendingApprovalCount} pending
              </span>
            )}</h1>
          </div>
          {canCreate && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              <span className="material-symbols-outlined text-lg">add</span> New Application
            </button>
          )}
        </div>

        {/* borrower filter banner */}
        {borrowerFilter && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-4 flex items-center gap-3">
            <span className="material-symbols-outlined text-indigo-600 text-lg">filter_alt</span>
            <span className="text-sm text-indigo-800">Filtered by borrower</span>
            <Link to="/credit/applications" className="ml-auto text-xs font-semibold text-indigo-600 hover:text-indigo-800" style={{ textDecoration: 'none' }}>Clear filter</Link>
          </div>
        )}

        {/* §3.5e — Smart filter quick views */}
        <div className="flex items-center gap-2 mb-3 flex-wrap" role="tablist" aria-label="Quick filter views">
          {QUICK_FILTERS.map(qf => {
            const active = quickFilter === qf.key;
            return (
              <button
                key={qf.key}
                role="tab"
                aria-selected={active}
                onClick={() => setQuickFilter(qf.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  active
                    ? 'bg-brand-700 text-white border-brand-700'
                    : 'bg-surface border-border text-text-secondary hover:bg-gray-50'
                }`}
                style={{ cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{qf.icon}</span>
                {qf.label}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-lg">search</span>
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search applications..."
              aria-label="Search credit applications"
              className="w-full pl-10 pr-4 py-2 bg-surface-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
          </div>
          <select value={productFilter} onChange={e => setProductFilter(e.target.value)}
            aria-label="Filter by product type"
            className="px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary outline-none cursor-pointer" style={{ fontFamily: 'var(--font-sans)' }}>
            <option value="">All Products</option>
            {PRODUCT_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
            aria-label="Filter by application state"
            className="px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary outline-none cursor-pointer" style={{ fontFamily: 'var(--font-sans)' }}>
            <option value="">All States</option>
            {Object.entries(STATE_COLORS).map(([key]) => <option key={key} value={key}>{key.replace(/_/g, ' ')}</option>)}
          </select>
          {/* §3.1 — Branch filter */}
          {branches.length > 0 && (
            <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
              aria-label="Filter by branch"
              className="px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary outline-none cursor-pointer" style={{ fontFamily: 'var(--font-sans)' }}>
              <option value="">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
            </select>
          )}
          {/* View toggle */}
          <div className="ml-auto flex gap-1">
            <button
              onClick={() => handleViewChange('table')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${view === 'table' ? 'bg-brand-700 text-white border-brand-700' : 'bg-surface border-border text-text-secondary hover:bg-gray-50'}`}
              style={{ fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>table_rows</span> Table
            </button>
            <button
              onClick={() => handleViewChange('kanban')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${view === 'kanban' ? 'bg-brand-700 text-white border-brand-700' : 'bg-surface border-border text-text-secondary hover:bg-gray-50'}`}
              style={{ fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>view_column</span> Kanban
            </button>
          </div>
        </div>

        {/* Table / Kanban view */}
        {loading ? (
          <div aria-busy="true" aria-label="Loading applications" className="space-y-2">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-14 bg-surface-muted rounded-lg" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : view === 'table' ? (
          <>
            {/* SLA urgency strip */}
            {(() => {
              const strip = getSLAStrip(applications);
              return (
                <div className="flex items-center gap-4 flex-wrap px-4 py-2 mb-3 rounded-lg text-xs"
                  style={{ background: '#fff8f0', border: '1px solid #fde8c8' }}>
                  <span className="font-bold uppercase tracking-wide text-text-secondary" style={{ fontSize: 10 }}>SLA Status</span>
                  {strip.overdue > 0 && (
                    <span className="flex items-center gap-1 font-bold px-2.5 py-1 rounded-full"
                      style={{ background: '#fef2f2', color: 'var(--color-danger)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>warning</span>
                      {strip.overdue} Overdue
                    </span>
                  )}
                  {strip.urgent > 0 && (
                    <span className="flex items-center gap-1 font-bold px-2.5 py-1 rounded-full"
                      style={{ background: '#fff7ed', color: '#c2410c' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>schedule</span>
                      {strip.urgent} Due within 24h
                    </span>
                  )}
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full"
                    style={{ background: '#f0fdf4', color: 'var(--color-success)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>check_circle</span>
                    {strip.ok} On track
                  </span>
                </div>
              );
            })()}

            {/* Table */}
            <div className="rounded-xl border border-border overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="credit-table w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Borrower</th>
                      <th>Product</th>
                      <th
                        onClick={() => handleSort('amount')}
                        className="cursor-pointer hover:text-brand-700 select-none"
                      >
                        Amount
                        <span className="material-symbols-outlined align-middle ml-0.5"
                          style={{ fontSize: 12, color: sortCol === 'amount' ? 'var(--color-brand-700)' : undefined }}>
                          {sortCol === 'amount' ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                        </span>
                      </th>
                      <th>Stage / Status</th>
                      <th
                        onClick={() => handleSort('sla')}
                        className="cursor-pointer hover:text-brand-700 select-none"
                      >
                        SLA
                        <span className="material-symbols-outlined align-middle ml-0.5"
                          style={{ fontSize: 12, color: sortCol === 'sla' ? 'var(--color-brand-700)' : undefined }}>
                          {sortCol === 'sla' ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                        </span>
                      </th>
                      <th>RM</th>
                      <th>Created</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedApplications.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-10 text-text-secondary">
                          <span className="material-symbols-outlined text-3xl block opacity-20 mb-2">search_off</span>
                          No applications found
                        </td>
                      </tr>
                    )}
                    {sortedApplications.map(app => {
                      const state = (app.state || app.status) as ApplicationState;
                      const badge = STATE_COLORS[state] || STATE_COLORS.DRAFT;
                      const sla = getSLAInfo(app.createdAt, state);
                      const isOverdue = sla.color === '#dc2626';
                      const borrowerName = app.borrowerProfile
                        ? (app.borrowerProfile.account?.name ||
                           (app.borrowerProfile.contact
                             ? `${app.borrowerProfile.contact.firstName} ${app.borrowerProfile.contact.lastName}`
                             : app.borrowerProfile.name) ||
                           'Unnamed Borrower')
                        : '\u2014';
                      const daysAgo = Math.floor((Date.now() - new Date(app.createdAt).getTime()) / 86400000);
                      const createdLabel = daysAgo === 0 ? 'Today' : `${daysAgo}d ago`;

                      return (
                        <tr
                          key={app.id}
                          onClick={() => navigate(`/credit/applications/${app.id}`)}
                          className={`cursor-pointer${isOverdue ? ' row-overdue' : ''}`}
                        >
                          <td>
                            <div className="font-bold text-text-primary" style={{ fontSize: 12 }}>{borrowerName}</div>
                            <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                              #{app.id.slice(-8).toUpperCase()}
                            </div>
                          </td>
                          <td style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                            {PRODUCT_LABELS[app.productType || app.productName || ''] || '\u2014'}
                          </td>
                          <td>
                            <div className="font-black text-text-primary" style={{ fontSize: 13 }}>
                              {formatCurrency(app.requestedAmount, app.currency)}
                            </div>
                          </td>
                          <td>
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ background: badge.bg, color: badge.text }}>
                              {(STATE_LABELS[state] || state.replace(/_/g, ' '))}
                            </span>
                          </td>
                          <td>
                            <span className="font-semibold" style={{ fontSize: 11, color: sla.color }}>
                              {isOverdue && (
                                <span className="material-symbols-outlined align-middle mr-0.5" style={{ fontSize: 12 }}>warning</span>
                              )}
                              {sla.text}
                            </span>
                          </td>
                          <td>
                            {app.rm ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold"
                                style={{ background: 'var(--color-brand-50)', color: 'var(--color-brand-700)' }}>
                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white font-black"
                                  style={{ background: 'var(--color-brand-500)', fontSize: 8 }}>
                                  {app.rm.firstName?.[0] ?? '?'}
                                </span>
                                {app.rm.firstName}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>\u2014</span>
                            )}
                          </td>
                          <td style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>{createdLabel}</td>
                          <td>
                            <div className="flex items-center gap-1">
                              {/* §6.1 — Clone action for eligible states */}
                              {['APPROVED', 'ACTIVE', 'CLOSED', 'REJECTED'].includes(state) && canCreate && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      const newId = await creditService.cloneApplication(app.id);
                                      toast.success('Application cloned');
                                      navigate(`/credit/applications/${newId}?new=1`);
                                    } catch (err) {
                                      toast.error(friendlyMessage(err, 'Failed to clone application'));
                                    }
                                  }}
                                  className="flex items-center gap-0.5 px-1.5 py-1 text-[10px] font-semibold text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                                  style={{ cursor: 'pointer', background: 'none' }}
                                  title="Clone this application into a new draft"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>content_copy</span>
                                  Clone
                                </button>
                              )}
                              <span className="material-symbols-outlined" style={{ color: 'var(--color-text-tertiary)', fontSize: 18 }}>
                                chevron_right
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          /* ── Kanban (existing) ── */
          <div aria-busy="false" className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory" style={{ alignItems: 'flex-start' }}>
            {grouped.map(col => {
              const collapsed = isCollapsed(col.key);
              if (collapsed) {
                return (
                  <CollapsedColumnPill
                    key={col.key}
                    label={col.label}
                    color={col.color}
                    count={col.items.length}
                    onClick={() => toggleCollapse(col.key)}
                  />
                );
              }
              return (
                <div key={col.key} className="min-w-[260px] md:min-w-[280px] flex-1 snap-start">
                  <div className="flex items-center gap-2 mb-3 group">
                    <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                    <span className="text-sm font-bold text-text-secondary uppercase tracking-wider" style={{ color: col.color }}>{col.label}</span>
                    <span className="text-xs font-bold text-text-secondary bg-bg-subtle px-1.5 py-0.5 rounded-full ml-auto">{col.items.length}</span>
                    <ColumnCollapseToggle onClick={() => toggleCollapse(col.key)} />
                  </div>
                  <div className="space-y-3">
                    {col.items.length === 0 && (
                      <div className="text-center py-4 text-text-secondary">
                        <span className="material-symbols-outlined text-xl block opacity-20">playlist_add</span>
                        <p className="text-xs mt-1">No applications</p>
                      </div>
                    )}
                    {col.items.map(app => {
                      const state = (app.state || app.status) as ApplicationState;
                      const badge = STATE_COLORS[state] || STATE_COLORS.DRAFT;
                      const sla = getSLAInfo(app.createdAt, state);
                      return (
                        <div key={app.id} onClick={() => navigate(`/credit/applications/${app.id}`)}
                          className="bg-bg-surface border border-border rounded-xl p-3.5 cursor-pointer hover:border-brand-300 hover:shadow-sm transition-all"
                          style={{ borderLeft: `3px solid ${col.color}` }}>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.text }}>
                              {state.replace(/_/g, ' ')}
                            </span>
                            <span className="flex items-center gap-1 ml-auto">
                              {/* §3.3 — SLA dot indicator */}
                              <span className={`inline-block w-2 h-2 rounded-full ${
                                sla.color === '#dc2626' ? 'bg-red-500' :
                                sla.color === '#ea580c' ? 'bg-amber-500' :
                                sla.color === '#16a34a' ? 'bg-green-500' : 'bg-gray-300'
                              }`} />
                              <span className="text-[10px] font-semibold" style={{ color: sla.color }}>{sla.text}</span>
                            </span>
                          </div>
                          <p className="text-sm font-bold text-text-primary truncate mb-0.5">
                            {app.borrowerProfile ? (app.borrowerProfile.account?.name || (app.borrowerProfile.contact ? `${app.borrowerProfile.contact.firstName} ${app.borrowerProfile.contact.lastName}` : app.borrowerProfile.name) || 'Unnamed Borrower') : PRODUCT_LABELS[app.productType || app.productName || ''] || '\u2014'}
                          </p>
                          <p className="text-xs text-text-secondary truncate">{PRODUCT_LABELS[app.productType || app.productName || ''] || app.productName || '\u2014'}</p>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                            <span className="text-sm font-black text-text-primary">{formatCurrency(app.requestedAmount, app.currency)}</span>
                            {app.rm && <span className="text-[10px] text-text-secondary">RM: {app.rm.firstName}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && pagination.total > 0 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border flex-wrap gap-3">
            <div className="text-sm text-text-secondary">
              Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold text-text-primary border border-border hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                style={{ background: 'none', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
              >
                Previous
              </button>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | string)[]>((acc, p, i, arr) => {
                  if (i > 0) {
                    const prev = arr[i - 1];
                    if (typeof prev === 'number' && p - prev > 1) acc.push('...');
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  typeof p === 'string' ? (
                    <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-sm text-text-secondary">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${p === page ? 'bg-brand-700 text-white' : 'text-text-primary border border-border hover:bg-gray-50'}`}
                      style={p === page ? { border: 'none', cursor: 'default' } : { background: 'none', cursor: 'pointer' }}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold text-text-primary border border-border hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                style={{ background: 'none', cursor: page >= pagination.totalPages ? 'not-allowed' : 'pointer' }}
              >
                Next
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-secondary">Per page:</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                aria-label="Results per page"
                className="px-2 py-1 bg-surface border border-border rounded-lg text-sm text-text-primary outline-none cursor-pointer"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                {[10, 20, 50, 100].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowCreate(false)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
                <h2 className="text-lg font-extrabold text-text-primary">New Credit Application</h2>
                <button onClick={() => setShowCreate(false)} aria-label="Close dialog" className="text-text-secondary hover:text-text-primary transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <span className="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
              </div>
              <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto flex-1 p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-1">Product Type *</label>
                    <select required value={form.productType || ''} onChange={e => setForm(f => ({ ...f, productType: e.target.value as CreditProductType }))}
                      className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200" style={{ fontFamily: 'var(--font-sans)' }}>
                      {PRODUCT_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  {/* §3.1 — Branch override (admin only; defaults to RM's branch) */}
                  {hasPermission(user, 'credit:admin') && branches.length > 0 && (
                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-1">Branch</label>
                      <select value={form.branchId || ''} onChange={e => setForm(f => ({ ...f, branchId: e.target.value || null }))}
                        className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200" style={{ fontFamily: 'var(--font-sans)' }}>
                        <option value="">— Default to RM's branch —</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-1">Requested Amount *</label>
                      <input required type="number" min="0" value={form.requestedAmount ?? ''} onChange={e => setForm(f => ({ ...f, requestedAmount: Number(e.target.value) }))}
                        className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-1">Currency *</label>
                      <select required value={form.currency || 'MYR'} onChange={e => setForm(f => ({ ...f, currency: e.target.value as any }))}
                        className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200" style={{ fontFamily: 'var(--font-sans)' }}>
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-1">Tenure (months) *</label>
                      <input required type="number" min="1" value={form.requestedTenor ?? ''} onChange={e => setForm(f => ({ ...f, requestedTenor: Number(e.target.value) }))}
                        className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200" />
                    </div>
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-1">Borrower *</label>
                    <select required value={form.borrowerProfileId || borrowerFilter || ''}
                      onChange={e => setForm(f => ({ ...f, borrowerProfileId: e.target.value }))}
                      disabled={!!borrowerFilter}
                      className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-gray-50 disabled:text-text-secondary"
                      style={{ fontFamily: 'var(--font-sans)' }}>
                      <option value="">— Select borrower —</option>
                      {borrowerProfiles.map(bp => (
                        <option key={bp.id} value={bp.id}>
                          {bp.account?.name || (bp.contact ? `${bp.contact.firstName} ${bp.contact.lastName}` : bp.name) || 'Unnamed Borrower'} {bp.borrowerType === 'INDIVIDUAL' ? '(Individual)' : '(Corporate)'}
                        </option>
                      ))}
                    </select>
                    {!loadingBorrowers && borrowerProfiles.length === 0 && !borrowerFilter && (
                      <p className="mt-1.5 text-xs text-text-secondary">
                        No borrower profiles yet.{' '}
                        <Link
                          to="/credit/borrowers"
                          className="text-brand-700 font-semibold hover:underline"
                          onClick={() => setShowCreate(false)}
                        >
                          Go to Borrower Profiles to create one
                        </Link>
                      </p>
                    )}
                  </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-1">Purpose</label>
                    <textarea rows={3} value={form.purpose ?? ''} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                      className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 resize-none" style={{ fontFamily: 'var(--font-sans)' }} />
                  </div>
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
                  <button type="button" onClick={() => setShowCreate(false)} className="px-5 py-2 rounded-lg text-sm font-bold text-text-secondary hover:bg-gray-100 transition-colors" style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                  <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors disabled:opacity-50" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    {saving ? 'Creating...' : 'Create Application'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CreditApplicationList;