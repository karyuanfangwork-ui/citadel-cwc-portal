import React from 'react';

interface TopBarProps {
  segmentLabel: string;
  onSaveDraft: () => void;
  onValidate: () => void;
  saving?: boolean;
}

const TopBar: React.FC<TopBarProps> = ({
  segmentLabel,
  onSaveDraft,
  onValidate,
  saving = false,
}) => {
  return (
    <div
      className="sticky top-0 z-30 flex items-center gap-3 px-5"
      style={{
        height: 56,
        backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
        borderBottom: '1px solid var(--cr-outline-variant, #c6c6cd)',
      }}
    >
      {/* ── Left: breadcrumb + title ── */}
      <div className="flex items-center gap-2 shrink-0 min-w-0">
        <span
          style={{
            fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
            fontSize: 11,
            color: 'var(--cr-outline, #76777d)',
          }}
          className="truncate"
        >
          Borrowers
        </span>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--cr-outline, #76777d)' }}>
          chevron_right
        </span>
        <span
          style={{
            fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
            fontSize: 'var(--cr-text-headline-sm, 16px)',
            fontWeight: 700,
            color: 'var(--cr-on-surface, #191c1e)',
          }}
        >
          New Borrower
        </span>
        <span
          style={{
            padding: '1px 8px',
            borderRadius: 9999,
            fontSize: 'var(--cr-text-label-sm, 11px)',
            fontWeight: 600,
            fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
            backgroundColor: 'var(--cr-secondary-container, #316bf3)',
            color: 'var(--cr-on-secondary-container, #ffffff)',
            marginLeft: 4,
          }}
        >
          {segmentLabel}
        </span>
      </div>

      {/* ── Spacer ── */}
      <div style={{ flex: 1 }} />

      {/* ── Actions ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={onSaveDraft}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
            fontSize: 'var(--cr-text-label-md, 12px)',
            fontWeight: 600,
            backgroundColor: 'transparent',
            color: 'var(--cr-on-surface-variant, #45464d)',
            border: '1px solid var(--cr-outline-variant, #c6c6cd)',
            borderRadius: 'var(--cr-radius, 0.25rem)',
            cursor: 'pointer',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--cr-surface-container, #eceef0)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
          Save Draft
        </button>

        <button
          onClick={onValidate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
            fontSize: 'var(--cr-text-label-md, 12px)',
            fontWeight: 600,
            backgroundColor: 'transparent',
            color: 'var(--cr-on-surface-variant, #45464d)',
            border: '1px solid var(--cr-outline-variant, #c6c6cd)',
            borderRadius: 'var(--cr-radius, 0.25rem)',
            cursor: 'pointer',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--cr-surface-container, #eceef0)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>fact_check</span>
          Validate
        </button>

        {saving && (
          <span className="material-symbols-outlined" style={{ fontSize: 18, animation: 'spin 1s linear infinite', color: 'var(--cr-secondary, #0051d5)' }}>
            progress_activity
          </span>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default TopBar;