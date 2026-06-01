import React, { useEffect, useState } from 'react';
import creditService, {
  CreditApplication,
  CreditApproval,
  ApprovalDecision,
  ApprovalMatrixLookup,
} from '../../services/credit.service';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/permissions';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../utils/errorMessages';
import { formatDateTime } from '../../../pages/credit/creditUtils';

// ── Types ──────────────────────────────────────────────────────────

interface ChainStage {
  stageNumber: number;
  approval: CreditApproval | null;
}

interface Props {
  application: CreditApplication;
  approvals: CreditApproval[];
  onActionComplete: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────

const DECISION_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  APPROVE:  { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'check_circle' },
  REJECT:   { bg: 'bg-red-50',     text: 'text-red-700',     icon: 'cancel' },
  RETURN:   { bg: 'bg-amber-50',   text: 'text-amber-700',   icon: 'undo' },
  ESCALATE: { bg: 'bg-purple-50',  text: 'text-purple-700',  icon: 'arrow_upward' },
};

const DECISION_BUTTONS: { decision: ApprovalDecision; label: string; classes: string }[] = [
  { decision: 'APPROVE',  label: 'Approve',  classes: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  { decision: 'REJECT',   label: 'Reject',   classes: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' },
  { decision: 'RETURN',   label: 'Return',   classes: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
  { decision: 'ESCALATE', label: 'Escalate', classes: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
];

// ── Component ──────────────────────────────────────────────────────

const ApprovalChainPanel: React.FC<Props> = ({ application, approvals, onActionComplete }) => {
  const { user } = useAuth();
  const canApprove = hasPermission(user, 'credit:approve');

  const [matrixLookup, setMatrixLookup] = useState<ApprovalMatrixLookup | null>(null);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [lookupError, setLookupError] = useState(false);

  const [selectedDecision, setSelectedDecision] = useState<ApprovalDecision | ''>('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const exposure = Number(application.requestedAmount || 0);
    const riskRating = application.riskRating;
    if (!exposure || !riskRating) {
      setLookupLoading(false);
      return;
    }
    setLookupLoading(true);
    creditService.lookupApprovalAuthority({ exposure, riskRating })
      .then(result => {
        setMatrixLookup(result);
        setLookupError(false);
      })
      .catch(() => setLookupError(true))
      .finally(() => setLookupLoading(false));
  }, [application.requestedAmount, application.riskRating]);

  const requiredCount = matrixLookup?.requiredApproverCount ?? 1;
  const sortedApprovals = [...approvals].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const stages: ChainStage[] = Array.from({ length: requiredCount }, (_, i) => ({
    stageNumber: i + 1,
    approval: sortedApprovals[i] ?? null,
  }));

  const activeStageIdx = stages.findIndex(s => s.approval === null);
  const isChainComplete = activeStageIdx === -1;
  const commentRequired = requiredCount >= 3;

  const handleSubmit = async () => {
    if (!selectedDecision || !application.id) return;
    if (commentRequired && !comment.trim()) {
      toast.error('Comment is required for this approval tier');
      return;
    }
    setSubmitting(true);
    try {
      await creditService.submitApproval(application.id, {
        decision: selectedDecision,
        comment: comment.trim() || undefined,
      });
      toast.success('Decision submitted');
      setSelectedDecision('');
      setComment('');
      onActionComplete();
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to submit decision'));
    } finally {
      setSubmitting(false);
    }
  };

  if (lookupLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── SOD Warning ────────────────────────────── */}
      {application.rmId && user && application.rmId === user.id && canApprove && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <span className="material-symbols-outlined text-amber-500 text-xl mt-0.5">warning</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800 mb-1">Segregation of Duties — Action Restricted</p>
            <p className="text-xs text-amber-700">
              You are the assigned Relationship Manager for this application. Due to SOD policy, you cannot approve your own application. Another authorized approver must submit the decision.
            </p>
          </div>
        </div>
      )}

      {/* ── Chain header ───────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          {lookupError || !matrixLookup ? (
            <p className="text-xs text-amber-600">
              Could not determine approval chain — set risk rating and loan amount to enable matrix lookup.
            </p>
          ) : (
            <p className="text-xs text-gray-500">
              Authority level: <span className="font-semibold text-gray-800">{matrixLookup.authorityLevel}</span>
              {matrixLookup.matrixName && <> · {matrixLookup.matrixName}</>}
              {' '}· <span className="font-semibold">{requiredCount}</span> approver{requiredCount !== 1 ? 's' : ''} required
            </p>
          )}
        </div>
      </div>

      {/* ── Chain stages ───────────────────────────── */}
      <div className="space-y-2">
        {stages.map((stage, idx) => {
          const a = stage.approval;
          const isActive = idx === activeStageIdx;
          const style = a ? (DECISION_STYLES[a.decision] ?? DECISION_STYLES.APPROVE) : null;

          return (
            <div key={stage.stageNumber} className="flex gap-3 items-start">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    a
                      ? (style!.bg + ' ' + style!.text)
                      : isActive
                      ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-300'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {a ? (
                    <span className="material-symbols-outlined text-sm">{style!.icon}</span>
                  ) : (
                    stage.stageNumber
                  )}
                </div>
                {idx < stages.length - 1 && (
                  <div className={`w-0.5 h-6 mt-1 ${a ? 'bg-gray-300' : 'bg-gray-100'}`} />
                )}
              </div>

              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">
                    Stage {stage.stageNumber}
                  </span>
                  {a && (
                    <>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${style!.bg} ${style!.text}`}>
                        {a.decision.charAt(0) + a.decision.slice(1).toLowerCase()}
                      </span>
                      {a.authorityLevel && (
                        <span className="text-[10px] text-gray-400">{a.authorityLevel}</span>
                      )}
                    </>
                  )}
                  {!a && isActive && (
                    <span className="text-xs text-brand-600 font-medium">Pending your action</span>
                  )}
                  {!a && !isActive && (
                    <span className="text-xs text-gray-400">Waiting for previous stage</span>
                  )}
                </div>
                {a && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {a.approver
                      ? `${a.approver.firstName} ${a.approver.lastName}`
                      : 'Unknown approver'}
                    {' · '}
                    {formatDateTime(a.decidedAt ?? a.createdAt)}
                  </div>
                )}
                {a?.comment && (
                  <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded px-2 py-1">
                    "{a.comment}"
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Submit form (active stage only) ────────── */}
      {canApprove && !isChainComplete && activeStageIdx !== -1 && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-4 bg-gray-50">
          <h4 className="text-sm font-bold text-gray-800">
            Submit Stage {activeStageIdx + 1} Decision
            {commentRequired && (
              <span className="ml-2 text-xs font-normal text-gray-500">(comment required at this tier)</span>
            )}
          </h4>

          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Approval decision">
            {DECISION_BUTTONS.map(({ decision, label, classes }) => (
              <button
                key={decision}
                onClick={() => setSelectedDecision(decision)}
                role="radio"
                aria-checked={selectedDecision === decision}
                className={`px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${classes} ${
                  selectedDecision === decision ? 'ring-2 ring-brand-300' : ''
                }`}
                style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Comment{commentRequired ? ' *' : ''}
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={commentRequired ? 'Required at this approval tier…' : 'Optional comments…'}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 resize-none"
              style={{ fontFamily: 'var(--font-sans)' }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!selectedDecision || submitting || (commentRequired && !comment.trim())}
            className="w-full px-4 py-2.5 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors disabled:opacity-50"
            style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
          >
            {submitting ? 'Submitting…' : 'Submit Decision'}
          </button>
        </div>
      )}

      {/* ── Chain complete notice ───────────────────── */}
      {isChainComplete && approvals.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-4 py-3">
          <span className="material-symbols-outlined text-base">check_circle</span>
          All {requiredCount} approval stage{requiredCount !== 1 ? 's' : ''} complete.
        </div>
      )}
    </div>
  );
};

export default ApprovalChainPanel;
