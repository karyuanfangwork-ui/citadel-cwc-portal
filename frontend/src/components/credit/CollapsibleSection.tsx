import React, { useState } from 'react';

/**
 * Shared collapsible accordion section.
 * Extracted from RiskAssessmentTab so FinancialProfileTab and other
 * credit tabs can reuse the same expand/collapse pattern.
 *
 * Visual style matches the credit-module design tokens:
 *  - Geist display font, 15px, weight 700
 *  - Bottom border using --cr-outline-variant
 *  - Material Symbols icon + chevron that rotates on open/close
 */

interface CollapsibleSectionProps {
  id: string;
  label: string;
  icon: string;
  defaultOpen?: boolean;
  /** Optional badge text shown on the right (e.g. "3 warnings") */
  badge?: { text: string; tone: 'pass' | 'warn' | 'fail' | 'info' };
  children: React.ReactNode;
}

const badgeToneClasses: Record<string, string> = {
  pass: 'bg-green-100 text-green-700 border-green-200',
  warn: 'bg-amber-100 text-amber-700 border-amber-200',
  fail: 'bg-red-100 text-red-700 border-red-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
};

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  id,
  label,
  icon,
  defaultOpen = false,
  badge,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        style={{
          fontFamily: 'var(--cr-font-display)',
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--cr-on-surface, #0f172a)',
          borderBottom: '1px solid var(--cr-outline-variant, #e2e8f0)',
          paddingBottom: 8,
          marginBottom: 16,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
          {icon}
        </span>
        {label}
        {badge && (
          <span
            className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeToneClasses[badge.tone]}`}
          >
            {badge.text}
          </span>
        )}
        <span
          className="material-symbols-outlined"
          style={{
            marginLeft: 'auto',
            fontSize: 20,
            color: 'var(--cr-outline)',
            transition: 'transform 0.2s',
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}
        >
          expand_more
        </span>
      </button>
      {open && <div style={{ marginBottom: 8 }}>{children}</div>}
    </section>
  );
};

export default CollapsibleSection;