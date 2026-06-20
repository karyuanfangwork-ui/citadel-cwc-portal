import React from 'react';


interface BorrowerProfile {
  id?: string;
  borrowerType?: string | null;
  name?: string | null;
}

interface BorrowerSummaryCardProps {
  borrowerProfile: BorrowerProfile | null | undefined;
  className?: string;
  compact?: boolean;
}

/**
 * Resolve borrower display name from profile.
 */
export function getBorrowerDisplayName(bp: BorrowerProfile | null | undefined): string {
  return bp?.name ?? 'Unnamed Borrower';
}

const BORROWER_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: 'Individual',
  SOLE_PROPRIETOR: 'Sole Proprietor',
  CORPORATE: 'Corporate',
  JOINT: 'Joint',
};

const BorrowerSummaryCard: React.FC<BorrowerSummaryCardProps> = ({ borrowerProfile, className = '', compact = false }) => {
  if (!borrowerProfile) {
    return (
      <div className={`text-sm text-text-secondary ${className}`}>
        No borrower linked
      </div>
    );
  }

  const displayName = getBorrowerDisplayName(borrowerProfile);
  const typeLabel = BORROWER_TYPE_LABELS[borrowerProfile.borrowerType ?? ''] ?? borrowerProfile.borrowerType;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">
          {displayName[0]?.toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary leading-tight">{displayName}</p>
          {typeLabel && <p className="text-[10px] text-text-secondary">{typeLabel}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-bg-surface border border-border rounded-xl p-4 flex items-center gap-3 ${className}`}>
      <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold">
        {displayName[0]?.toUpperCase()}
      </div>
      <div>
        <p className="text-sm font-bold text-text-primary">{displayName}</p>
        {typeLabel && (
          <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full border border-blue-200">
            {typeLabel}
          </span>
        )}
        {borrowerProfile.id && (
          <p className="text-[10px] text-text-secondary mt-0.5">ID: {borrowerProfile.id.slice(0, 8)}</p>
        )}
      </div>
    </div>
  );
};

export default BorrowerSummaryCard;