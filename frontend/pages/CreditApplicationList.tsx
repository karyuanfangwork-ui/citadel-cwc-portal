import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import creditService, {
  CreditApplication,
  ApplicationState,
  CreditProductType,
  Pagination,
  BorrowerProfile,
  ApplicationSummary,
  dashboardApi,
  branchApi,
  Branch,
} from '../src/services/credit.service';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../src/utils/errorMessages';
import { sortApplications, type SortColumn, type SortDir } from '../src/utils/creditSort';
import {
  formatCurrency,
  STATE_COLORS,
  getSmartDefaults,
  VISIBLE_PRODUCT_TYPES,
  VISIBLE_PRODUCT_LABELS,
  HIDDEN_PRODUCT_TYPES,
} from './credit/creditUtils';
import StateBadge from '../src/components/credit/StateBadge';
import { useCollapsedColumns, CollapsedColumnPill, ColumnCollapseToggle } from '../src/components/CollapsibleKanbanColumn';
import ApplicationManagementHeader from '../src/components/credit/applications/ApplicationManagementHeader';
import ApplicationPipelineStrip, { ApplicationPipelineStage } from '../src/components/credit/applications/ApplicationPipelineStrip';
import ApplicationFilterBar, { QuickFilterOption } from '../src/components/credit/applications/ApplicationFilterBar';
import ApplicationDataTable from '../src/components/credit/applications/ApplicationDataTable';
import ApplicationInsightPanel, { InsightTaskItem } from '../src/components/credit/applications/ApplicationInsightPanel';

const KANBAN_COLUMNS: { key: string; label: string; states: ApplicationState[]; color: string; icon: string }[] = [
  { key: 'pre-submission', label: 'Lead', states: ['DRAFT'], color: '#6366f1', icon: 'rocket_launch' },
  { key: 'kyc', label: 'Onboarding', states: ['SUBMITTED', 'KYC_REVIEW', 'COMPLIANCE_HOLD', 'KYC_APPROVED', 'KYC_REJECTED'], color: '#f59e0b', icon: 'person_add' },
  { key: 'assessment', label: 'Assessment', states: ['UNDERWRITING', 'CREDIT_ASSESSMENT'], color: '#8b5cf6', icon: 'analytics' },
  { key: 'decision', label: 'Approval', states: ['COMMITTEE_REVIEW', 'APPROVED', 'REJECTED'], color: '#f97316', icon: 'fact_check' },
  { key: 'post-decision', label: 'Offer Letter', states: ['OFFER', 'ACCEPTED'], color: '#06b6d4', icon: 'mail' },
  { key: 'active', label: 'Disbursement', states: ['DISBURSED'], color: '#0891b2', icon: 'payments' },
  { key: 'completed', label: 'Completed', states: ['ACTIVE', 'CLOSED', 'WITHDRAWN'], color: '#22c55e', icon: 'check_circle' },
];

const PRODUCT_TYPES = VISIBLE_PRODUCT_TYPES as { value: CreditProductType; label: string }[];
const PRODUCT_LABELS: Record<string, string> = {
  ...VISIBLE_PRODUCT_LABELS,
  ...Object.fromEntries(HIDDEN_PRODUCT_TYPES.map(t => [t, t === 'SYNDICATED' ? 'Syndicated' : 'Project Finance'])),
};

const CURRENCIES = ['MYR', 'USD', 'SGD', 'GBP', 'EUR', 'JPY', 'CNY', 'THB', 'IDR', 'AUD', 'HKD'] as const;

type QuickFilterKey = 'all' | 'mine' | 'pendingApproval' | 'overdueSla' | 'inCommittee' | 'offers';

const PENDING_APPROVAL_STATES: ApplicationState[] = ['SUBMITTED', 'KYC_REVIEW', 'UNDERWRITING', 'CREDIT_ASSESSMENT', 'COMMITTEE_REVIEW'];

const QUICK_FILTERS: QuickFilterOption<QuickFilterKey>[] = [
  { key: 'all', label: 'All', icon: 'apps' },
  { key: 'mine', label: 'My Applications', icon: 'person' },
  { key: 'pendingApproval', label: 'Pending Approval', icon: 'hourglass_top' },
  { key: 'overdueSla', label: 'Overdue SLA', icon: 'schedule' },
  { key: 'inCommittee', label: 'In Committee', icon: 'groups' },
  { key: 'offers', label: 'Offers', icon: 'description' },
];

function quickFilterToServerParams(key: QuickFilterKey, userId?: string): Record<string, string | string[] | undefined> {
  switch (key) {
    case 'mine':
      return { assignedToMe: userId };
    case 'pendingApproval':
      return { states: PENDING_APPROVAL_STATES };
    case 'overdueSla':
      return { overdueSla: 'true' };
    case 'inCommittee':
      return { states: ['COMMITTEE_REVIEW'] };
    case 'offers':
      return { states: ['OFFER'] };
    case 'all':
    default:
      return {};
  }
}

function getSLAInfo(app: CreditApplication & { hasOpenSlaBreach?: boolean }): { text: string; color: string } {
  const state = (app.state || app.status) as ApplicationState;
  if (app.hasOpenSlaBreach) {
    return { text: 'Overdue', color: '#dc2626' };
  }

  const days = Math.floor((Date.now() - new Date(app.createdAt).getTime()) / 86400000);
  const slaMap: Partial<Record<ApplicationState, number>> = {
    DRAFT: 7,
    SUBMITTED: 3,
    KYC_REVIEW: 5,
    UNDERWRITING: 7,
    CREDIT_ASSESSMENT: 5,
    COMMITTEE_REVIEW: 3,
    OFFER: 5,
    ACCEPTED: 3,
  };
  const limit = slaMap[state];
  if (!limit) return { text: `${days}d`, color: '#6b7280' };
  const remaining = limit - days;
  if (remaining <= 1) return { text: `${remaining <= 0 ? 0 : remaining}d left`, color: '#ea580c' };
  return { text: `${remaining}d left`, color: '#16a34a' };
}

function getSLAStrip(apps: CreditApplication[]) {
  let overdue = 0;
  let urgent = 0;
  let ok = 0;
  apps.forEach(app => {
    const info = getSLAInfo(app as any);
    if (info.color === '#dc2626') overdue++;
    else if (info.color === '#ea580c') urgent++;
    else if (info.color === '#16a34a') ok++;
  });
  return { overdue, urgent, ok };
}

function getBorrowerName(app: CreditApplication): string {
  return app.borrowerProfile
    ? (app.borrowerProfile.account?.name ||
      (app.borrowerProfile.contact
        ? `${app.borrowerProfile.contact.firstName} ${app.borrowerProfile.contact.lastName}`
        : app.borrowerProfile.name) ||
      'Unnamed Borrower')
    : '—';
}

function getBorrowerType(app: CreditApplication): string {
  const type = app.borrowerProfile?.borrowerType;
  return type ? type.replace(/_/g, ' ') : 'Borrower';
}

const ACTIVE_STATES = new Set<ApplicationState>([
  'DRAFT', 'SUBMITTED', 'KYC_REVIEW', 'COMPLIANCE_HOLD', 'KYC_APPROVED', 'KYC_REJECTED',
  'UNDERWRITING', 'CREDIT_ASSESSMENT', 'COMMITTEE_REVIEW', 'APPROVED',
  'OFFER', 'ACCEPTED', 'DISBURSED', 'ACTIVE', 'REFERRED_BACK',
]);

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
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [quickFilter, setQuickFilterState] = useState<QuickFilterKey>(initialQuickFilter);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Partial<CreditApplication>>({ currency: 'MYR' as any, productType: 'TERM_LOAN' });
  const [saving, setSaving] = useState(false);
  const [borrowerProfiles, setBorrowerProfiles] = useState<BorrowerProfile[]>([]);
  const [loadingBorrowers, setLoadingBorrowers] = useState(false);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [summary, setSummary] = useState<ApplicationSummary | null>(null);
  const { isCollapsed, toggle: toggleCollapse } = useCollapsedColumns('credit-applications');
  const [sortCol, setSortCol] = useState<SortColumn>('sla');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [view, setView] = useState<'table' | 'kanban'>(() => {
    return (localStorage.getItem('credit-applications-view') as 'table' | 'kanban') ?? 'table';
  });

  const canCreate = hasPermission(user, 'credit:create');

  const setQuickFilter = useCallback((key: QuickFilterKey) => {
    setQuickFilterState(key);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (key === 'all') next.delete('quickFilter');
      else next.set('quickFilter', key);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

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

  const sortedApplications = sortApplications(applications, sortCol, sortDir);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      const quickParams = quickFilter !== 'all' ? quickFilterToServerParams(quickFilter, user?.id) : {};
      const data = await creditService.listApplications({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        productType: productFilter || undefined,
        state: stateFilter || undefined,
        borrowerProfileId: borrowerFilter || undefined,
        branchId: branchFilter || undefined,
        ...quickParams,
      });
      setApplications(data.applications);
      setPagination(data.pagination);
    } catch (e) {
      console.error(e);
      toast.error(friendlyMessage(e, 'Failed to load applications'));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, productFilter, stateFilter, borrowerFilter, branchFilter, quickFilter, user?.id]);

  useEffect(() => { setPage(1); }, [debouncedSearch, productFilter, stateFilter, borrowerFilter, branchFilter, quickFilter]);
  useEffect(() => { fetchApplications(); }, [fetchApplications]);
  useEffect(() => { branchApi.list().then(setBranches).catch(() => {}); }, []);

  useEffect(() => {
    if (showCreate && borrowerProfiles.length === 0) {
      setLoadingBorrowers(true);
      creditService.listBorrowerProfiles({ limit: 200 })
        .then(res => setBorrowerProfiles(res.profiles))
        .catch((e) => { console.error(e); toast.error(friendlyMessage(e, 'Failed to load borrower profiles')); })
        .finally(() => setLoadingBorrowers(false));
    }
  }, [showCreate, borrowerProfiles.length]);

  useEffect(() => {
    creditService.getApplicationSummary()
      .then((data) => {
        setSummary(data);
        // Derive pendingApprovalCount from pipeline (approval stages)
        const approvalCount = data.pipeline
          .filter(p => ['assessment', 'approval'].includes(p.key))
          .reduce((sum, p) => sum + p.count, 0);
        setPendingApprovalCount(approvalCount);
      })
      .catch(() => {});
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
    const { assignedRmId } = getSmartDefaults({ currentUser: user, productType: form.productType });
    if (assignedRmId) payload.assignedRmId = assignedRmId;
    try {
      setSaving(true);
      const newApp = await creditService.createApplication(payload);
      toast.success('Application submitted successfully');
      setShowCreate(false);
      setForm({ currency: 'MYR' as any, productType: 'TERM_LOAN' });
      navigate(`/credit/applications/${newApp.id}?new=1`);
    } catch (e) {
      console.error(e);
      toast.error(friendlyMessage(e, 'Failed to create application'));
    } finally {
      setSaving(false);
    }
  };

  const handleClone = async (applicationId: string) => {
    try {
      const newId = await creditService.cloneApplication(applicationId);
      toast.success('Application cloned');
      navigate(`/credit/applications/${newId}?new=1`);
    } catch (err) {
      toast.error(friendlyMessage(err, 'Failed to clone application'));
    }
  };

  const grouped = KANBAN_COLUMNS.map(col => ({
    ...col,
    items: applications.filter(a => col.states.includes((a.state || a.status) as ApplicationState)),
  }));

  const visibleActive = applications.filter(app => ACTIVE_STATES.has((app.state || app.status) as ApplicationState)).length;
  const slaStrip = getSLAStrip(applications);
  const visibleUrgent = slaStrip.overdue + slaStrip.urgent;
  const visibleExposure = formatCurrency(applications.reduce((sum, app) => sum + Number(app.requestedAmount || 0), 0), 'MYR');
  const visibleDisbursedCount = applications.filter(app => ['DISBURSED', 'ACTIVE'].includes((app.state || app.status) as string)).length;

  const urgentTasks: InsightTaskItem[] = sortedApplications
    .map(app => ({ app, sla: getSLAInfo(app as any) }))
    .filter(({ sla }) => sla.color === '#dc2626' || sla.color === '#ea580c')
    .map(({ app, sla }) => ({
      id: app.id,
      applicationNo: app.applicationNo || `#${app.id.slice(-8).toUpperCase()}`,
      borrowerName: getBorrowerName(app),
      meta: `${sla.text} • ${PRODUCT_LABELS[app.productType || app.productName || ''] || app.productName || 'Credit'}`,
      urgent: sla.color === '#dc2626',
      onClick: () => navigate(`/credit/applications/${app.id}`),
    }));

  const pipelineStages: ApplicationPipelineStage[] = KANBAN_COLUMNS.map(col => ({
    key: col.key,
    label: col.label,
    icon: col.icon,
    count: applications.filter(app => col.states.includes((app.state || app.status) as ApplicationState)).length,
    color: col.color,
    active: stateFilter ? col.states.includes(stateFilter as ApplicationState) : false,
    alert: col.key === 'assessment' && slaStrip.overdue > 0,
    onClick: () => {
      setQuickFilter('all');
      setStateFilter(col.states[0]);
    },
  }));

  return (
    <>
      <div className="credit-module px-4 py-5 sm:px-6 lg:px-8" style={{ minHeight: '100%', background: 'var(--cr-surface)' }}>
        <div className="mx-auto flex max-w-[1680px] flex-col gap-5">
          <ApplicationManagementHeader
            total={summary?.total ?? pagination.total}
            visibleActive={summary?.active ?? visibleActive}
            visibleUrgent={summary?.overdueSla ?? visibleUrgent}
            pendingApprovalCount={pendingApprovalCount}
            canCreate={canCreate}
            onCreate={() => setShowCreate(true)}
          />

          {borrowerFilter && (
            <div className="flex items-center gap-3 p-3 text-sm" style={{ background: 'var(--cr-secondary-fixed)', border: '1px solid var(--cr-secondary-fixed-dim)', borderRadius: 'var(--cr-radius-lg)', color: 'var(--cr-on-secondary-fixed)' }}>
              <span className="material-symbols-outlined text-lg">filter_alt</span>
              <span>Filtered by borrower</span>
              <Link to="/credit/applications" className="ml-auto text-xs font-bold" style={{ color: 'var(--cr-secondary)', textDecoration: 'none' }}>Clear filter</Link>
            </div>
          )}

          <ApplicationPipelineStrip stages={pipelineStages} />

          <ApplicationFilterBar
            quickFilters={QUICK_FILTERS}
            activeQuickFilter={quickFilter}
            onQuickFilterChange={setQuickFilter}
            searchInput={searchInput}
            onSearchInputChange={setSearchInput}
            productFilter={productFilter}
            onProductFilterChange={setProductFilter}
            stateFilter={stateFilter}
            onStateFilterChange={setStateFilter}
            branchFilter={branchFilter}
            onBranchFilterChange={setBranchFilter}
            branches={branches}
            productTypes={PRODUCT_TYPES}
            stateKeys={Object.keys(STATE_COLORS)}
            view={view}
            onViewChange={handleViewChange}
          />

          <div className="grid grid-cols-12 gap-5 items-start">
            <div className="col-span-12 xl:col-span-9">
              {loading ? (
                <div aria-busy="true" aria-label="Loading applications" className="space-y-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-14 rounded" style={{ background: 'var(--cr-surface-container-low)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  ))}
                </div>
              ) : view === 'table' ? (
                <ApplicationDataTable
                  applications={sortedApplications}
                  productLabels={PRODUCT_LABELS}
                  sortCol={sortCol}
                  sortDir={sortDir}
                  canCreate={canCreate}
                  onSort={handleSort}
                  onRowClick={(id) => navigate(`/credit/applications/${id}`)}
                  onClone={handleClone}
                  getBorrowerName={getBorrowerName}
                  getBorrowerType={getBorrowerType}
                  getSlaInfo={(app) => getSLAInfo(app as any)}
                  formatCurrency={(amount, currency) => formatCurrency(amount as any, currency || 'MYR')}
                />
              ) : (
                <div aria-busy="false" className="cr-scroll flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory" style={{ alignItems: 'flex-start' }}>
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
                        <div className="mb-3 flex items-center gap-2 group">
                          <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                          <span className="text-xs font-bold uppercase tracking-[0.06em]" style={{ color: col.color }}>{col.label}</span>
                          <span className="ml-auto rounded-full px-1.5 py-0.5 text-xs font-bold" style={{ background: 'var(--cr-surface-container)', color: 'var(--cr-on-surface-variant)' }}>{col.items.length}</span>
                          <ColumnCollapseToggle onClick={() => toggleCollapse(col.key)} />
                        </div>
                        <div className="space-y-3">
                          {col.items.length === 0 && (
                            <div className="py-4 text-center text-sm" style={{ color: 'var(--cr-on-surface-variant)' }}>
                              <span className="material-symbols-outlined block text-xl opacity-20">playlist_add</span>
                              <p className="mt-1 text-xs">No applications</p>
                            </div>
                          )}
                          {col.items.map(app => {
                            const state = (app.state || app.status) as ApplicationState;
                            const sla = getSLAInfo(app as any);
                            return (
                              <div
                                key={app.id}
                                onClick={() => navigate(`/credit/applications/${app.id}`)}
                                className="cursor-pointer p-3.5 transition-all hover:border-[var(--cr-secondary)]"
                                style={{ background: 'var(--cr-surface-container-lowest)', border: `1px solid var(--cr-outline-variant)`, borderLeft: `3px solid ${col.color}`, borderRadius: 'var(--cr-radius-lg)' }}
                              >
                                <div className="mb-1.5 flex items-center gap-1.5">
                                  <StateBadge state={state} />
                                  <span className="ml-auto text-[10px] font-semibold" style={{ color: sla.color }}>{sla.text}</span>
                                </div>
                                <p className="truncate text-sm font-bold" style={{ color: 'var(--cr-on-surface)' }}>{getBorrowerName(app)}</p>
                                <p className="truncate text-xs" style={{ color: 'var(--cr-on-surface-variant)' }}>{PRODUCT_LABELS[app.productType || app.productName || ''] || app.productName || '—'}</p>
                                <div className="mt-2 flex items-center justify-between border-t pt-2" style={{ borderColor: 'var(--cr-outline-variant)' }}>
                                  <span className="text-sm font-black tabular-nums" style={{ color: 'var(--cr-on-surface)' }}>{formatCurrency(app.requestedAmount, app.currency)}</span>
                                  {app.rm && <span className="text-[10px]" style={{ color: 'var(--cr-on-surface-variant)' }}>RM: {app.rm.firstName}</span>}
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

              {!loading && pagination.total > 0 && (
                <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4 flex-wrap" style={{ borderColor: 'var(--cr-outline-variant)' }}>
                  <div className="text-sm" style={{ color: 'var(--cr-on-surface-variant)' }}>
                    Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="rounded border px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40" style={{ background: 'white', borderColor: 'var(--cr-outline-variant)', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>Previous</button>
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
                      .map((p, i) => typeof p === 'string' ? (
                        <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-sm" style={{ color: 'var(--cr-on-surface-variant)' }}>…</span>
                      ) : (
                        <button key={p} onClick={() => setPage(p)} className="rounded px-3 py-1.5 text-sm font-semibold" style={p === page ? { background: 'var(--cr-secondary)', color: 'var(--cr-on-secondary)', border: '1px solid var(--cr-secondary)', cursor: 'default' } : { background: 'white', color: 'var(--cr-on-surface)', border: '1px solid var(--cr-outline-variant)', cursor: 'pointer' }}>{p}</button>
                      ))}
                    <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages} className="rounded border px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40" style={{ background: 'white', borderColor: 'var(--cr-outline-variant)', cursor: page >= pagination.totalPages ? 'not-allowed' : 'pointer' }}>Next</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: 'var(--cr-on-surface-variant)' }}>Per page:</span>
                    <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} aria-label="Results per page" className="rounded border px-2 py-1 text-sm" style={{ background: 'white', borderColor: 'var(--cr-outline-variant)' }}>
                      {[10, 20, 50, 100].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="col-span-12 xl:col-span-3">
              <ApplicationInsightPanel
                visibleExposure={summary ? formatCurrency(summary.totalExposure, 'MYR') : visibleExposure}
                exposurePct={summary ? 100 : undefined}
                pendingApprovalCount={pendingApprovalCount}
                visibleDisbursedCount={visibleDisbursedCount}
                urgentTasks={urgentTasks}
              />
            </div>
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowCreate(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="credit-module relative mx-4 flex max-h-[85vh] w-full max-w-lg flex-col" style={{ background: 'var(--cr-surface-container-lowest)', borderRadius: 'var(--cr-radius-lg)', boxShadow: '0 4px 18px rgba(0,0,0,0.12)' }} onClick={e => e.stopPropagation()}>
            <div className="flex flex-shrink-0 items-center justify-between border-b p-6" style={{ borderColor: 'var(--cr-outline-variant)' }}>
              <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--cr-font-display)', color: 'var(--cr-on-surface)' }}>New Credit Application</h2>
              <button onClick={() => setShowCreate(false)} aria-label="Close dialog" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cr-on-surface-variant)' }}>
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>
            <form onSubmit={handleCreate} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                <div>
                  <label className="mb-1 block text-sm font-semibold" style={{ color: 'var(--cr-on-surface)' }}>Product Type *</label>
                  <select required value={form.productType || ''} onChange={e => setForm(f => ({ ...f, productType: e.target.value as CreditProductType }))} className="w-full border px-4 py-2 text-sm outline-none focus:ring-1" style={{ borderColor: 'var(--cr-outline-variant)', borderRadius: 'var(--cr-radius)' }}>
                    {PRODUCT_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>

                {hasPermission(user, 'credit:admin') && branches.length > 0 && (
                  <div>
                    <label className="mb-1 block text-sm font-semibold" style={{ color: 'var(--cr-on-surface)' }}>Branch</label>
                    <select value={form.branchId || ''} onChange={e => setForm(f => ({ ...f, branchId: e.target.value || null }))} className="w-full border px-4 py-2 text-sm outline-none focus:ring-1" style={{ borderColor: 'var(--cr-outline-variant)', borderRadius: 'var(--cr-radius)' }}>
                      <option value="">— Default to RM's branch —</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-semibold" style={{ color: 'var(--cr-on-surface)' }}>Requested Amount *</label>
                    <input required type="number" min="0" value={form.requestedAmount ?? ''} onChange={e => setForm(f => ({ ...f, requestedAmount: Number(e.target.value) }))} className="w-full border px-4 py-2 text-sm outline-none focus:ring-1" style={{ borderColor: 'var(--cr-outline-variant)', borderRadius: 'var(--cr-radius)' }} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold" style={{ color: 'var(--cr-on-surface)' }}>Currency *</label>
                    <select required value={form.currency || 'MYR'} onChange={e => setForm(f => ({ ...f, currency: e.target.value as any }))} className="w-full border px-4 py-2 text-sm outline-none focus:ring-1" style={{ borderColor: 'var(--cr-outline-variant)', borderRadius: 'var(--cr-radius)' }}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-semibold" style={{ color: 'var(--cr-on-surface)' }}>Tenure (months) *</label>
                    <input required type="number" min="1" value={form.requestedTenor ?? ''} onChange={e => setForm(f => ({ ...f, requestedTenor: Number(e.target.value) }))} className="w-full border px-4 py-2 text-sm outline-none focus:ring-1" style={{ borderColor: 'var(--cr-outline-variant)', borderRadius: 'var(--cr-radius)' }} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold" style={{ color: 'var(--cr-on-surface)' }}>Borrower *</label>
                    <select required value={form.borrowerProfileId || borrowerFilter || ''} onChange={e => setForm(f => ({ ...f, borrowerProfileId: e.target.value }))} disabled={!!borrowerFilter} className="w-full border px-4 py-2 text-sm outline-none focus:ring-1 disabled:bg-gray-50" style={{ borderColor: 'var(--cr-outline-variant)', borderRadius: 'var(--cr-radius)' }}>
                      <option value="">— Select borrower —</option>
                      {borrowerProfiles.map(bp => (
                        <option key={bp.id} value={bp.id}>
                          {bp.account?.name || (bp.contact ? `${bp.contact.firstName} ${bp.contact.lastName}` : bp.name) || 'Unnamed Borrower'} {bp.borrowerType === 'INDIVIDUAL' ? '(Individual)' : '(Corporate)'}
                        </option>
                      ))}
                    </select>
                    {!loadingBorrowers && borrowerProfiles.length === 0 && !borrowerFilter && (
                      <p className="mt-1.5 text-xs" style={{ color: 'var(--cr-on-surface-variant)' }}>
                        No borrower profiles yet.{' '}
                        <Link to="/credit/borrowers" style={{ color: 'var(--cr-secondary)', fontWeight: 700 }} onClick={() => setShowCreate(false)}>
                          Go to Borrower Profiles to create one
                        </Link>
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold" style={{ color: 'var(--cr-on-surface)' }}>Purpose</label>
                  <textarea rows={3} value={form.purpose ?? ''} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} className="w-full resize-none border px-4 py-2 text-sm outline-none focus:ring-1" style={{ borderColor: 'var(--cr-outline-variant)', borderRadius: 'var(--cr-radius)' }} />
                </div>
              </div>
              <div className="flex flex-shrink-0 justify-end gap-3 border-t px-6 py-4" style={{ borderColor: 'var(--cr-outline-variant)' }}>
                <button type="button" onClick={() => setShowCreate(false)} className="px-5 py-2 text-sm font-bold" style={{ background: 'white', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius)', cursor: 'pointer', color: 'var(--cr-on-surface-variant)' }}>Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-bold disabled:opacity-50" style={{ background: 'var(--cr-primary)', color: 'var(--cr-on-primary)', border: 'none', borderRadius: 'var(--cr-radius)', cursor: 'pointer' }}>
                  {saving ? 'Creating...' : 'Create Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default CreditApplicationList;
