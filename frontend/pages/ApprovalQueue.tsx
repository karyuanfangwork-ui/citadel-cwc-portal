import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumbs from '../src/components/Breadcrumbs';
import { useAuth } from '../src/context/AuthContext';
import { useToast } from '../src/context/ToastContext';
import approvalService from '../src/services/approval.service';
import { friendlyMessage } from '../src/utils/errorMessages';
import StateBadge from '../src/components/ui/StateBadge';

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

const ApprovalQueue: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  const [searchTerm, setSearchTerm] = useState('');
  const [deskFilter, setDeskFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actioning, setActioning] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [bulkActioning, setBulkActioning] = useState(false);

  const fetchApprovals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await approvalService.getPendingApprovals({
        page,
        limit,
        priority: priorityFilter || undefined,
        serviceDeskCode: deskFilter || undefined,
      });
      setRequests(data?.requests || data?.data?.requests || []);
      setTotal(data?.pagination?.total || data?.data?.pagination?.total || 0);
      setTotalPages(data?.pagination?.totalPages || data?.data?.pagination?.totalPages || 1);
    } catch (err: any) {
      console.error('Error fetching approvals:', err);
      setError(friendlyMessage(err, 'Unable to load approval queue. Please refresh.'));
    } finally {
      setLoading(false);
    }
  }, [page, deskFilter, priorityFilter]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  // Filter by search term client-side
  const filtered = searchTerm
    ? requests.filter(r =>
        r.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.summary.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : requests;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)));
    }
  };

  const handleInlineApprove = async (id: string) => {
    try {
      setActioning(id);
      await approvalService.bulkAction('approve', [id]);
      toast.success('Approved', 'Request has been approved.');
      setRequests(prev => prev.filter(r => r.id !== id));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch (err: any) {
      toast.error('Error', friendlyMessage(err, 'Failed to approve request.'));
    } finally {
      setActioning(null);
    }
  };

  const handleInlineReject = async () => {
    if (!rejectId) return;
    try {
      setActioning(rejectId);
      await approvalService.bulkAction('reject', [rejectId], rejectReason || undefined);
      toast.success('Rejected', 'Request has been rejected.');
      setRequests(prev => prev.filter(r => r.id !== rejectId));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(rejectId); return n; });
    } catch (err: any) {
      toast.error('Error', friendlyMessage(err, 'Failed to reject request.'));
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
      setRequests(prev => prev.filter(r => !selectedIds.has(r.id)));
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
      setRequests(prev => prev.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error('Error', friendlyMessage(err, 'Failed to bulk reject.'));
    } finally {
      setBulkActioning(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
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

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Approval Queue' }]} />
      <h1 className="text-text-primary text-3xl font-extrabold tracking-tight mb-8">Approval Queue</h1>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-xl">search</span>
          <input
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-cwc-border rounded-cwc-md text-sm focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 outline-none transition-all"
            placeholder="Search by reference or summary..."
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2.5 bg-surface border border-cwc-border rounded-cwc-md text-sm focus:ring-2 focus:ring-brand-700/20 outline-none text-text-secondary"
          value={deskFilter}
          onChange={e => { setDeskFilter(e.target.value); setPage(1); }}
        >
          {DESK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          className="px-3 py-2.5 bg-surface border border-cwc-border rounded-cwc-md text-sm focus:ring-2 focus:ring-brand-700/20 outline-none text-text-secondary"
          value={priorityFilter}
          onChange={e => { setPriorityFilter(e.target.value); setPage(1); }}
        >
          {PRIORITY_FILTERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 mb-4 p-3 bg-brand-50 border border-brand-100 rounded-cwc-md">
          <span className="text-sm font-semibold text-brand-700">{selectedIds.size} item(s) selected</span>
          <button
            onClick={handleBulkApprove}
            disabled={bulkActioning}
            className="px-4 py-1.5 text-sm font-bold bg-emerald-600 text-white rounded-cwc-md hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            Bulk Approve
          </button>
          <button
            onClick={handleBulkReject}
            disabled={bulkActioning}
            className="px-4 py-1.5 text-sm font-bold bg-red-600 text-white rounded-cwc-md hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            Bulk Reject
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-cwc-xl text-sm font-medium mb-6">{error}</div>
      )}

      {/* Table */}
      <div className="bg-surface border border-cwc-border rounded-cwc-xl shadow-cwc-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full">
            <thead>
              <tr className="bg-surface-subtle border-b border-cwc-border">
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleAll}
                    className="rounded border-gray-300"
                  />
                </th>
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
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="h-4 bg-surface-muted rounded w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center">
                    <span className="material-symbols-outlined text-5xl text-text-tertiary mb-3 block">task_alt</span>
                    <p className="text-text-secondary font-semibold">No pending approvals</p>
                    <p className="text-text-tertiary text-sm mt-1">All caught up! Check back later.</p>
                  </td>
                </tr>
              ) : (
                filtered.map(r => {
                  const sla = getSlaStatus(r);
                  const isActioning = actioning === r.id;
                  return (
                    <tr key={r.id} className="hover:bg-surface-subtle transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleSelect(r.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/request/${r.referenceNumber || r.id}`} className="text-brand-700 font-semibold text-sm hover:underline">
                          {r.referenceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-primary max-w-[200px] truncate">{r.summary}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{r.requestType?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <StateBadge state={r.priority} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {r.requester ? `${r.requester.firstName} ${r.requester.lastName}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-tertiary">{formatDate(r.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded-full ${sla.cls}`}>
                          {sla.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {rejectId === r.id ? (
                          <div className="flex flex-col gap-2">
                            <textarea
                              className="w-full px-2 py-1.5 border border-cwc-border rounded text-xs focus:ring-2 focus:ring-brand-700/20 outline-none"
                              placeholder="Rejection reason..."
                              value={rejectReason}
                              onChange={e => setRejectReason(e.target.value)}
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleInlineReject}
                                disabled={isActioning}
                                className="px-3 py-1 text-xs font-bold bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => { setRejectId(null); setRejectReason(''); }}
                                className="px-3 py-1 text-xs font-semibold text-text-secondary hover:bg-surface-muted rounded transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleInlineApprove(r.id)}
                              disabled={isActioning}
                              className="px-3 py-1 text-xs font-bold bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                              {isActioning ? '...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => setRejectId(r.id)}
                              disabled={isActioning}
                              className="px-3 py-1 text-xs font-bold bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
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
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-cwc-border">
            <span className="text-sm text-text-tertiary">{total} total</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm font-semibold text-text-secondary hover:bg-surface-muted rounded disabled:opacity-30 transition-colors"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 text-sm font-semibold rounded transition-colors ${p === page ? 'bg-brand-700 text-white' : 'text-text-secondary hover:bg-surface-muted'}`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm font-semibold text-text-secondary hover:bg-surface-muted rounded disabled:opacity-30 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApprovalQueue;