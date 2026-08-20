import React, { useState } from 'react';
import type { ApprovalDecision } from '../../../services/credit.service';
import {
  validateApprovalDecision,
  type ApprovalDecisionInput,
} from '../approvalDecision';

interface RejectionReasonCode {
  value: string;
  label: string;
}

export interface DecisionActionsProps {
  applicationId: string;
  sodBlocked: boolean;
  sodReason?: string;
  submitting: boolean;
  rejectionReasonCodes?: RejectionReasonCode[];
  returnLabel?: string;
  onSubmit: (decision: ApprovalDecision, input: ApprovalDecisionInput) => void;
}

/** Shared approval controls used by the quick view and inline decision cards. */
const DecisionActions: React.FC<DecisionActionsProps> = ({
  applicationId,
  sodBlocked,
  sodReason,
  submitting,
  rejectionReasonCodes = [],
  returnLabel = 'Return',
  onSubmit,
}) => {
  const [mode, setMode] = useState<ApprovalDecision | null>(null);
  const [comment, setComment] = useState('');
  const [rejectionReasonCode, setRejectionReasonCode] = useState('');

  if (sodBlocked) {
    return <p role="note">{sodReason ?? 'You are not permitted to decide this application.'}</p>;
  }

  const submit = () => {
    if (!mode) return;
    const input: ApprovalDecisionInput = { decision: mode, comment, rejectionReasonCode };
    if (validateApprovalDecision(input)) return;
    onSubmit(mode, input);
  };

  if (!mode) {
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" disabled={submitting} onClick={() => onSubmit('APPROVE', { decision: 'APPROVE', comment })}>Approve</button>
        <button type="button" disabled={submitting} onClick={() => setMode('RETURN')}>{returnLabel}</button>
        <button type="button" disabled={submitting} onClick={() => setMode('REJECT')}>Decline</button>
      </div>
    );
  }

  const input: ApprovalDecisionInput = { decision: mode, comment, rejectionReasonCode };
  const validationError = validateApprovalDecision(input);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p>{mode === 'REJECT' ? 'Decline this application — a reason is required' : mode === 'RETURN' ? 'Return this application for more information' : 'Approve this application'}</p>
      {mode === 'REJECT' && (
        <select aria-label="Rejection reason code" value={rejectionReasonCode} onChange={e => setRejectionReasonCode(e.target.value)}>
          <option value="">Select a rejection reason…</option>
          {rejectionReasonCodes.map(reason => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
        </select>
      )}
      <textarea aria-label="Comments" value={comment} onChange={e => setComment(e.target.value)} rows={3} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" disabled={submitting || validationError !== null} onClick={submit}>
          {mode === 'REJECT' ? 'Confirm decline' : mode === 'RETURN' ? 'Confirm return' : 'Confirm approve'}
        </button>
        <button type="button" disabled={submitting} onClick={() => { setMode(null); setComment(''); setRejectionReasonCode(''); }}>Cancel</button>
      </div>
    </div>
  );
};

export default DecisionActions;
