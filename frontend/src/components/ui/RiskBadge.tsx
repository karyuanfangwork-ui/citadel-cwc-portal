import React from 'react';

/**
 * RiskBadge — renders a credit rating as a pill with color.
 * Addresses FINDING ACC-02 (color-only indicators) from the enterprise UX audit.
 */

type RiskBadgeProps = {
  /** The rating string, e.g. 'AAA', 'BB', 'NR'. Undefined shows 'NR'. */
  rating?: string;
  /** Optional extra classNames */
  className?: string;
  /** Show icon? Default true (ignored for RiskBadge — kept for API compatibility) */
  showIcon?: boolean;
  /** Size variant: 'sm' for inline use, 'md' default */
  size?: 'sm' | 'md';
};

// ─── Credit rating color map ──────────────────────────────────────────────────

const RATING_COLORS: Record<string, { bg: string; text: string }> = {
  AAA: { bg: '#22c55e20', text: '#15803d' },
  AA:  { bg: '#22c55e15', text: '#16a34a' },
  A:   { bg: '#86efac15', text: '#15803d' },
  BBB: { bg: '#f59e0b20', text: '#b45309' },
  BB:  { bg: '#f9731620', text: '#c2410c' },
  B:   { bg: '#ef444420', text: '#b91c1c' },
  CCC: { bg: '#ef444430', text: '#991b1b' },
  CC:  { bg: '#ef444440', text: '#991b1b' },
  C:   { bg: '#ef444450', text: '#7f1d1d' },
  D:   { bg: '#ef444460', text: '#7f1d1d' },
  NR:  { bg: '#6b728020', text: '#6b7280' },
};

const RiskBadge: React.FC<RiskBadgeProps> = ({
  rating,
  className = '',
  size = 'md',
}) => {
  const safeRating = rating ?? '';
  const upper = safeRating.toUpperCase();
  const colors = RATING_COLORS[upper] || RATING_COLORS.NR;
  const label = upper || 'NR';
  const isSm = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1 font-bold rounded-full whitespace-nowrap ${
        isSm ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'
      } ${className}`}
      style={{ background: colors.bg, color: colors.text }}
    >
      {label}
    </span>
  );
};

export default RiskBadge;