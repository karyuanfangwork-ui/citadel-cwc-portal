import React from 'react';

/**
 * Shared RiskBadge component for the Credit module.
 * Renders risk rating as a colored pill with text label.
 * Addresses FINDING ACC-02 (color-only indicators — adds text labels alongside color).
 */

type RiskBadgeProps = {
  /** Risk rating string: AAA, AA, A, BBB, BB, B, CCC, CC, C, D, NR */
  rating: string;
  /** Optional extra classNames */
  className?: string;
  /** Size variant: 'sm' for inline use, 'md' default */
  size?: 'sm' | 'md';
};

const RISK_STYLES: Record<string, { bg: string; text: string }> = {
  AAA: { bg: '#22c55e20', text: '#16a34a' },
  AA: { bg: '#22c55e20', text: '#16a34a' },
  A: { bg: '#22c55e20', text: '#16a34a' },
  BBB: { bg: '#3b82f620', text: '#2563eb' },
  BB: { bg: '#f59e0b20', text: '#d97706' },
  B: { bg: '#f59e0b20', text: '#d97706' },
  CCC: { bg: '#ef444420', text: '#dc2626' },
  CC: { bg: '#ef444420', text: '#dc2626' },
  C: { bg: '#ef444420', text: '#dc2626' },
  D: { bg: '#ef444420', text: '#dc2626' },
  NR: { bg: '#6b728020', text: '#6b7280' },
};

const RISK_LABELS: Record<string, string> = {
  AAA: 'AAA — Prime',
  AA: 'AA — High Grade',
  A: 'A — Upper Medium',
  BBB: 'BBB — Medium Grade',
  BB: 'BB — Speculative',
  B: 'B — Highly Speculative',
  CCC: 'CCC — Substantial Risk',
  CC: 'CC — Extremely Speculative',
  C: 'C — Near Default',
  D: 'D — Default',
  NR: 'NR — Not Rated',
};

const RiskBadge: React.FC<RiskBadgeProps> = ({
  rating,
  className = '',
  size = 'md',
}) => {
  const style = RISK_STYLES[rating] || { bg: '#6b728020', text: '#6b7280' };
  const label = RISK_LABELS[rating] || rating;
  const isSm = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1 font-bold rounded-full whitespace-nowrap ${
        isSm ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'
      } ${className}`}
      style={{ background: style.bg, color: style.text }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: isSm ? 12 : 14 }}>
        speed
      </span>
      {label}
    </span>
  );
};

export default RiskBadge;
export { RISK_STYLES, RISK_LABELS };