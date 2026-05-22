import React from 'react';

/**
 * Shared RiskBadge component for the Credit module.
 * Renders a risk rating as a color-coded pill with optional icon.
 * AAA/AA = green, A/BBB = blue, BB/B = amber, CCC-CC-C/D = red, NR = gray
 */

type RiskBadgeProps = {
  /** Risk rating string, e.g. 'AAA', 'BBB', 'NR' */
  rating: string | null | undefined;
  /** Show icon? Default true */
  showIcon?: boolean;
  /** Size variant: 'sm' for inline use, 'md' default */
  size?: 'sm' | 'md';
  /** Optional extra classNames */
  className?: string;
};

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  AAA:  { bg: '#16a34a18', text: '#16a34a' },
  AA:   { bg: '#16a34a18', text: '#16a34a' },
  A:    { bg: '#2563eb18', text: '#2563eb' },
  BBB:  { bg: '#2563eb18', text: '#2563eb' },
  BB:   { bg: '#d9770618', text: '#d97706' },
  B:    { bg: '#d9770618', text: '#d97706' },
  CCC:  { bg: '#dc262618', text: '#dc2626' },
  CC:   { bg: '#dc262618', text: '#dc2626' },
  C:    { bg: '#dc262618', text: '#dc2626' },
  D:    { bg: '#7f1d1d18', text: '#991b1b' },
  NR:   { bg: '#6b728018', text: '#6b7280' },
};

const RISK_ICONS: Record<string, string> = {
  AAA: 'verified', AA: 'verified', A: 'check_circle',
  BBB: 'check_circle', BB: 'warning', B: 'warning',
  CCC: 'error', CC: 'error', C: 'error', D: 'dangerous', NR: 'help',
};

const RiskBadge: React.FC<RiskBadgeProps> = ({
  rating,
  showIcon = true,
  size = 'md',
  className = '',
}) => {
  const key = (rating || 'NR').toUpperCase();
  const colors = RISK_COLORS[key] || RISK_COLORS.NR;
  const icon = RISK_ICONS[key] || 'help';
  const label = key === 'NR' ? 'Not Rated' : key;
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

export default RiskBadge;