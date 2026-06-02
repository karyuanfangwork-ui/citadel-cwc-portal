import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import Breadcrumbs from '../src/components/Breadcrumbs';
import { useAuth } from '../src/context/AuthContext';
import { useToast } from '../src/context/ToastContext';
import { hasPermission } from '../src/utils/permissions';
import approvalService from '../src/services/approval.service';
import creditService, { CreditApplication, ApplicationState } from '../src/services/credit.service';
import { friendlyMessage } from '../src/utils/errorMessages';
import StateBadge from '../src/components/ui/StateBadge';
import RiskBadge from '../src/components/credit/RiskBadge';
import ApprovalQuickView from '../src/components/credit/ApprovalQuickView';
import { formatDate as fmtDate, formatCurrency as fmtCurrency } from './credit/creditUtils';

// ── Shared Types ──────────────────────────────────────────────────

interface PendingRequest {
  id: string;
  referenceNumber: string;
  summary: string;
  priority: string;
  status: string;
  createdAt: string;
  slaPaused?: boolean;
  slaDueAt?: string | null;
  serviceDesk?: { code: string; name: string };
  requestType?: { name: string };
  requester?: { firstName: string; lastName: string };
}

// ── ITSM Tab Constants ────────────────────────────────────────────

const DESK_OPTIONS = [
  { value: '', label: 'All Desks' },
  { value: 'IT', label: 'IT Support' },
  { value: 'HR', label: 'HR Services' },
  { value: 'FINANCE', label: 'Group Finance' },
];

const PRIORITY_FILTERS = [
  { value: '', label: 'All Priorities' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

// ── Credit Urgency ────────────────────────────────────────────────

function getCreditUrgency(createdAt: string, state: ApplicationState) {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  const slaMap: Partial<Record<ApplicationState, number>> = {
    COMMITTEE_REVIEW: 2, KYC_REVIEW: 3, UNDERWRITING: 5, CREDIT_ASSESSMENT: 5,
    SUBMITTED: 3, OFFER: 5,
  };
  const limit = slaMap[state];
  if (!limit) return { level: 'normal' as const, text: `${days}d`, color: '#6b7280', icon: 'schedule' };
  const remaining = limit - days;
  if (remaining <= 0) return { level: 'overdue' as const, text: 'Overdue', color: '#dc2626', icon: 'error' };
  if (remaining <= 2) return { level: 'urgent' as const, text: `${remaining}d left`, color: '#ea580c', icon: 'priority_high' };
  return { level: 'normal' as const, text: `${remaining}d left`, color: '#16a34a', icon: 'check_circle' };
}

const CREDIT_APPROVAL_STATES: ApplicationState[] = ['KYC_REVIEW', 'COMMITTEE_REVIEW', 'CREDIT_ASSESSMENT'];

// ── Tab Config ────────────────────────────────────────────────────

type TabScope = 'all' | 'itsm' | 'credit';

// ── Component ─────────────────────────────────────────────────────

const ApprovalCenter: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const canApproveITSM = hasPermission(user, 'request:approve');
  const canApproveCredit = hasPermission(user, 'credit:approve');

  // Active tab from URL or default
  const scope = (searchParams.get('scope') as TabScope) || 'all';

  const setScope = (s: TabScope) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('scope', s);
      return next;
    }, { replace: true });
  };

  // Determine visible tabs
  const tabs: { key: TabScope; label: string; icon: string; visible: boolean }[] = [
    { key: 'all', label: 'All', icon: 'layers', visible: canApproveITSM && canApproveCredit },
    { key: 'itsm', label: 'IT & Service', icon: 'support_agent', visible: canApproveITSM },
    { key: 'credit', label: 'Credit', icon: 'account_balance', visible: canApproveCredit },
  ];

  // ── ITSM State ──────────────────────────────────────
  const [itsmRequests, setItsmRequests] = useState<PendingRequest[]>([]);
  const [itsmLoading, setItsmLoading] = useState(true);
  const [itsmError, setItsmError] = useState<string | null>(null);
  const [itsmPage, setItsmPage] = useState(1);
  const [itsmTotalPages, setItsmTotalPages] = useState(1);
  const [itsmTotal, setItsmTotal] = useState(0);
  const [itsmSearch, setItsmSearch] = useState('');
  const [deskFilter, setDeskFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actioning, setActioning] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [bulkActioning, setBulkActioning] = useState(false);

  const fetchItsm = useCallback(async () => {
    try {
      setItsmLoading(true);
      setItsmError(null);
      const data = await approvalService.getPendingApprovals({
        page: itsmPage,
        limit: 10,
        priority: priorityFilter || undefined,
        serviceDeskCode: deskFilter || undefined,
      });
      setItsmRequests(data?.requests || data?.data?.requests || []);
      setItsmTotal(data?.pagination?.total || data?.data?.pagination?.total || 0);
      setItsmTotalPages(data?.pagination?.totalPages || data?.data?.pagination?.totalPages || 1);
    } catch (err: any) {
      setItsmError(friendlyMessage(err, 'Unable to load ITSM approvals.'));
    } finally {
      setItsmLoading(false);
    }
  }, [itsmPage, deskFilter, priorityFilter]);

  useEffect(() => { if (canApproveITSM) fetchItsm(); }, [canApproveITSM, fetchItsm]);

  const itsmFiltered = itsmSearch
    ? itsmRequests.filter(r =>
        r.referenceNumber.toLowerCase().includes(itsmSearch.toLowerCase()) ||
        r.summary.toLowerCase().includes(itsmSearch.toLowerCase()))
    : itsmRequests;

  // ── Credit State ───────────────────────────────────
  const [creditApps, setCreditApps] = useState<CreditApplication[]>([]);
  const [creditLoading, setCreditLoading] = useState(true);
  const [quickViewApp, setQuickViewApp] = useState<CreditApplication | null>(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);

  const fetchCredit = useCallback(async () => {
    try {
      setCreditLoading(true);
      const results = await Promise.all(
        CREDIT_APPROVAL_STATES.map(state =>
          creditService.listApplications({ state, limit: 100 }).then(d => d.applications).catch(() => [] as CreditApplication[])
        )
      );
      const all = results.flat();
      const seen = new Set<string>();
      const unique = all.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });
      setCreditApps(unique);
    } catch (e) {
      console.error(e);
    } finally {
      setCreditLoading(false);
    }
  }, []);

  useEffect(() => { if (canApproveCredit) fetchCredit(); }, [canApproveCredit, fetchCredit]);

  const handleCreditDecision = useCallback((applicationId: string) => {
    setCreditApps(prev => prev.filter(a => a.id !== applicationId));
  }, []);

  // ── ITSM Handlers ──────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const toggleAll = () => {
    if (selectedIds.size === itsmFiltered.length && itsmFiltered.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(itsmFiltered.map(r => r.id)));
  };

  const handleInlineApprove = async (id: string) => {
    try {
      setActioning(id);
      await approvalService.bulkAction('approve', [id]);
      toast.success('Approved', 'Request approved.');
      setItsmRequests(prev => prev.filter(r => r.id !== id));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch (err: any) {
      toast.error('Error', friendlyMessage(err, 'Failed to approve.'));
    } finally {
      setActioning(null);
    }
  };

  const handleInlineReject = async () => {
    if (!rejectId) return;
    try {
      setActioning(rejectId);
      await approvalService.bulkAction('reject', [rejectId], rejectReason || undefined);
      toast.success('Rejected', 'Request rejected.');
      setItsmRequests(prev => prev.filter(r => r.id !== rejectId));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(rejectId); return n; });
    } catch (err: any) {
      toast.error('Error', friendlyMessage(err, 'Failed to reject.'));
    } finally {
      setActioning(null);
      setRejectId(null);
      setRejectReason('');
    }
  };

  const handleBulkApprove = async () => {
    try {
      setBulkActioning(true);
      await approvalService.bulkAction('approve', Array.from(selectedIds));
      toast.success('Bulk Approved', `${selectedIds.size} request(s) approved.`);
      setItsmRequests(prev => prev.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error('Error', friendlyMessage(err, 'Failed to bulk approve.'));
    } finally {
      setBulkActioning(false);
    }
  };

  const handleBulkReject = async () => {
    try {
      setBulkActioning(true);
      await approvalService.bulkAction('reject', Array.from(selectedIds));
      toast.success('Bulk Rejected', `${selectedIds.size} request(s) rejected.`);
      setItsmRequests(prev => prev.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error('Error', friendlyMessage(err, 'Failed to bulk reject.'));
    } finally {
      setBulkActioning(false);
    }
  };

  const getSlaStatus = (r: PendingRequest) => {
    if (r.slaPaused) return { label: 'Paused', cls: 'bg-blue-100 text-blue-700' };
    if (r.slaDueAt) {
      const due = new Date(r.slaDueAt).getTime();
      const now = Date.now();
      if (due < now) return { label: 'Overdue', cls: 'bg-red-100 text-red-700' };
      if (due - now < 24 * 60 * 60 * 1000) return { label: 'At Risk', cls: 'bg-orange-100 text-orange-700' };
      return { label: 'On Track', cls: 'bg-green-100 text-green-700' };
    }
    return { label: 'N/A', cls: 'bg-gray-100 text-gray-500' };
  };

  const formatCurrency = fmtCurrency;

  // ── Count totals for badges ─────────────────────────
  const itsmCount = itsmTotal;
  const creditCount = creditApps.length;
  const totalCount = itsmCount + creditCount;

  // ── Render ──────────────────────────────────────────

  const renderITSMTab = () => (
    <div>
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-xl">search</span>
          <input
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-cwc-border rounded-cwc-md text-sm focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 outline-none transition-all"
            placeholder="Search by reference or summary..."
            type="text"
            value={itsmSearch}
            onChange={e => setItsmSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2.5 bg-surface border border-cwc-border rounded-cwc-md text-sm focus:ring-2 focus:ring-brand-700/20 outline-none text-text-secondary"
          value={deskFilter}
          onChange={e => { setDeskFilter(e.target.value); setItsmPage(1); }}
        >
          {DESK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          className="px-3 py-2.5 bg-surface border border-cwc-border rounded-cwc-md text-sm focus:ring-2 focus:ring-brand-700/20 outline-none text-text-secondary"
          value={priorityFilter}
          onChange={e => { setPriorityFilter(e.target.value); setItsmPage(1); }}
        >
          {PRIORITY_FILTERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 mb-4 p-3 bg-brand-50 border border-brand-100 rounded-cwc-md">
          <span className="text-sm font-semibold text-brand-700">{selectedIds.size} item(s) selected</span>
          <button onClick={handleBulkApprove} disabled={bulkActioning}
            className="px-4 py-1.5 text-sm font-bold bg-emerald-600 text-white rounded-cwc-md hover:bg-emerald-700 disabled:opacity-50 transition-colors">
            Bulk Approve
          </button>
          <button onClick={handleBulkReject} disabled={bulkActioning}
            className="px-4 py-1.5 text-sm font-bold bg-red-600 text-white rounded-cwc-md hover:bg-red-700 disabled:opacity-50 transition-colors">
            Bulk Reject
          </button>
        </div>
      )}

      {itsmError && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-cwc-xl text-sm font-medium mb-6">{itsmError}</div>
      )}

      {/* Table */}
      <div className="bg-surface border border-cwc-border rounded-cwc-xl shadow-cwc-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full">
            <thead>
              <tr className="bg-surface-subtle border-b border-cwc-border">
                <th className="px-4 py-3 text-left"><input type="checkbox" checked={itsmFiltered.length > 0 && selectedIds.size === itsmFiltered.length} onChange={toggleAll} className="rounded border-gray-300" /></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Reference</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Summary</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Requester</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Submitted</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">SLA</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cwc-border">
              {itsmLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="h-4 bg-surface-muted rounded w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : itsmFiltered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center">
                    <span className="material-symbols-outlined text-5xl text-text-tertiary mb-3 block">task_alt</span>
                    <p className="text-text-secondary font-semibold">No pending approvals</p>
                    <p className="text-text-tertiary text-sm mt-1">All caught up! Check back later.</p>
                  </td>
                </tr>
              ) : (
                itsmFiltered.map(r => {
                  const sla = getSlaStatus(r);
                  const isActioning = actioning === r.id;
                  return (
                    <tr key={r.id} className="hover:bg-surface-subtle transition-colors">
                      <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded border-gray-300" /></td>
                      <td className="px-4 py-3">
                        <Link to={`/request/${r.referenceNumber || r.id}`} className="text-brand-700 font-semibold text-sm hover:underline">{r.referenceNumber}</Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-primary max-w-[200px] truncate">{r.summary}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{r.requestType?.name || '—'}</td>
                      <td className="px-4 py-3"><StateBadge state={r.priority} size="sm" /></td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{r.requester ? `${r.requester.firstName} ${r.requester.lastName}` : '—'}</td>
                      <td className="px-4 py-3 text-sm text-text-tertiary">{fmtDate ? fmtDate(r.createdAt) : new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded-full ${sla.cls}`}>{sla.label}</span>
                        {/* Escalation badge for overdue items */}
                        {sla.label === 'Overdue' && (
                          <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-red-600 text-white rounded-full">
                            <span className="material-symbols-outlined" style={{ fontSize: 10 }}>priority_high</span>
                            Escalated
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {rejectId === r.id ? (
                          <div className="flex flex-col gap-2">
                            <textarea className="w-full px-2 py-1.5 border border-cwc-border rounded text-xs focus:ring-2 focus:ring-brand-700/20 outline-none" placeholder="Rejection reason..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2} />
                            <div className="flex gap-2">
                              <button onClick={handleInlineReject} disabled={isActioning} className="px-3 py-1 text-xs font-bold bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors">Confirm</button>
                              <button onClick={() => { setRejectId(null); setRejectReason(''); }} className="px-3 py-1 text-xs font-semibold text-text-secondary hover:bg-surface-muted rounded transition-colors">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => handleInlineApprove(r.id)} disabled={isActioning} className="px-3 py-1 text-xs font-bold bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                              {isActioning ? '...' : 'Approve'}
                            </button>
                            <button onClick={() => setRejectId(r.id)} disabled={isActioning} className="px-3 py-1 text-xs font-bold bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors">
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {itsmTotalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-cwc-border">
            <span className="text-sm text-text-tertiary">{itsmTotal} total</span>
            <div className="flex gap-1">
              <button onClick={() => setItsmPage(p => Math.max(1, p - 1))} disabled={itsmPage === 1} className="px-3 py-1 text-sm font-semibold text-text-secondary hover:bg-surface-muted rounded disabled:opacity-30 transition-colors">Prev</button>
              {Array.from({ length: itsmTotalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setItsmPage(p)} className={`px-3 py-1 text-sm font-semibold rounded transition-colors ${p === itsmPage ? 'bg-brand-700 text-white' : 'text-text-secondary hover:bg-surface-muted'}`}>{p}</button>
              ))}
              <button onClick={() => setItsmPage(p => Math.min(itsmTotalPages, p + 1))} disabled={itsmPage === itsmTotalPages} className="px-3 py-1 text-sm font-semibold text-text-secondary hover:bg-surface-muted rounded disabled:opacity-30 transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderCreditCard = (app: CreditApplication) => {
    const state = (app.state || app.status) as ApplicationState;
    const urgency = getCreditUrgency(app.createdAt, state);
    const borrowerName = app.borrowerProfile
      ? (app.borrowerProfile.account?.name ||
        (app.borrowerProfile.contact
          ? `${app.borrowerProfile.contact.firstName} ${app.borrowerProfile.contact.lastName}`
          : app.borrowerProfile.name) || 'Unnamed Borrower')
      : app.id.slice(0, 8);

    return (
      <div key={app.id}
        className="bg-bg-surface border border-border rounded-xl transition-all hover:shadow-md hover:border-brand-300"
        style={{ borderLeft: `3px solid ${urgency.color}` }}
      >
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <StateBadge state={state} size="sm" />
          <RiskBadge rating={app.riskRating} size="sm" />
          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold ml-auto" style={{ color: urgency.color }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }} aria-hidden="true">{urgency.icon}</span>
            {urgency.text}
          </span>
        </div>
        <div className="px-4 pb-1">
          <p className="text-sm font-bold text-text-primary">{borrowerName}</p>
        </div>
        <div className="px-4 pb-2">
          <p className="text-xs text-text-secondary">
            {formatCurrency(app.requestedAmount, app.currency)} · {app.requestedTenor != null ? `${app.requestedTenor} mo` : '—'} · {app.productType.replace(/_/g, ' ')}
          </p>
        </div>
        <div className="flex items-center justify-between px-4 py-2 border-t border-border">
          <span className="text-xs text-text-tertiary">{fmtDate ? fmtDate(app.createdAt) : new Date(app.createdAt).toLocaleDateString()}</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); setQuickViewApp(app); setQuickViewOpen(true); }}
              className="flex items-center gap-1 text-xs text-brand-700 font-semibold hover:text-brand-800 transition-colors px-2 py-1 rounded-md hover:bg-brand-50"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }} aria-hidden="true">visibility</span>
              Quick View
            </button>
            <button
              onClick={() => navigate(`/credit/applications/${app.id}?tab=approvals`)}
              className="flex items-center gap-1 text-xs text-text-secondary font-semibold hover:text-text-primary transition-colors"
            >
              Detail <span className="material-symbols-outlined" style={{ fontSize: 12 }} aria-hidden="true">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCreditTab = () => {
    const overdue = creditApps.filter(a => getCreditUrgency(a.createdAt, (a.state || a.status) as ApplicationState).level === 'overdue');
    const urgent = creditApps.filter(a => getCreditUrgency(a.createdAt, (a.state || a.status) as ApplicationState).level === 'urgent');
    const normal = creditApps.filter(a => getCreditUrgency(a.createdAt, (a.state || a.status) as ApplicationState).level === 'normal');

    const renderGroup = (title: string, items: CreditApplication[], icon: string, iconColor: string) => (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-lg" style={{ color: iconColor }} aria-hidden="true">{icon}</span>
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">{title}</h2>
          <span className="text-xs font-bold text-text-secondary bg-bg-subtle px-2 py-0.5 rounded-full">{items.length}</span>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-text-secondary py-2">No items in this group</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(renderCreditCard)}
          </div>
        )}
      </div>
    );

    return (
      <div>
        {/* Summary chips */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-4 py-2 rounded-xl text-sm">
            <span className="material-symbols-outlined text-base text-red-600">error</span>
            <span className="font-bold text-red-700">{overdue.length}</span>
            <span className="text-red-600">Overdue</span>
          </div>
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl text-sm">
            <span className="material-symbols-outlined text-base text-amber-600">schedule</span>
            <span className="font-bold text-amber-700">{urgent.length}</span>
            <span className="text-amber-600">Urgent</span>
          </div>
          <div className="flex items-center gap-2 bg-bg-subtle border border-border px-4 py-2 rounded-xl text-sm">
            <span className="material-symbols-outlined text-base text-text-secondary">inbox</span>
            <span className="font-bold text-text-primary">{normal.length}</span>
            <span className="text-text-secondary">Normal</span>
          </div>
        </div>

        {creditLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-bg-surface border border-border rounded-xl p-4" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
                <div style={{ height: 12, width: '60%', background: 'var(--color-border)', borderRadius: 4, marginBottom: 8 }} />
                <div style={{ height: 12, width: '40%', background: 'var(--color-border)', borderRadius: 4 }} />
              </div>
            ))}
          </div>
        ) : creditApps.length === 0 ? (
          <div className="text-center py-16 text-text-secondary bg-bg-surface border border-border rounded-xl">
            <span className="material-symbols-outlined text-5xl block mb-3 opacity-30">check_circle</span>
            <p className="font-bold text-lg">All caught up!</p>
            <p className="text-sm mt-1">No applications pending your approval</p>
          </div>
        ) : (
          <>
            {renderGroup('Overdue', overdue, 'error', '#dc2626')}
            {renderGroup('Urgent', urgent, 'schedule', '#ea580c')}
            {renderGroup('Pending Review', normal, 'inbox', '#6b7280')}
          </>
        )}

        <ApprovalQuickView open={quickViewOpen} onClose={() => setQuickViewOpen(false)} application={quickViewApp} onDecision={handleCreditDecision} />
      </div>
    );
  };

  // ── All tab: combined view ──────────────────────────
  const renderAllTab = () => (
    <div className="space-y-8">
      {canApproveITSM && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-lg text-brand-700" aria-hidden="true">support_agent</span>
            <h2 className="text-base font-bold text-text-primary">IT & Service Approvals</h2>
            <span className="text-xs font-bold text-text-secondary bg-bg-subtle px-2 py-0.5 rounded-full">{itsmCount}</span>
            <Link to="/approvals?scope=itsm" className="ml-auto text-xs text-brand-700 font-semibold hover:underline">View all →</Link>
          </div>
          {itsmLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-surface-muted rounded animate-pulse" />)}
            </div>
          ) : itsmRequests.length === 0 ? (
            <p className="text-sm text-text-secondary py-4">No ITSM approvals pending.</p>
          ) : (
            <div className="space-y-2">
              {itsmRequests.slice(0, 5).map(r => {
                const sla = getSlaStatus(r);
                return (
                  <Link key={r.id} to={`/request/${r.referenceNumber || r.id}`}
                    className="flex items-center gap-3 px-4 py-3 bg-surface border border-cwc-border rounded-lg hover:bg-surface-subtle transition-colors group"
                  >
                    <StateBadge state={r.priority} size="sm" />
                    <span className="text-sm font-semibold text-brand-700 group-hover:underline">{r.referenceNumber}</span>
                    <span className="text-sm text-text-primary flex-1 truncate">{r.summary}</span>
                    <span className="text-xs text-text-secondary">{r.requestType?.name}</span>
                    <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded-full ${sla.cls}`}>{sla.label}</span>
                    {sla.label === 'Overdue' && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-red-600 text-white rounded-full">
                        <span className="material-symbols-outlined" style={{ fontSize: 10 }}>priority_high</span>
                        Escalated
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {canApproveCredit && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-lg text-brand-700" aria-hidden="true">account_balance</span>
            <h2 className="text-base font-bold text-text-primary">Credit Approvals</h2>
            <span className="text-xs font-bold text-text-secondary bg-bg-subtle px-2 py-0.5 rounded-full">{creditCount}</span>
            <Link to="/approvals?scope=credit" className="ml-auto text-xs text-brand-700 font-semibold hover:underline">View all →</Link>
          </div>
          {creditLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-surface-muted rounded animate-pulse" />)}
            </div>
          ) : creditApps.length === 0 ? (
            <p className="text-sm text-text-secondary py-4">No credit approvals pending.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {creditApps.slice(0, 6).map(renderCreditCard)}
            </div>
          )}
        </section>
      )}
    </div>
  );

  const activeTab = scope === 'credit' ? 'credit' : scope === 'itsm' ? 'itsm' : 'all';
  const visibleTabs = tabs.filter(t => t.visible);

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Approvals' }]} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Approval Center</h1>
          <p className="text-sm text-text-secondary mt-1">{totalCount} approval{totalCount !== 1 ? 's' : ''} pending across all modules</p>
        </div>
        <button onClick={() => { fetchItsm(); fetchCredit(); }}
          className="flex items-center gap-1.5 border border-cwc-border px-3 py-2 rounded-lg text-sm font-semibold hover:bg-surface-subtle transition-colors bg-surface"
        >
          <span className="material-symbols-outlined text-base">refresh</span> Refresh
        </button>
      </div>

      {/* Tab Bar */}
      {visibleTabs.length > 1 && (
        <div className="flex gap-1 mb-6 border-b border-cwc-border">
          {visibleTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setScope(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-brand-700 text-brand-700'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'
              }`}
            >
              <span className="material-symbols-outlined text-base">{tab.icon}</span>
              {tab.label}
              <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-text-secondary'
              }`}>
                {tab.key === 'all' ? totalCount : tab.key === 'itsm' ? itsmCount : creditCount}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'all' && renderAllTab()}
      {activeTab === 'itsm' && renderITSMTab()}
      {activeTab === 'credit' && renderCreditTab()}
    </div>
  );
};

export default ApprovalCenter;