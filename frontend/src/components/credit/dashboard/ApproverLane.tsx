import React, { useState } from 'react';
import type { ApprovalDecision } from '../../../services/credit.service';
import type { ApprovalDecisionInput } from '../approvalDecision';
import type { ApprovalInbox, ApprovalInboxItem } from '../../../services/credit.types';
import DecisionCard from './DecisionCard';

interface ApproverLaneProps {
  inbox: ApprovalInbox;
  onDecision: (applicationId: string, decision: ApprovalDecision, input: ApprovalDecisionInput) => void;
  formatAmount: (value: number | null) => string;
}

const ApproverLane: React.FC<ApproverLaneProps> = ({ inbox, onDecision, formatAmount }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const items: ApprovalInboxItem[] = [...inbox.high, ...inbox.medium, ...inbox.low];
  const overdue = items.filter(item => item._slaBreached).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section aria-labelledby="approver-inbox-heading" style={{ background: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg, 0.5rem)', overflow: 'hidden' }}>
        <h2 id="approver-inbox-heading" style={{ fontSize: 14, fontWeight: 600, padding: '16px 20px', borderBottom: '1px solid var(--cr-outline-variant)' }}>
          {inbox.totalPending} decisions waiting{overdue > 0 ? ` · ${overdue} overdue` : ''}
        </h2>
        {items.length === 0 ? <p style={{ padding: 32, textAlign: 'center' }}>No decisions are waiting on you.</p> : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.map(item => {
              const expanded = expandedId === item.applicationId;
              return (
                <li key={item.applicationId} aria-label={`${item.applicationNo} ${item.borrowerName}`} style={{ borderBottom: '1px solid var(--cr-outline-variant)' }}>
                  <button type="button" aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : item.applicationId)} style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <span>{item.applicationNo}</span>
                    <span style={{ flex: 1 }}>{item.borrowerName}</span>
                    <span>{formatAmount(item.requestedAmount)}</span>
                    {item.riskRating && <span>{item.riskRating}</span>}
                    <span>{item.daysWaiting} {item.daysWaiting === 1 ? 'day' : 'days'} waiting</span>
                  </button>
                  {expanded && <DecisionCard item={item} onDecision={onDecision} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {inbox.excluded.length > 0 && (
        <section aria-label="Excluded from your queue" style={{ background: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg, 0.5rem)', padding: 20 }}>
          <h2>Excluded from your queue</h2>
          <ul>
            {inbox.excluded.map(exclusion => <li key={exclusion.applicationId}><strong>{exclusion.applicationId}</strong> — {exclusion.reason}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
};

export default ApproverLane;
