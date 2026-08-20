import React, { useEffect, useState } from 'react';
import creditService, { type ApprovalDecision, type CreditApplication } from '../../../services/credit.service';
import type { ApprovalInboxItem } from '../../../services/credit.types';
import { buildApprovalPayload, type ApprovalDecisionInput } from '../approvalDecision';
import DecisionActions from './DecisionActions';

interface DecisionCardProps {
  item: ApprovalInboxItem;
  onDecision: (applicationId: string, decision: ApprovalDecision, input: ApprovalDecisionInput) => void;
}

const DecisionCard: React.FC<DecisionCardProps> = ({ item, onDecision }) => {
  const [application, setApplication] = useState<CreditApplication | null>(null);
  const [rejectionReasonCodes, setRejectionReasonCodes] = useState<{ value: string; label: string }[]>([]);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      creditService.getApplication(item.applicationId),
      creditService.listRejectionReasonCodes?.() ?? Promise.resolve([]),
    ])
      .then(([detail, reasons]) => {
        if (cancelled) return;
        setApplication(detail);
        setRejectionReasonCodes(reasons ?? []);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [item.applicationId]);

  const handleSubmit = async (decision: ApprovalDecision, input: ApprovalDecisionInput) => {
    setSubmitting(true);
    try {
      await creditService.submitApproval(item.applicationId, buildApprovalPayload(input));
      onDecision(item.applicationId, decision, input);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 20px 16px', background: 'var(--cr-surface-container-low)' }}>
      {error && <p role="alert">Could not load decision context. Open the application to review it in full.</p>}
      {application && (
        <dl style={{ display: 'flex', flexWrap: 'wrap', gap: 24, margin: 0 }}>
          {application.dscr != null && <div><dt>DSR</dt><dd>{application.dscr}%</dd></div>}
          {item.requestedTenor != null && <div><dt>Tenor</dt><dd>{item.requestedTenor} months</dd></div>}
        </dl>
      )}
      <DecisionActions
        applicationId={item.applicationId}
        sodBlocked={false}
        submitting={submitting}
        rejectionReasonCodes={rejectionReasonCodes}
        returnLabel="Return for information"
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default DecisionCard;
