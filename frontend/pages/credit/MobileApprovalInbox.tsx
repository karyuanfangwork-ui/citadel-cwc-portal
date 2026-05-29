import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import creditService, { CreditApplication, ApprovalDecision } from '../../src/services/credit.service';
import { dashboardApi } from '../../src/services/credit.service';
import { useAuth } from '../../src/context/AuthContext';
import { hasPermission } from '../../src/utils/permissions';
import toast from 'react-hot-toast';
import StateBadge from '../../src/components/ui/StateBadge';

/**
 * MobileApprovalInbox — Mobile-optimised approval inbox (§3.3).
 *
 * Route: /credit/m/approvals
 * Optimised for ≤768px screens with:
 *  - Card-based list: borrower name, product, amount, urgency badge, days waiting
 *  - Tap card → slide-up detail sheet (approval pack preview from §3.1)
 *  - Action bar: APPROVE, REJECT (requires comment), DEFER
 *  - Pull-to-refresh
 *  - Filter chips: urgent / awaiting me / all
 */

type FilterMode = 'all' | 'urgent' | 'awaiting_me';

interface ApprovalItem {
  application: CreditApplication;
  approvalId: string;
  daysWaiting: number;
  isUrgent: boolean;
}

const MobileApprovalInbox: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canApprove = hasPermission(user, 'credit:approve');

  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decision, setDecision] = useState<ApprovalDecision | ''>('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const fetchInbox = useCallback(async () => {
    try {
      const res = await dashboardApi.getApprovalInbox();
      const data = res.data?.data ?? res.data ?? res;
      const mapped: ApprovalItem[] = (data.items ?? data ?? []).map((item: any) => ({
        application: item.application ?? item,
        approvalId: item.approvalId ?? item.id,
        daysWaiting: item.daysWaiting ?? Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86400000),
        isUrgent: item.isUrgent ?? item.priority === 'URGENT',
      }));
      setItems(mapped);
    } catch (e) {
      console.error('Failed to load inbox', e);
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchInbox(); }, [fetchInbox]);

  // Pull-to-refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchInbox();
  };

  const selectedItem = items.find(i => i.application.id === selectedId);

  const filteredItems = items.filter(item => {
    if (filter === 'urgent') return item.isUrgent;
    if (filter === 'awaiting_me') return true; // all items in inbox are awaiting the current user
    return true;
  });

  const handleQuickDecision = async (d: ApprovalDecision) => {
    if (!selectedId || !canApprove) return;
    if (d === 'REJECTED') {
      setDecision(d);
      setShowRejectModal(true);
      return;
    }
    setSubmitting(true);
    try {
      await creditService.submitApproval(selectedId, { decision: d });
      toast.success(d === 'APPROVED' ? 'Approved' : 'Deferred');
      setSelectedId(null);
      fetchInbox();
    } catch (e) {
      toast.error('Failed to submit decision');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!selectedId || !comment.trim()) return;
    setSubmitting(true);
    try {
      await creditService.submitApproval(selectedId, { decision: 'REJECTED', comment: comment.trim() });
      toast.success('Rejected');
      setShowRejectModal(false);
      setComment('');
      setSelectedId(null);
      fetchInbox();
    } catch (e) {
      toast.error('Failed to submit decision');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" role="main" aria-label="Mobile Approval Inbox">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 safe-area-top">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">Approvals</h1>
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-600 hover:text-gray-900"
            aria-label="Refresh"
          >
            <span className={`material-symbols-outlined ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </div>
        {/* Filter chips */}
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto" role="tablist" aria-label="Filter approvals">
          {([
            { key: 'all', label: 'All' },
            { key: 'urgent', label: '🔥 Urgent' },
            { key: 'awaiting_me', label: 'Awaiting Me' },
          ] as { key: FilterMode; label: string }[]).map(f => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors min-h-[32px] ${
                filter === f.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Card List ──────────────────────────────────── │ */}
      <main className="flex-1 px-4 py-3 space-y-3 overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-gray-300 block mb-3">task_alt</span>
            <p className="text-base font-bold text-gray-700">No pending approvals</p>
            <p className="text-sm text-gray-500 mt-1">You're all caught up!</p>
          </div>
        ) : (
          filteredItems.map(item => (
            <button
              key={item.approvalId}
              onClick={() => setSelectedId(item.application.id)}
              className={`w-full text-left bg-white rounded-xl border p-4 transition-shadow min-h-[44px] ${
                selectedId === item.application.id ? 'border-blue-400 shadow-lg ring-1 ring-blue-100' :
                item.isUrgent ? 'border-red-200 shadow-sm' : 'border-gray-200 shadow-sm hover:shadow-md'
              }`}
              aria-label={`${item.application.borrowerProfile?.account?.name ?? 'Application'} — ${item.application.productType}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-900 truncate">
                      {item.application.borrowerProfile?.account?.name ?? item.application.applicationNo ?? item.application.id.slice(0, 8)}
                    </h3>
                    {item.isUrgent && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 shrink-0">
                        Urgent
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {item.application.productType} · {item.application.currency} {(item.application.requestedAmount ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <StateBadge state={item.application.state} size="sm" />
                  <p className="text-[10px] text-gray-400 mt-0.5">{item.daysWaiting}d waiting</p>
                </div>
              </div>
            </button>
          ))
        )}
      </main>

      {/* ── Detail Sheet (slide-up) ─────────────────────── │ */}
      {selectedId && selectedItem && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => { setSelectedId(null); setDecision(''); }}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto animate-slide-up"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Approval detail for ${selectedItem.application.borrowerProfile?.account?.name ?? selectedItem.application.id.slice(0, 8)}`}
          >
            {/* Drag handle */}
            <div className="flex justify-center py-2">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            <div className="px-4 pb-24">
              {/* Application info */}
              <div className="mb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  {selectedItem.application.borrowerProfile?.account?.name ?? selectedItem.application.applicationNo}
                </h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  {selectedItem.application.productType} · {selectedItem.application.currency} {(selectedItem.application.requestedAmount ?? 0).toLocaleString()}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <StateBadge state={selectedItem.application.state} size="sm" />
                  {selectedItem.isUrgent && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-700">Urgent</span>
                  )}
                  <span className="text-xs text-gray-400">{selectedItem.daysWaiting}d waiting</span>
                </div>
              </div>

              {/* Approval Pack Preview (iframe) */}
              <div className="mb-4 border border-gray-200 rounded-xl overflow-hidden">
                <iframe
                  src={`/api/v1/credit/applications/${selectedId}/approval-pack`}
                  className="w-full border-0"
                  style={{ height: '200px' }}
                  title="Approval Pack Preview"
                />
                <div className="bg-gray-50 px-3 py-2 border-t border-gray-200">
                  <button
                    onClick={() => navigate(`/credit/applications/${selectedId}?tab=approvals`)}
                    className="text-xs text-blue-600 font-semibold"
                  >
                    Open full Approval Pack →
                  </button>
                </div>
              </div>

              {/* Action bar */}
              {canApprove && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Approval decision">
                    <button
                      onClick={() => handleQuickDecision('APPROVED')}
                      disabled={submitting}
                      className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 active:bg-green-800 disabled:opacity-50 min-h-[44px]"
                      aria-label="Approve this application"
                    >
                      <span className="material-symbols-outlined text-lg">check_circle</span>
                      Approve
                    </button>
                    <button
                      onClick={() => handleQuickDecision('REJECTED')}
                      disabled={submitting}
                      className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 active:bg-red-800 disabled:opacity-50 min-h-[44px]"
                      aria-label="Reject this application"
                    >
                      <span className="material-symbols-outlined text-lg">cancel</span>
                      Reject
                    </button>
                  </div>
                  <button
                    onClick={() => handleQuickDecision('RETURNED')}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-gray-300 bg-gray-50 text-gray-700 font-bold text-sm hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50 min-h-[44px]"
                    aria-label="Defer this application"
                  >
                    <span className="material-symbols-outlined text-lg">undo</span>
                    Defer
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Comment Modal ──────────────────────────── │ */}
      {showRejectModal && selectedId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={() => setShowRejectModal(false)}>
          <div
            className="w-full max-w-lg bg-white rounded-t-2xl p-5 animate-slide-up"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Rejection reason"
          >
            <h3 className="text-base font-bold text-gray-900 mb-3">Reason for rejection *</h3>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 resize-none"
              placeholder="Why are you rejecting this application? This is required."
              required
              autoFocus
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setShowRejectModal(false); setComment(''); }}
                className="flex-1 py-3 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={!comment.trim() || submitting}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 min-h-[44px]"
              >
                {submitting ? 'Submitting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Slide-up animation (inline styles) ──────────── │ */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default MobileApprovalInbox;