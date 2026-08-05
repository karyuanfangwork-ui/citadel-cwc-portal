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
  signoffsComplete?: boolean;
  onActionComplete: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────

const DECISION_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  APPROVE:  { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'check_circle' },
  CONDITIONAL: { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'rule' },
  REJECT:   { bg: 'bg-red-50',     text: 'text-red-700',     icon: 'cancel' },
  RETURN:   { bg: 'bg-amber-50',    text: 'text-amber-700',    icon: 'undo' },
  ESCALATE: { bg: 'bg-purple-50',  text: 'text-purple-700',  icon: 'arrow_upward' },
};

const DECISION_BUTTONS: { decision: ApprovalDecision; label: string; classes: string }[] = [
  { decision: 'APPROVE',    label: 'Approve',           classes: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' },
  { decision: 'CONDITIONAL', label: 'Conditional Approve', classes: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
  { decision: 'REJECT',     label: 'Reject',             classes: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' },
  { decision: 'RETURN',     label: 'Refer Back',         classes: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
  { decision: 'ESCALATE',  label: 'Escalate',            classes: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
];

// ── Component ──────────────────────────────────────────────────────

// States where approval submission is allowed (must match backend approvalAction.service.ts)
const APPROVAL_ELIGIBLE_STATES = new Set(['UNDERWRITING', 'CREDIT_ASSESSMENT', 'COMMITTEE_REVIEW']);

const ApprovalChainPanel: React.FC<Props> = ({ application, approvals, signoffsComplete, onActionComplete }) => {
  const { user } = useAuth();
  const canApprove = hasPermission(user, 'credit:approve');
  const isRmOnApplication = !!(application.rmId && user && application.rmId === user.id);
  const isApprovalEligibleState = APPROVAL_ELIGIBLE_STATES.has(application.state);
  const canSubmitApproval = canApprove && !isRmOnApplication && isApprovalEligibleState;

  const [matrixLookup, setMatrixLookup] = useState<ApprovalMatrixLookup | null>(null);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [lookupError, setLookupError] = useState(false);

  const [selectedDecision, setSelectedDecision] = useState<ApprovalDecision | ''>('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rejectionReasonCode, setRejectionReasonCode] = useState('');
  const [rejectionReasonCodes, setRejectionReasonCodes] = useState<{value: string; label: string}[]>([]);
  // §2.5 — Inline conditions for CONDITIONAL approval
  const [conditions, setConditions] = useState<{title: string; description: string; category: string; conditionType: string; dueDate: string}[]>([]);

  // Fetch rejection reason codes on mount
  useEffect(() => {
    creditService.listRejectionReasonCodes?.().then(setRejectionReasonCodes).catch(() => {});
  }, []);

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

  const commentMinLength = selectedDecision === 'REJECT' || selectedDecision === 'CONDITIONAL' ? 10 : 0;

  const handleSubmit = async () => {
    if (!selectedDecision || !application.id) return;
    if (commentRequired && !comment.trim()) {
      toast.error('Comment is required for this approval tier');
      return;
    }
    // Sprint 4: 10-char minimum comment for REJECT / CONDITIONAL
    const COMMENT_MIN_LENGTH = 10;
    const needsMinComment = selectedDecision === 'REJECT' || selectedDecision === 'CONDITIONAL';
    if (needsMinComment && comment.trim().length < COMMENT_MIN_LENGTH) {
      toast.error(`Comment must be at least ${COMMENT_MIN_LENGTH} characters for ${selectedDecision === 'REJECT' ? 'rejection' : 'conditional approval'}`);
      return;
    }
    // §2.7 — Require rejection reason code when rejecting
    if (selectedDecision === 'REJECT' && !rejectionReasonCode) {
      toast.error('Rejection reason code is required');
      return;
    }
    // Refer Back requires a reason (comment)
    if (selectedDecision === 'RETURN' && !comment.trim()) {
      toast.error('A reason is required when referring an application back');
      return;
    }
    // §2.5 — Require at least one condition for CONDITIONAL approval
    if (selectedDecision === 'CONDITIONAL' && conditions.length === 0) {
      toast.error('At least one condition is required for conditional approval');
      return;
    }
    setSubmitting(true);
    try {
      await creditService.submitApproval(application.id, {
        decision: selectedDecision,
        comment: comment.trim() || undefined,
        rejectionReasonCode: selectedDecision === 'REJECT' ? rejectionReasonCode : undefined,
        conditions: selectedDecision === 'CONDITIONAL' ? conditions : undefined,
      });
      toast.success('Decision submitted');
      setSelectedDecision('');
      setComment('');
      setRejectionReasonCode('');
      setConditions([]);
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
      {isRmOnApplication && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <span className="material-symbols-outlined text-amber-500 text-xl mt-0.5">warning</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800 mb-1">Segregation of Duties — Action Restricted</p>
            <p className="text-xs text-amber-700">
              You are the assigned Relationship Manager for this application. Due to SOD policy, you cannot approve your own application. Another authorized approver must submit the decision.
            </p>
            <p className="text-xs text-amber-600 mt-2">
              Sign-off (Prepared By) confirms the CA Memo is accurate. Approval is the authority decision on this credit — these are separate gates.
            </p>
          </div>
        </div>
      )}

      {/* ── State-gated notice ────────────────────── */}
      {canApprove && !isApprovalEligibleState && !isRmOnApplication && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <span className="material-symbols-outlined text-blue-500 text-xl mt-0.5">info</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-blue-800 mb-1">Approval Not Available</p>
            <p className="text-xs text-blue-700">
              Approval actions are not available while the application is in <span className="font-semibold">{application.state}</span> state.
              Submit the application for review to enable the approval chain.
            </p>
          </div>
        </div>
      )}

      {/* ── Sign-off incomplete advisory ──────────── */}
      {signoffsComplete === false && isApprovalEligibleState && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <span className="material-symbols-outlined text-amber-500 text-xl mt-0.5">info</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800 mb-1">CA Memo Sign-off Required</p>
            <p className="text-xs text-amber-700">
              CA Memo sign-off must be completed before this application can be submitted to Committee Review.
              Go to the <strong>Sign-off</strong> tab to complete all 3 signatures (Prepared By → Reviewed By → Concurred By).
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
      {canSubmitApproval && !isChainComplete && activeStageIdx !== -1 && (
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

          {/* §2.7 — Rejection reason code dropdown */}
          {selectedDecision === 'REJECT' && (
            <div>
              <label className="block text-sm font-semibold text-red-800 mb-1">
                Rejection Reason Code *
              </label>
              <select
                value={rejectionReasonCode}
                onChange={e => setRejectionReasonCode(e.target.value)}
                className="w-full px-4 py-2 border border-red-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-200 bg-white"
              >
                <option value="">Select reason…</option>
                {rejectionReasonCodes.map(rc => (
                  <option key={rc.value} value={rc.value}>{rc.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* §2.5 — Inline conditions builder for CONDITIONAL approval */}
          {selectedDecision === 'CONDITIONAL' && (
            <div className="space-y-3 border border-amber-200 rounded-lg p-3 bg-amber-50">
              <div className="flex items-center justify-between">
                <h5 className="text-sm font-semibold text-amber-800">Conditions (at least 1 required)</h5>
                <button
                  type="button"
                  onClick={() => setConditions([...conditions, { title: '', description: '', category: 'PRE_DISBURSEMENT', conditionType: 'PRECEDENT', dueDate: '' }])}
                  className="px-2 py-1 text-xs font-medium bg-amber-600 text-white rounded hover:bg-amber-700"
                >
                  + Add Condition
                </button>
              </div>
              {conditions.length === 0 && (
                <p className="text-xs text-amber-600">No conditions added yet. Click &quot;+ Add Condition&quot; to define approval conditions.</p>
              )}
              {conditions.map((c, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-white border border-amber-200 rounded p-2">
                  <div className="col-span-4">
                    <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">Title *</label>
                    <input
                      type="text"
                      value={c.title}
                      onChange={e => { const n = [...conditions]; n[idx].title = e.target.value; setConditions(n); }}
                      className="w-full px-2 py-1 border rounded text-xs"
                      placeholder="Condition title"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">Category</label>
                    <select
                      value={c.category}
                      onChange={e => { const n = [...conditions]; n[idx].category = e.target.value; setConditions(n); }}
                      className="w-full px-2 py-1 border rounded text-xs"
                    >
                      <option value="PRE_DISBURSEMENT">Pre-disbursement</option>
                      <option value="POST_DISBURSEMENT">Post-disbursement</option>
                      <option value="FINANCIAL_COVENANT">Financial Covenant</option>
                      <option value="REPORTING">Reporting</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">Type</label>
                    <select
                      value={c.conditionType}
                      onChange={e => { const n = [...conditions]; n[idx].conditionType = e.target.value; setConditions(n); }}
                      className="w-full px-2 py-1 border rounded text-xs"
                    >
                      <option value="PRECEDENT">Precedent</option>
                      <option value="SUBSEQUENT">Subsequent</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">Due Date</label>
                    <input
                      type="date"
                      value={c.dueDate}
                      onChange={e => { const n = [...conditions]; n[idx].dueDate = e.target.value; setConditions(n); }}
                      className="w-full px-2 py-1 border rounded text-xs"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setConditions(conditions.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 text-sm"
                      title="Remove condition"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Comment{commentRequired || commentMinLength > 0 ? ' *' : ''}
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={
                commentMinLength > 0
                  ? `Minimum ${commentMinLength} characters required…`
                  : commentRequired
                  ? 'Required at this approval tier…'
                  : 'Optional comments…'
              }
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 resize-none"
              style={{ fontFamily: 'var(--font-sans)' }}
            />
            {commentMinLength > 0 && comment.trim().length > 0 && comment.trim().length < commentMinLength && (
              <p className="text-xs text-amber-500 mt-1">
                {comment.trim().length}/{commentMinLength} characters minimum
              </p>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!selectedDecision || submitting || (commentRequired && !comment.trim()) || (commentMinLength > 0 && comment.trim().length < commentMinLength)}
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
