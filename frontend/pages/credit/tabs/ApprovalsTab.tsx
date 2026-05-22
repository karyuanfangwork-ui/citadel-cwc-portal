import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import creditService, {
  CreditApplication,
  CreditApproval,
  ApprovalDecision,
} from '../../../src/services/credit.service';
import { useAuth } from '../../../src/context/AuthContext';
import { hasPermission } from '../../../src/utils/permissions';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../../src/utils/errorMessages';
import { formatDateTime } from '../creditUtils';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';
import StateBadge from '../../../src/components/ui/StateBadge';
import { STATUS_COLORS } from '../../../src/components/ui/StateBadge';

interface ApprovalsTabProps {
  app: CreditApplication;
  onRefresh: () => void;
}

const ApprovalsTab: React.FC<ApprovalsTabProps> = ({ app, onRefresh }) => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const canApprove = hasPermission(user, 'credit:approve');

  const [approvals, setApprovals] = useState<CreditApproval[]>([]);
  const [approvalDecision, setApprovalDecision] = useState<ApprovalDecision | ''>('');
  const [approvalComment, setApprovalComment] = useState('');
  const [submittingApproval, setSubmittingApproval] = useState(false);

  const fetchApprovals = useCallback(async () => {
    if (!id) return;
    try {
      const data = await creditService.listApprovals(id);
      setApprovals(data);
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to load approvals')); }
  }, [id]);

  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

  const handleSubmitApproval = async () => {
    if (!id || !approvalDecision) return;
    try {
      setSubmittingApproval(true);
      await creditService.submitApproval(id, {
        decision: approvalDecision,
        comment: approvalComment || undefined,
      });
      toast.success('Decision submitted');
      setApprovalDecision('');
      setApprovalComment('');
      fetchApprovals();
      onRefresh();
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to submit decision')); }
    finally { setSubmittingApproval(false); }
  };

  return (
    <div className="space-y-6">
      <CaMemoSection title="Approval History" phase="Phase 3" readOnly>
        {approvals.length === 0 ? (
          <p className="text-sm text-text-secondary">No approvals yet.</p>
        ) : (
          <div className="space-y-4">
            {approvals.map(a => {
              const dc = STATUS_COLORS[a.decision] || { bg: '#6366f120', text: '#6366f1' };
              return (
                <div key={a.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: dc.bg, color: dc.text }}>
                      {a.decision === 'APPROVED' ? '✓' : a.decision === 'REJECTED' ? '✗' : a.decision === 'RETURNED' ? '↩' : '↑'}
                    </div>
                    {a !== approvals[approvals.length - 1] && <div className="w-0.5 flex-1 bg-border mt-1" />}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-text-primary">{a.approver ? `${a.approver.firstName} ${a.approver.lastName}` : 'Unknown'}</span>
                      <StateBadge state={a.decision} size="sm" />
                      {a.isCommitteeVote && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700">Committee</span>}
                    </div>
                    {a.comment && <p className="text-xs text-text-secondary mt-0.5">{a.comment}</p>}
                    <p className="text-xs text-text-secondary mt-0.5">{formatDateTime(a.decidedAt ?? a.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CaMemoSection>

      {canApprove && (
        <CaMemoSection title="Submit Decision" phase="Phase 3" readOnly={false}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">Decision *</label>
              <div className="grid grid-cols-2 gap-2">
                {(['APPROVED', 'REJECTED', 'RETURNED', 'ESCALATED'] as ApprovalDecision[]).map(d => {
                  const colors: Record<string, string> = {
                    APPROVED: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
                    REJECTED: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
                    RETURNED: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
                    ESCALATED: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
                  };
                  return (
                    <button key={d} onClick={() => setApprovalDecision(d)}
                      className={`px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${
                        approvalDecision === d ? 'ring-2 ring-brand-300 ' + colors[d] : colors[d]
                      }`} style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                      {d.charAt(0) + d.slice(1).toLowerCase()}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1">Comment</label>
              <textarea rows={3} value={approvalComment} onChange={e => setApprovalComment(e.target.value)}
                placeholder="Add comments for this decision..."
                className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 resize-none" style={{ fontFamily: 'var(--font-sans)' }} />
            </div>
            <button onClick={handleSubmitApproval} disabled={!approvalDecision || submittingApproval}
              className="w-full px-4 py-2.5 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors disabled:opacity-50"
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              {submittingApproval ? 'Submitting...' : 'Submit Decision'}
            </button>
          </div>
        </CaMemoSection>
      )}
    </div>
  );
};

export default ApprovalsTab;