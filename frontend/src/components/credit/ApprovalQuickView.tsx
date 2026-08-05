import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import creditService, {
  CreditApplication, CreditApproval, ApplicationState, ApprovalDecision,
} from '../../services/credit.service';
import { pollPdfJob } from '../../services/pdfJob.service';
import { formatCurrency, formatDate } from '../../../pages/credit/creditUtils';
import StateBadge from './StateBadge';
import RiskBadge from './RiskBadge';
import { useAuth } from '../../context/AuthContext';
import { getBorrowerDisplayName } from './BorrowerSummaryCard';

interface ApprovalQuickViewProps {
  open: boolean;
  onClose: () => void;
  application: CreditApplication | null;
  onDecision?: (applicationId: string, decision: ApprovalDecision) => void;
}

const ApprovalQuickView: React.FC<ApprovalQuickViewProps> = ({
  open, onClose, application, onDecision,
}) => {
  const { user } = useAuth();
  const isRmOnApplication = !!(application?.rmId && user && application.rmId === user.id);
  const [fullApp, setFullApp] = useState<CreditApplication | null>(null);
  const [approvals, setApprovals] = useState<CreditApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [showDecision, setShowDecision] = useState<ApprovalDecision | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!application) return;
    setLoading(true);
    try {
      const [app, appApprovals] = await Promise.all([
        creditService.getApplication(application.id),
        creditService.listApprovals(application.id).catch(() => [] as CreditApproval[]),
      ]);
      setFullApp(app);
      setApprovals(appApprovals);
    } catch (e) {
      console.error('Failed to load approval detail', e);
    } finally {
      setLoading(false);
    }
  }, [application]);

  useEffect(() => {
    if (open && application) fetchDetail();
    if (!open) {
      setFullApp(null);
      setApprovals([]);
      setComment('');
      setShowDecision(null);
    }
  }, [open, application, fetchDetail]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Prevent body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleSubmitDecision = async (decision: ApprovalDecision) => {
    if (!application) return;
    setDecisionLoading(true);
    try {
      await creditService.submitApproval(application.id, {
        decision,
        comment: comment.trim() || undefined,
      });
      onDecision?.(application.id, decision);
      setShowDecision(null);
      setComment('');
      onClose();
    } catch (e) {
      console.error('Decision failed', e);
    } finally {
      setDecisionLoading(false);
    }
  };

  if (!open || !application) return null;

  const app = fullApp || application;
  const state = (app.state || app.status) as ApplicationState;
  const borrowerName = app.borrowerProfile ? getBorrowerDisplayName(app.borrowerProfile) : app.id.slice(0, 8);
  const analystName = app.analyst
    ? `${app.analyst.firstName} ${app.analyst.lastName}`
    : null;
  const rmName = app.rm
    ? `${app.rm.firstName} ${app.rm.lastName}`
    : null;

  // Use scrollHeight to cover the entire document (not just viewport)
  const docHeight = typeof document !== 'undefined' ? document.documentElement.scrollHeight : '100vh';

  return createPortal(
    <div
      className="absolute inset-0 z-[9999] flex justify-end"
      style={{ width: '100%', height: docHeight, top: 0, left: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Full-page backdrop — covers entire document including below-the-fold */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-hidden="true"
      />

      {/* Slide-over panel — fixed to viewport so it stays visible on scroll */}
      <div
        className="fixed top-0 right-0 w-full max-w-[480px] h-screen bg-white shadow-2xl overflow-y-auto flex flex-col z-[10000]"
        role="dialog"
        aria-modal="true"
        aria-label={`Quick view: ${borrowerName}`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-black text-gray-900">Quick View</h2>
            <p className="text-xs text-gray-500">Approval decision context</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-lg p-2 hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-6">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-4 rounded bg-gray-100" style={{ width: `${50 + Math.random() * 40}%` }} />
              ))}
            </div>
          ) : (
            <>
              {/* Borrower / Application Identity */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <StateBadge state={state} size="sm" />
                  <RiskBadge rating={app.riskRating} size="sm" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">{borrowerName}</h3>
                <p className="text-sm text-gray-600 mt-0.5">
                  {app.applicationNo || app.id.slice(0, 8)} · {formatCurrency(app.requestedAmount, app.currency)}
                  {app.requestedTenor != null ? ` · ${app.requestedTenor} mo` : ''}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {app.productType.replace(/_/g, ' ')}
                </p>
              </div>

              {/* Decision Context card */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Decision Context</h4>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-medium">Risk Rating</span>
                    <div className="mt-1"><RiskBadge rating={app.riskRating} showIcon={false} size="md" /></div>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-medium">Product Type</span>
                    <p className="text-sm font-semibold text-gray-900 mt-1">{app.productType.replace(/_/g, ' ')}</p>
                  </div>
                  {analystName && (
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-medium">Credit Analyst</span>
                      <p className="text-sm font-semibold text-gray-900 mt-1">{analystName}</p>
                    </div>
                  )}
                  {rmName && (
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-medium">Relationship Mgr</span>
                      <p className="text-sm font-semibold text-gray-900 mt-1">{rmName}</p>
                    </div>
                  )}
                  {app.borrowerProfile?.totalExposure != null && (
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-medium">Total Exposure</span>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {formatCurrency(app.borrowerProfile.totalExposure, app.currency)}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-medium">Submitted</span>
                    <p className="text-sm font-semibold text-gray-900 mt-1">{formatDate(app.submittedAt || app.createdAt)}</p>
                  </div>
                </div>

                {app.purpose && (
                  <div className="pt-3 border-t border-gray-200">
                    <span className="text-[10px] text-gray-400 uppercase font-medium">Purpose</span>
                    <p className="text-sm text-gray-700 mt-1 leading-relaxed">{app.purpose}</p>
                  </div>
                )}
              </div>

              {/* Facilities Summary */}
              {app.facilities && app.facilities.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">Facilities</h4>
                  <div className="space-y-2">
                    {app.facilities.map(f => (
                      <div key={f.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5">
                        <span className="text-sm text-gray-800 font-medium">{f.facilityType.replace(/_/g, ' ')}</span>
                        <span className="text-sm font-bold text-gray-900">
                          {formatCurrency(f.amount, f.currency || app.currency)}{f.tenorMonths ? ` / ${f.tenorMonths}mo` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Existing Approvals Timeline */}
              {approvals.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">Approval Timeline</h4>
                  <div className="relative space-y-0">
                    {approvals.map((a, idx) => {
                      const name = a.approver ? `${a.approver.firstName} ${a.approver.lastName}` : 'Approver';
                      const isApprove = a.decision === 'APPROVE';
                      const isReject = a.decision === 'REJECT';
                      return (
                        <div key={a.id} className="flex gap-3 pb-3">
                          <div className="flex flex-col items-center">
                            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${isApprove ? 'bg-green-500' : isReject ? 'bg-red-500' : 'bg-amber-500'}`} />
                            {idx < approvals.length - 1 && <div className="w-px flex-1 bg-gray-200" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{name}</p>
                            <p className={`text-xs font-bold ${isApprove ? 'text-green-600' : isReject ? 'text-red-600' : 'text-amber-600'}`}>
                              {a.decision}
                              {a.comment && <span className="font-normal text-gray-500"> — {a.comment}</span>}
                            </p>
                            <p className="text-xs text-gray-400">{formatDate(a.decidedAt || a.createdAt)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom Decision Actions — sticky */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 shrink-0">
          {isRmOnApplication ? (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <span className="material-symbols-outlined text-amber-500 text-xl mt-0.5">warning</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-800 mb-1">Segregation of Duties — Action Restricted</p>
                <p className="text-xs text-amber-700">
                  You are the assigned Relationship Manager for this application. Due to SOD policy, you cannot approve your own application. Another authorized approver must submit the decision.
                </p>
              </div>
            </div>
          ) : !showDecision ? (
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Your Decision</h4>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDecision('APPROVE')}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2.5 text-sm font-bold transition-colors"
                >
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  Approve
                </button>
                <button
                  onClick={() => setShowDecision('REJECT')}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2.5 text-sm font-bold transition-colors"
                >
                  <span className="material-symbols-outlined text-base">cancel</span>
                  Reject
                </button>
                <button
                  onClick={() => setShowDecision('RETURN')}
                  className="flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-amber-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">undo</span>
                  Return
                </button>
              </div>
              {/* §1.10 — CA Memo Preview */}
              {fullApp && (
                <button
                  onClick={async () => {
                    try {
                      const { jobId } = await creditService.downloadCaMemo(fullApp.id);
                      const url = await pollPdfJob(jobId);
                      window.open(url, '_blank');
                    } catch (e) {
                      console.error('Failed to generate CA Memo preview', e);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg px-4 py-2.5 text-sm font-bold transition-colors"
                >
                  <span className="material-symbols-outlined text-base">description</span>
                  Preview CA Memo
                </button>
              )}
              <a
                href={`/credit/applications/${app.id}?tab=approvals`}
                onClick={(e) => { e.preventDefault(); onClose(); window.location.href = `/credit/applications/${app.id}?tab=approvals`; }}
                className="flex items-center justify-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors pt-1"
              >
                <span className="material-symbols-outlined text-base">open_in_new</span>
                Open full application detail
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                {showDecision === 'APPROVE' && 'Approve this application'}
                {showDecision === 'REJECT' && 'Reject this application — a reason is required'}
                {showDecision === 'RETURN' && 'Return to analyst for more work — a reason is required'}
              </p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  showDecision === 'APPROVE'
                    ? 'Optional conditions or comments...'
                    : 'Reason for decision (required)...'
                }
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleSubmitDecision(showDecision)}
                  disabled={decisionLoading || (showDecision !== 'APPROVE' && !comment.trim())}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50 ${
                    showDecision === 'APPROVE' ? 'bg-green-600 hover:bg-green-700' :
                    showDecision === 'REJECT' ? 'bg-red-600 hover:bg-red-700' :
                    'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {decisionLoading ? (
                    <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-base">
                      {showDecision === 'APPROVE' ? 'check_circle' : showDecision === 'REJECT' ? 'cancel' : 'undo'}
                    </span>
                  )}
                  Confirm {showDecision === 'APPROVE' ? 'Approve' : showDecision === 'REJECT' ? 'Reject' : 'Return'}
                </button>
                <button
                  onClick={() => { setShowDecision(null); setComment(''); }}
                  className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ApprovalQuickView;