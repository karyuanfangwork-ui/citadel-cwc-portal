import React, { useState, useEffect, useCallback } from 'react';

// ─── useCollapsedColumns hook ──────────────────────────────────────────────────
// Persists collapsed state to localStorage per board key.

export function useCollapsedColumns(storageKey: string) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`kanban-collapsed-${storageKey}`);
      if (stored) setCollapsed(JSON.parse(stored));
    } catch {}
  }, [storageKey]);

  const toggle = useCallback((colKey: string) => {
    setCollapsed(prev => {
      const next = { ...prev, [colKey]: !prev[colKey] };
      try { localStorage.setItem(`kanban-collapsed-${storageKey}`, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [storageKey]);

  const isCollapsed = useCallback((colKey: string) => !!collapsed[colKey], [collapsed]);

  return { isCollapsed, toggle, collapsed };
}

// ─── CollapsedColumnPill ────────────────────────────────────────────────────────
// Shown when column is collapsed: narrow vertical strip with rotated label.

export const CollapsedColumnPill: React.FC<{
  label: string;
  color: string;
  count: number;
  onClick: () => void;
}> = ({ label, color, count, onClick }) => (
  <div
    onClick={onClick}
    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    role="button"
    tabIndex={0}
    aria-label={`Expand ${label} column`}
    className="shrink-0 flex flex-col items-center justify-start pt-4 cursor-pointer border border-border rounded-xl transition-all hover:shadow-sm"
    style={{
      width: 44,
      minHeight: 200,
      background: 'var(--color-surface, #fff)',
      writingMode: 'vertical-rl',
      textOrientation: 'mixed',
      userSelect: 'none',
    }}
  >
    <div className="w-3 h-3 rounded-full mb-3" style={{ background: color, writingMode: 'horizontal-tb' }} />
    <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
    <span
      className="text-[10px] font-bold bg-surface-muted text-text-secondary px-1.5 py-0.5 rounded-full mt-2"
      style={{ writingMode: 'horizontal-tb' }}
    >
      {count}
    </span>
    <span className="material-symbols-outlined text-sm mt-3 opacity-40" style={{ writingMode: 'horizontal-tb' }}>
      unfold_more
    </span>
  </div>
);

// ─── ColumnCollapseToggle ────────────────────────────────────────────────────────
// Small button in column header to collapse.

export const ColumnCollapseToggle: React.FC<{
  onClick: () => void;
}> = ({ onClick }) => (
  <button
    onClick={e => { e.stopPropagation(); onClick(); }}
    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onClick(); } }}
    aria-label="Collapse column"
    title="Collapse column"
    className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-100"
    style={{ background: 'none', border: 'none', cursor: 'pointer', lineHeight: 0 }}
  >
    <span className="material-symbols-outlined text-sm text-text-tertiary">unfold_less</span>
  </button>
);