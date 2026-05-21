import React from 'react';

/**
 * Shared section wrapper for all CA Memo tabs.
 *
 * Provides:
 *  - Section title with phase context
 *  - Read-only badge (amber pill) when section is not editable
 *  - "Last saved" timestamp indicator
 *  - Saving spinner
 *  - Error banner
 *  - Consistent layout envelope
 *
 * Addresses FINDING F-02: inconsistent tab maturity.
 * All editable tabs must wrap their sections with this component.
 */

type CaMemoSectionProps = {
  /** Section title (e.g. "Section 1 — Credit Application Header") */
  title: string;
  /** If true, shows a prominent "Read Only" badge and applies visual cues */
  readOnly?: boolean;
  /** Timestamp of last successful save — shows "Saved HH:MM:SS" indicator */
  savedAt?: Date | null;
  /** If true, shows "Saving..." indicator */
  saving?: boolean;
  /** Error message to display as a red banner */
  error?: string | null;
  /** Optional phase label (e.g. "Phase 3") shown as a subtle prefix */
  phase?: string;
  /** Section content */
  children: React.ReactNode;
  /** Optional extra actions rendered in the header right area */
  actions?: React.ReactNode;
  /** Optional className for the outer wrapper */
  className?: string;
};

const CaMemoSection: React.FC<CaMemoSectionProps> = ({
  title,
  readOnly = false,
  savedAt,
  saving = false,
  error = null,
  phase,
  children,
  actions,
  className = '',
}) => {
  return (
    <section className={`bg-white border border-gray-200 rounded ${className}`}>
      <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {phase && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">
              {phase}
            </span>
          )}
          <h3 className="text-sm font-semibold text-text-primary truncate">{title}</h3>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {readOnly && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <span className="material-symbols-outlined text-[14px]">lock</span>
              Read Only
            </span>
          )}
          {saving && (
            <span className="text-xs text-brand-700 flex items-center gap-1">
              <span className="animate-spin inline-block w-3 h-3 border-2 border-brand-700 border-t-transparent rounded-full" />
              Saving…
            </span>
          )}
          {!saving && savedAt && (
            <span className="text-[11px] text-text-secondary flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-green-500">check_circle</span>
              Saved {savedAt.toLocaleTimeString()}
            </span>
          )}
          {error && (
            <span className="text-[11px] text-red-600 flex items-center gap-1" role="alert">
              <span className="material-symbols-outlined text-[14px]">error</span>
              {error}
            </span>
          )}
          {actions}
        </div>
      </header>
      <div className="p-4">
        {children}
      </div>
    </section>
  );
};

export default CaMemoSection;