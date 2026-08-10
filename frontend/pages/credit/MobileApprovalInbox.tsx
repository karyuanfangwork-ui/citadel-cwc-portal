import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import creditService, { CreditApplication, ApprovalDecision } from '../../src/services/credit.service';
import { dashboardApi } from '../../src/services/credit.service';
import type { ApprovalInboxItem } from '../../src/services/credit.types';
import { useAuth } from '../../src/context/AuthContext';
import { hasPermission } from '../../src/utils/permissions';
import toast from 'react-hot-toast';
import StateBadge from '../../src/components/ui/StateBadge';
import { validateApprovalDecision, buildApprovalPayload, COMMENT_MIN_LENGTH } from '../../src/components/credit/approvalDecision';

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
  const [rejectionReasonCode, setRejectionReasonCode] = useState('');
  const [rejectionReasonCodes, setRejectionReasonCodes] = useState<{ value: string; label: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false); // for REJECT / CONDITIONAL

  const fetchInbox = useCallback(async () => {
    try {
      const res = await dashboardApi.getApprovalInbox();
      const inbox = res.data.data;
      // The inbox is bucketed by priority (high/medium/low). Flatten into a
      // single list and map each ApprovalInboxItem into the shape MobileApprovalInbox
      // expects — the same mapping pattern MyApprovals.tsx uses via toApplication().
      const allItems: ApprovalInboxItem[] = [...inbox.high, ...inbox.medium, ...inbox.low];
      const mapped: ApprovalItem[] = allItems.map((item) => ({
        application: {
          ...item,
          id: item.applicationId,
          applicationNumber: item.applicationNo,
          state: item.currentState,
          createdAt: item.submittedAt,
          borrowerProfile: { name: item.borrowerName } as CreditApplication['borrowerProfile'],
        } as unknown as CreditApplication,
        approvalId: item.applicationId,
        daysWaiting: item.daysWaiting,
        isUrgent: item.urgency === 'high' || item._slaBreached === true,
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
    // LOS-012 — CONDITIONAL requires a condition editor, so route to full panel
    if (d === 'CONDITIONAL') {
      navigate(`/credit/applications/${selectedId}?tab=approvals`);
      return;
    }
    if (d === 'REJECT') {
      setDecision(d);
      // Load rejection reason codes
      if (rejectionReasonCodes.length === 0) {
        creditService.listRejectionReasonCodes?.()
          .then(setRejectionReasonCodes)
          .catch(() => setRejectionReasonCodes([]));
      }
      setShowCommentModal(true);
      return;
    }
    // APPROVE / RETURN — quick path with validation
    const input = { decision: d, comment: '' };
    const validationError = validateApprovalDecision(input);
    if (validationError) { toast.error(validationError); return; }
    setSubmitting(true);
    try {
      await creditService.submitApproval(selectedId, buildApprovalPayload(input));
      toast.success(d === 'APPROVE' ? 'Approved' : 'Returned');
      setSelectedId(null);
      fetchInbox();
    } catch (e) {
      toast.error('Failed to submit decision');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommentSubmit = async () => {
    if (!selectedId || !decision) return;
    const input = { decision: decision as ApprovalDecision, comment, rejectionReasonCode };
    const validationError = validateApprovalDecision(input);
    if (validationError) { toast.error(validationError); return; }
    setSubmitting(true);
    try {
      await creditService.submitApproval(selectedId, buildApprovalPayload(input));
      toast.success(decision === 'REJECT' ? 'Rejected' : 'Conditionally Approved');
      setShowCommentModal(false);
      setComment('');
      setRejectionReasonCode('');
      setDecision('');
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
                  <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Approval decision">
                    <button
                      onClick={() => handleQuickDecision('APPROVE')}
                      disabled={submitting}
                      className="flex items-center justify-center gap-1 py-3 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 active:bg-green-800 disabled:opacity-50 min-h-[44px]"
                      aria-label="Approve this application"
                    >
                      <span className="material-symbols-outlined text-base">check_circle</span>
                      Approve
                    </button>
                    <button
                      onClick={() => handleQuickDecision('CONDITIONAL')}
                      disabled={submitting}
                      className="flex items-center justify-center gap-1 py-3 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 min-h-[44px]"
                      aria-label="Conditionally approve this application"
                    >
                      <span className="material-symbols-outlined text-base">rule</span>
                      Conditional
                    </button>
                    <button
                      onClick={() => handleQuickDecision('REJECT')}
                      disabled={submitting}
                      className="flex items-center justify-center gap-1 py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 active:bg-red-800 disabled:opacity-50 min-h-[44px]"
                      aria-label="Reject this application"
                    >
                      <span className="material-symbols-outlined text-base">cancel</span>
                      Reject
                    </button>
                  </div>
                  <button
                    onClick={() => handleQuickDecision('RETURN')}
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

      {/* ── Comment Modal (REJECT / CONDITIONAL) ──────────── │ */}
      {showCommentModal && selectedId && decision && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={() => { setShowCommentModal(false); setComment(''); setDecision(''); }}>
          <div
            className="w-full max-w-lg bg-white rounded-t-2xl p-5 animate-slide-up"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={decision === 'REJECT' ? 'Rejection reason' : 'Conditional approval reason'}
          >
            <h3 className="text-base font-bold text-gray-900 mb-3">
              {decision === 'REJECT' ? 'Reason for rejection *' : 'Reason for conditional approval *'}
            </h3>
            {decision === 'REJECT' && (
              <select
                value={rejectionReasonCode}
                onChange={(e) => setRejectionReasonCode(e.target.value)}
                aria-label="Rejection reason code"
                className="w-full mb-2 rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">Select a rejection reason…</option>
                {rejectionReasonCodes.map((rc) => (
                  <option key={rc.value} value={rc.value}>{rc.label}</option>
                ))}
              </select>
            )}
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={4}
              className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 resize-none ${
                decision === 'REJECT'
                  ? 'border-red-200 focus:ring-red-500/30 focus:border-red-500'
                  : 'border-amber-200 focus:ring-amber-500/30 focus:border-amber-500'
              }`}
              placeholder={`Minimum ${COMMENT_MIN_LENGTH} characters required…`}
              required
              autoFocus
            />
            {comment.trim().length > 0 && comment.trim().length < COMMENT_MIN_LENGTH && (
              <p className="text-xs text-amber-500 mt-1">
                {comment.trim().length}/{COMMENT_MIN_LENGTH} characters minimum
              </p>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setShowCommentModal(false); setComment(''); setDecision(''); }}
                className="flex-1 py-3 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleCommentSubmit}
                disabled={validateApprovalDecision({ decision: decision as ApprovalDecision, comment, rejectionReasonCode }) !== null || submitting}
                className={`flex-1 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-50 min-h-[44px] ${
                  decision === 'REJECT' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'
                }`}
              >
                {submitting ? 'Submitting...' : decision === 'REJECT' ? 'Confirm Rejection' : 'Confirm Conditional'}
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