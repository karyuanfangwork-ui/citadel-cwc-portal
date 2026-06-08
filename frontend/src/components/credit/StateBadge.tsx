/**
 * §8.1 — StateBadge Component
 *
 * Accessible state badge with icon + label (not colour alone).
 * Replaces inline STATE_COLORS[state] pattern across the codebase.
 */

import React from 'react';
import { STATE_COLORS, STATE_LABELS, STATE_ICONS } from '../../../pages/credit/creditUtils';

interface StateBadgeProps {
  state: string;
  /** Extra CSS classes */
  className?: string;
  /** Render size variant */
  size?: 'sm' | 'md';
}

const StateBadge: React.FC<StateBadgeProps> = ({ state, className = '', size = 'sm' }) => {
  const color = STATE_COLORS[state] || STATE_COLORS.DRAFT;
  const label = STATE_LABELS[state] || state.replace(/_/g, ' ');
  const icon = STATE_ICONS[state] || 'circle';

  const sizeClasses = size === 'md'
    ? 'text-xs font-semibold px-2.5 py-1 gap-1.5'
    : 'text-[10px] font-bold px-1.5 py-0.5 gap-1';

  const iconSize = size === 'md' ? 'text-sm' : 'text-[11px]';

  return (
    <span
      className={`inline-flex items-center rounded-full ${sizeClasses} ${className}`}
      style={{ backgroundColor: color.bg, color: color.text }}
      role="status"
      aria-label={label}
    >
      <span className={`material-symbols-outlined ${iconSize}`}>{icon}</span>
      {label}
    </span>
  );
};

export default StateBadge;