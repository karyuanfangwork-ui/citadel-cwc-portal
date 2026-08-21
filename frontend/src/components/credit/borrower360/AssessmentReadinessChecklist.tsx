import React from 'react';
import type { BorrowerRiskAssessment, Borrower360Summary, BorrowerProfile } from '../../../services/credit.service';
import { OutlinedCard, StatusPill } from './primitives';

interface Props {
  profile: BorrowerProfile;
  summary: Borrower360Summary | null;
  assessment: BorrowerRiskAssessment | null;
  onAction: (target: BorrowerRiskAssessment['missingInputs'][number]['target']) => void;
}

const AssessmentReadinessChecklist: React.FC<Props> = ({ profile, summary, assessment, onAction }) => {
  const items = [
    { label: 'Borrower profile', ready: Boolean(profile.name?.trim()), target: 'profile' as const },
    { label: 'KYC verification', ready: Boolean(profile.kycVerifiedAt), target: 'kyc' as const },
    { label: 'Income / DSR', ready: Boolean(summary?.income), target: 'income' as const },
    { label: 'Bureau evidence', ready: Boolean(summary?.bureau.uploadedAt && !summary.bureau.stale), target: 'bureau' as const },
    { label: 'Required documents', ready: (summary?.docCompletionPct ?? 0) >= 80, target: 'documents' as const },
    { label: 'Risk calculation', ready: assessment?.ratingStatus === 'DECISION_READY', target: 'risk' as const },
  ];

  return (
    <OutlinedCard title="Assessment readiness">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 rounded-fc border border-fc-outline bg-white px-3 py-2">
            <span className="text-xs font-semibold text-fc-primary">{item.label}</span>
            {item.ready ? <StatusPill label="Ready" tone="pos" /> : <button type="button" onClick={() => onAction(item.target)} className="text-[10px] font-bold text-fc-primary underline">Review</button>}
          </div>
        ))}
      </div>
    </OutlinedCard>
  );
};

export default AssessmentReadinessChecklist;
