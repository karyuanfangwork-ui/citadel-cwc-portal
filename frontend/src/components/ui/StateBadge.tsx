import React from 'react';

/**
 * Universal StateBadge — renders any status string as a pill with color + icon + label.
 * Covers: Credit application states, IT/HR/Finance request statuses, asset lifecycle, CRM stages.
 * Addresses FINDING ACC-02 (color-only indicators) from the enterprise UX audit.
 */

type StateBadgeProps = {
  /** The status/state string, e.g. 'OPEN', 'IN_PROGRESS', 'APPROVED', 'DRAFT' */
  state: string;
  /** Optional extra classNames */
  className?: string;
  /** Show icon? Default true */
  showIcon?: boolean;
  /** Size variant: 'sm' for inline use, 'md' default */
  size?: 'sm' | 'md';
};

// ─── Universal status color map ──────────────────────────────────────────────
// Each entry provides { bg, text } as hex+alpha or tailwind-compatible colors.
// Covers IT Service Desk, HR, Group Finance, CRM, Asset, and Credit states.

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  // ── IT Service Desk / HR / Finance request statuses ──
  OPEN:            { bg: '#3b82f620', text: '#2563eb' },
  NEW:             { bg: '#3b82f620', text: '#2563eb' },
  IN_PROGRESS:     { bg: '#f59e0b20', text: '#d97706' },
  PENDING:         { bg: '#f59e0b20', text: '#d97706' },
  PENDING_APPROVAL:{ bg: '#f59e0b20', text: '#d97706' },
  ON_HOLD:         { bg: '#6b728020', text: '#6b7280' },
  ESCALATED:       { bg: '#ef444420', text: '#dc2626' },
  ASSIGNED:        { bg: '#8b5cf620', text: '#7c3aed' },
  RESOLVED:        { bg: '#22c55e20', text: '#16a34a' },
  CLOSED:          { bg: '#6b728020', text: '#6b7280' },
  CANCELLED:       { bg: '#6b728020', text: '#6b7280' },
  REOPENED:        { bg: '#f9731620', text: '#ea580c' },

  // ── Approval / review statuses ──
  APPROVED:        { bg: '#22c55e20', text: '#16a34a' },
  REJECTED:        { bg: '#ef444420', text: '#dc2626' },
  WITHDRAWN:       { bg: '#6b728020', text: '#6b7280' },

  // ── Credit application states (preserved from creditUtils) ──
  DRAFT:           { bg: '#6366f120', text: '#6366f1' },
  SUBMITTED:       { bg: '#f59e0b20', text: '#d97706' },
  KYC_REVIEW:      { bg: '#3b82f620', text: '#2563eb' },
  KYC_APPROVED:    { bg: '#22c55e20', text: '#16a34a' },
  KYC_REJECTED:    { bg: '#ef444420', text: '#dc2626' },
  UNDERWRITING:    { bg: '#8b5cf620', text: '#7c3aed' },
  CREDIT_ASSESSMENT:{ bg: '#a78bfa20', text: '#7c3aed' },
  COMMITTEE_REVIEW:{ bg: '#f9731620', text: '#ea580c' },
  OFFER:           { bg: '#06b6d420', text: '#0891b2' },
  ACCEPTED:        { bg: '#14b8a620', text: '#0d9488' },
  DISBURSED:       { bg: '#06b6d420', text: '#0891b2' },
  ACTIVE:          { bg: '#22c55e20', text: '#16a34a' },

  // ── CRM pipeline stages ──
  LEAD:            { bg: '#6366f120', text: '#6366f1' },
  PROSPECT:        { bg: '#3b82f620', text: '#2563eb' },
  QUALIFIED:       { bg: '#f59e0b20', text: '#d97706' },
  NEGOTIATION:     { bg: '#f9731620', text: '#ea580c' },
  WON:             { bg: '#22c55e20', text: '#16a34a' },
  LOST:            { bg: '#ef444420', text: '#dc2626' },

  // ── Asset lifecycle ──
  AVAILABLE:       { bg: '#22c55e20', text: '#16a34a' },
  IN_USE:          { bg: '#8b5cf620', text: '#7c3aed' },
  IN_REPAIR:       { bg: '#f59e0b20', text: '#d97706' },
  DECOMMISSIONED:  { bg: '#6b728020', text: '#6b7280' },
  STORED:          { bg: '#6b728020', text: '#6b7280' },
  RETIRED:         { bg: '#6b728020', text: '#6b7280' },
  DAMAGED:         { bg: '#ef444420', text: '#dc2626' },
  LOST_STOLEN:     { bg: '#ef444420', text: '#dc2626' },

  // ── Onboarding / offboarding ──
  SCHEDULED:       { bg: '#3b82f620', text: '#2563eb' },
  IN_REVIEW:       { bg: '#f59e0b20', text: '#d97706' },
  COMPLETED:       { bg: '#22c55e20', text: '#16a34a' },
  FAILED:          { bg: '#ef444420', text: '#dc2626' },

  // ── LOA ──
  LOA_ISSUANCE:    { bg: '#06b6d420', text: '#0891b2' },
  LOA_PENDING:     { bg: '#f59e0b20', text: '#d97706' },
  LOA_ACTIVE:      { bg: '#22c55e20', text: '#16a34a' },
  LOA_EXPIRED:     { bg: '#6b728020', text: '#6b7280' },

  // ── Priority ──
  LOW:             { bg: '#22c55e20', text: '#16a34a' },
  MEDIUM:          { bg: '#f59e0b20', text: '#d97706' },
  HIGH:            { bg: '#f9731620', text: '#ea580c' },
  CRITICAL:        { bg: '#ef444420', text: '#dc2626' },
  URGENT:          { bg: '#ef444420', text: '#dc2626' },
};

const STATUS_ICONS: Record<string, string> = {
  // Credit
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
  // Request / IT / HR / Finance
  OPEN: 'fiber_manual_record',
  NEW: 'fiber_new',
  IN_PROGRESS: 'pending',
  PENDING: 'schedule',
  PENDING_APPROVAL: 'schedule',
  ON_HOLD: 'pause_circle',
  ESCALATED: 'priority_high',
  ASSIGNED: 'person',
  RESOLVED: 'check_circle',
  CANCELLED: 'block',
  REOPENED: 'replay',
  // CRM
  LEAD: 'person_add',
  PROSPECT: 'group',
  QUALIFIED: 'verified',
  NEGOTIATION: 'handshake',
  WON: 'emoji_events',
  LOST: 'trending_down',
  // Asset
  AVAILABLE: 'check_circle',
  IN_USE: 'devices',
  IN_REPAIR: 'build',
  DECOMMISSIONED: 'delete',
  STORED: 'inventory_2',
  RETIRED: 'history',
  DAMAGED: 'warning',
  LOST_STOLEN: 'report_off',
  // Lifecycle
  SCHEDULED: 'event',
  IN_REVIEW: 'rate_review',
  COMPLETED: 'task_alt',
  FAILED: 'error',
  // Priority
  LOW: 'low_priority',
  MEDIUM: 'remove',
  HIGH: 'priority_high',
  CRITICAL: 'crisis_alert',
  URGENT: 'crisis_alert',
  // LOA
  LOA_ISSUANCE: 'description',
  LOA_PENDING: 'schedule',
  LOA_ACTIVE: 'verified',
  LOA_EXPIRED: 'event_busy',
};

const StateBadge: React.FC<StateBadgeProps> = ({
  state,
  className = '',
  showIcon = true,
  size = 'md',
}) => {
  const colors = STATUS_COLORS[state.toUpperCase()] || { bg: '#6b728020', text: '#6b7280' };
  const icon = STATUS_ICONS[state.toUpperCase()] || 'circle';
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
export { STATUS_COLORS, STATUS_ICONS };