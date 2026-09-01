/**
 * Sprint 4 — SectionCompletionHeader
 *
 * Shared component showing completion status at the top of each tab.
 * Uses backend readiness where available; falls back to frontend phase completion.
 *
 * Shows: complete/incomplete/blocked status, top blockers, required vs optional.
 */
import React from 'react';

export type CompletionStatus = 'complete' | 'incomplete' | 'blocked' | 'optional';

export interface CompletionItem {
  label: string;
  status: 'done' | 'missing' | 'blocked' | 'warning';
}

interface SectionCompletionHeaderProps {
  title: string;
  status: CompletionStatus;
  items?: CompletionItem[];
  blockers?: string[];
  hint?: string;
  compact?: boolean;
}

const STATUS_CONFIG: Record<CompletionStatus, { bg: string; text: string; icon: string; label: string }> = {
  complete: { bg: '#22c55e15', text: '#16a34a', icon: 'check_circle', label: 'Complete' },
  incomplete: { bg: '#f59e0b15', text: '#d97706', icon: 'warning', label: 'Incomplete' },
  blocked: { bg: '#ef444415', text: '#dc2626', icon: 'block', label: 'Blocked' },
  optional: { bg: '#6b728015', text: '#6b7280', icon: 'info', label: 'Optional' },
};

const ITEM_ICON: Record<CompletionItem['status'], string> = {
  done: 'check_circle',
  missing: 'radio_button_unchecked',
  blocked: 'block',
  warning: 'warning',
};

const ITEM_COLOR: Record<CompletionItem['status'], string> = {
  done: '#16a34a',
  missing: '#d97706',
  blocked: '#dc2626',
  warning: '#d97706',
};

const SectionCompletionHeader: React.FC<SectionCompletionHeaderProps> = ({
  title,
  status,
  items = [],
  blockers = [],
  hint,
  compact = false,
}) => {
  const cfg = STATUS_CONFIG[status];

  return (
    <div
      style={{
        borderRadius: 8,
        border: `1px solid ${cfg.text}30`,
        background: cfg.bg,
        padding: compact ? '8px 12px' : '12px 16px',
        marginBottom: compact ? 12 : 16,
      }}
    >
      {/* Status line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: compact ? 0 : items.length > 0 ? 8 : 0 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: cfg.text }}>
          {cfg.icon}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: cfg.text }}>
          {title} — {cfg.label}
        </span>
        {hint && (
          <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 'auto' }}>{hint}</span>
        )}
      </div>

      {/* Blockers */}
      {!compact && blockers.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {blockers.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#dc2626' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>priority_high</span>
              {b}
            </div>
          ))}
        </div>
      )}

      {/* Item checklist */}
      {!compact && items.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 14, color: ITEM_COLOR[item.status] }}
              >
                {ITEM_ICON[item.status]}
              </span>
              <span style={{ color: item.status === 'done' ? '#6b7280' : ITEM_COLOR[item.status] }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SectionCompletionHeader;
