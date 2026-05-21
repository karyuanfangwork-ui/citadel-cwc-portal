import React from 'react';
import { STATE_COLORS } from '../../../pages/credit/creditUtils';

/**
 * Shared StateBadge component for the Credit module.
 * Renders application state as a pill with color + icon + text label.
 * Addresses FINDING ACC-02 (color-only indicators).
 */

type StateBadgeProps = {
  /** The application state string, e.g. 'DRAFT', 'SUBMITTED', 'APPROVED' */
  state: string;
  /** Optional extra classNames */
  className?: string;
  /** Show icon? Default true */
  showIcon?: boolean;
  /** Size variant: 'sm' for inline use, 'md' default */
  size?: 'sm' | 'md';
};

const STATE_ICONS: Record<string, string> = {
  DRAFT: 'edit_note',
  SUBMITTED: 'send',
  KYC_REVIEW: 'search',
  KYC_APPROVED: 'verified',
  KYC_REJECTED: 'block',
  UNDERWRITING: 'analytics',
  CREDIT_ASSESSMENT: 'assignment',
  COMMITTEE_REVIEW: 'groups',
  APPROVED: 'check_circle',
  REJECTED: 'cancel',
  OFFER: 'local_offer',
  ACCEPTED: 'thumb_up',
  DISBURSED: 'payments',
  ACTIVE: 'task_alt',
  CLOSED: 'archive',
  WITHDRAWN: 'undo',
};

const StateBadge: React.FC<StateBadgeProps> = ({
  state,
  className = '',
  showIcon = true,
  size = 'md',
}) => {
  const colors = STATE_COLORS[state] || { bg: '#6b728020', text: '#6b7280' };
  const icon = STATE_ICONS[state] || 'circle';
  const label = state.replace(/_/g, ' ');
  const isSm = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1 font-bold rounded-full whitespace-nowrap ${
        isSm ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'
      } ${className}`}
      style={{ background: colors.bg, color: colors.text }}
    >
      {showIcon && (
        <span className="material-symbols-outlined" style={{ fontSize: isSm ? 12 : 14 }}>
          {icon}
        </span>
      )}
      {label}
    </span>
  );
};

export default StateBadge;