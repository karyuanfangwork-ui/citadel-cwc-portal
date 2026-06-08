/**
 * CreditApplicationMobileSummary — Mobile-optimised credit application summary (S8.3).
 *
 * Route: /credit/m/applications/:id
 * Minimal card-based view for mobile: borrower name, amount, risk rating,
 * state badge, key actions (approve / reject).
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import creditService, { CreditApplication } from '../../src/services/credit.service';
import { useAuth } from '../../src/context/AuthContext';
import { hasPermission } from '../../src/utils/permissions';
import StateBadge from '../../src/components/credit/StateBadge';
import { formatCurrency, formatDate, PRODUCT_LABELS } from './creditUtils';
import toast from 'react-hot-toast';

const CreditApplicationMobileSummary: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [app, setApp] = useState<CreditApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const canApprove = hasPermission(user, 'credit:approve');
  const isCommitteeReview = app?.state === 'COMMITTEE_REVIEW';
  const showActions = canApprove && isCommitteeReview;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    creditService
      .getApplication(id)
      .then(setApp)
      .catch((err) => {
        console.error('Failed to load application', err);
        toast.error('Failed to load application');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const borrowerName = (() => {
    if (!app?.borrowerProfile) return '—';
    const bp = app.borrowerProfile;
    if (bp.account?.name) return bp.account.name;
    if (bp.contact) return `${bp.contact.firstName} ${bp.contact.lastName}`.trim();
    return bp.name || '—';
  })();

  const handleApprove = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await creditService.transitionApplication(id, { action: 'approve' });
      toast.success('Application approved');
      // Reload to reflect updated state
      const updated = await creditService.getApplication(id);
      setApp(updated);
    } catch (err) {
      console.error('Approve failed', err);
      toast.error('Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!id) return;
    if (!rejectReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    setActionLoading(true);
    try {
      await creditService.transitionApplication(id, {
        action: 'reject',
        reason: rejectReason.trim(),
      });
      toast.success('Application rejected');
      const updated = await creditService.getApplication(id);
      setApp(updated);
      setShowRejectModal(false);
      setRejectReason('');
    } catch (err) {
      console.error('Reject failed', err);
      toast.error('Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Loading skeleton ────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 sm:py-8 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-2/3" />
          <div className="h-32 bg-white rounded-xl" />
          <div className="h-24 bg-white rounded-xl" />
          <div className="h-16 bg-white rounded-xl" />
        </div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-gray-300">error_outline</span>
          <p className="mt-2 text-sm text-gray-500">Application not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 sm:py-8 max-w-lg mx-auto">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
          aria-label="Go back"
        >
          <span className="material-symbols-outlined text-xl text-gray-600">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">
            {app.applicationNo || `App #${app.id.slice(0, 8)}`}
          </h1>
          <p className="text-xs text-gray-500">Credit Application</p>
        </div>
        <StateBadge state={app.state} size="md" />
      </div>

      {/* ── Borrower Card ───────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-white text-xl">person</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{borrowerName}</p>
            <p className="text-xs text-gray-500 capitalize">
              {app.borrowerProfile?.borrowerType?.replace(/_/g, ' ').toLowerCase() || '—'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
          <div>
            <p className="text-gray-400 mb-0.5">Product</p>
            <p className="font-medium text-gray-800">
              {PRODUCT_LABELS[app.productType] || app.productType.replace(/_/g, ' ')}
            </p>
          </div>
          <div>
            <p className="text-gray-400 mb-0.5">Risk Rating</p>
            <p className="font-medium text-gray-800">{app.riskRating || '—'}</p>
          </div>
          <div>
            <p className="text-gray-400 mb-0.5">Tenor</p>
            <p className="font-medium text-gray-800">
              {app.requestedTenor ? `${app.requestedTenor} mo` : '—'}
            </p>
          </div>
          <div>
            <p className="text-gray-400 mb-0.5">Submitted</p>
            <p className="font-medium text-gray-800">{formatDate(app.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* ── Amount Card ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-3">
        <p className="text-xs text-gray-400 mb-1">Requested Amount</p>
        <p className="text-2xl font-bold text-blue-700">
          {formatCurrency(app.requestedAmount, app.currency)}
        </p>
        {app.purpose && (
          <p className="text-xs text-gray-500 mt-2 line-clamp-2">{app.purpose}</p>
        )}
      </div>

      {/* ── Action Buttons ─────────────────────────────────── */}
      {showActions && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Committee Actions
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span className="material-symbols-outlined text-base">check_circle</span>
              Approve
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={actionLoading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white border border-red-300 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span className="material-symbols-outlined text-base">cancel</span>
              Reject
            </button>
          </div>
        </div>
      )}

      {/* ── Full Detail Link ────────────────────────────────── */}
      <Link
        to={`/credit/applications/${app.id}`}
        className="flex items-center justify-center gap-1.5 w-full py-3 rounded-xl bg-white border border-gray-200 text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors"
      >
        <span className="material-symbols-outlined text-base">open_in_new</span>
        View Full Details
      </Link>

      {/* ── Reject Reason Modal ────────────────────────────── */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-red-500">cancel</span>
              <h2 className="text-base font-bold text-gray-900">Reject Application</h2>
            </div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Reason for rejection <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-transparent resize-none"
              placeholder="Enter rejection reason..."
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectReason.trim()}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditApplicationMobileSummary;