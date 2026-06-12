/**
 * P2-4: BorrowerSummaryCard — unified borrower display component.
 *
 * Used across CreditApplicationDetail header, ApprovalQuickView, Summary tab,
 * and CRM profile to deduplicate the borrower name/details rendering logic.
 *
 * Follows the established displayName pattern:
 *   account?.name → contact.firstName+lastName → profile.name → 'Unnamed Borrower'
 */

import React from 'react';
import { BorrowerProfile } from '../../services/credit.service';
import { formatCurrency } from '../../pages/credit/creditUtils';

interface BorrowerSummaryCardProps {
  profile: BorrowerProfile;
  currency?: string;
  /** Show full details (exposure, type) or compact (name + badge only) */
  compact?: boolean;
  /** Optional link target */
  linkTo?: string;
  className?: string;
}

/** Resolve the display name following the canonical pattern */
export function getBorrowerDisplayName(profile: BorrowerProfile | null | undefined): string {
  if (!profile) return 'Unnamed Borrower';
  return profile.account?.name
    || (profile.contact ? `${profile.contact.firstName} ${profile.contact.lastName}` : null)
    || profile.name
    || 'Unnamed Borrower';
}

const BORROWER_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: 'Individual',
  SOLE_PROPRIETOR: 'Sole Proprietor',
  CORPORATE: 'Corporate',
  JOINT: 'Joint',
};

const BORROWER_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  INDIVIDUAL: { bg: '#3b82f620', text: '#2563eb' },
  SOLE_PROPRIETOR: { bg: '#8b5cf620', text: '#7c3aed' },
  CORPORATE: { bg: '#06b6d420', text: '#0891b2' },
  JOINT: { bg: '#f59e0b20', text: '#d97706' },
};

const BorrowerSummaryCard: React.FC<BorrowerSummaryCardProps> = ({
  profile,
  currency = 'MYR',
  compact = false,
  linkTo,
  className,
}) => {
  const displayName = getBorrowerDisplayName(profile);
  const typeLabel = BORROWER_TYPE_LABELS[profile.borrowerType] || profile.borrowerType;
  const typeColor = BORROWER_TYPE_COLORS[profile.borrowerType] || { bg: '#6b728020', text: '#6b7280' };

  const content = (
    <div className={`flex items-center gap-3 ${className || ''}`}>
      {/* Avatar */}
      <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
        {displayName.split(' ').map(w => w[0]).join('').slice(0, 2)}
      </div>

      <div className="min-w-0">
        {/* Name */}
        <div className="font-semibold text-gray-900 truncate">{displayName}</div>

        {!compact && (
          <div className="flex items-center gap-2 mt-0.5">
            {/* Type badge */}
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
              style={{ backgroundColor: typeColor.bg, color: typeColor.text }}
            >
              {typeLabel}
            </span>

            {/* SSM/Registration */}
            {profile.ssm && (
              <span className="text-xs text-gray-500">
                SSM: {profile.ssm}
              </span>
            )}

            {/* Total exposure */}
            {profile.totalExposure != null && (
              <span className="text-xs text-gray-500">
                Exposure: {formatCurrency(profile.totalExposure, currency)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (linkTo) {
    return (
      <a href={linkTo} className="no-underline text-inherit hover:opacity-80 transition-opacity">
        {content}
      </a>
    );
  }

  return content;
};

export default BorrowerSummaryCard;