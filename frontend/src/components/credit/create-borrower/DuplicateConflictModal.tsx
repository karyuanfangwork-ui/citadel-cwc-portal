import React from 'react';
import { Link } from 'react-router-dom';
import { DuplicateMatch } from '../../../services/credit.service';

interface DuplicateConflictModalProps {
  conflicts: DuplicateMatch[];
  onCancel: () => void;
  onOverride: (reason: string) => void;
  canOverride: boolean;
  saving: boolean;
}

const DuplicateConflictModal: React.FC<DuplicateConflictModalProps> = ({
  conflicts,
  onCancel,
  onOverride,
  canOverride,
  saving,
}) => {
  const [overrideReason, setOverrideReason] = React.useState('');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
          borderRadius: 'var(--cr-radius-lg, 0.5rem)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: 512,
          width: '100%',
          margin: '0 16px',
          padding: 24,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#d97706' }}>warning</span>
          <h3
            style={{
              fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
              fontSize: 'var(--cr-text-headline-md, 20px)',
              fontWeight: 700,
              color: 'var(--cr-on-surface, #191c1e)',
              margin: 0,
            }}
          >
            Duplicate Borrower Detected
          </h3>
        </div>

        <p style={{ fontSize: 'var(--cr-text-body-md, 14px)', color: 'var(--cr-on-surface-variant, #45464d)', marginBottom: 16 }}>
          The following borrower(s) were found with matching details. Please review before proceeding.
        </p>

        {/* Conflicts table */}
        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table style={{ width: '100%', fontSize: 'var(--cr-text-body-sm, 13px)', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--cr-outline-variant, #c6c6cd)' }}>
                <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: 'var(--cr-on-surface-variant, #45464d)', fontSize: 'var(--cr-text-label-sm, 11px)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: 'var(--cr-on-surface-variant, #45464d)', fontSize: 'var(--cr-text-label-sm, 11px)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
                <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: 'var(--cr-on-surface-variant, #45464d)', fontSize: 'var(--cr-text-label-sm, 11px)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Match Field</th>
                <th style={{ padding: '8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {conflicts.map(dup => (
                <tr key={dup.borrowerId} style={{ borderBottom: '1px solid var(--cr-outline-variant, #c6c6cd)' }}>
                  <td style={{ padding: '8px', fontWeight: 600, color: 'var(--cr-on-surface, #191c1e)' }}>{dup.name}</td>
                  <td style={{ padding: '8px', color: 'var(--cr-on-surface-variant, #45464d)' }}>{dup.borrowerType}</td>
                  <td style={{ padding: '8px', color: 'var(--cr-on-surface-variant, #45464d)' }}>{dup.matchField}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    <Link
                      to={`/credit/borrowers/${dup.borrowerId}`}
                      style={{ fontSize: 'var(--cr-text-label-md, 12px)', fontWeight: 600, color: '#0051d5', textDecoration: 'none' }}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!canOverride && (
          <p role="alert" style={{ margin: '0 0 16px', padding: 12, borderRadius: 6, background: '#fff4e5', border: '1px solid #f2c078', color: '#92400e', fontSize: 13 }}>
            This borrower matches an existing identity. Request an approved duplicate exception from the Identity Check step, or ask a credit administrator to review this conflict.
          </p>
        )}
        {canOverride && (
          <label style={{ display: 'block', marginBottom: 16, fontSize: 12, fontWeight: 700, color: 'var(--cr-on-surface-variant, #45464d)' }}>
            Admin override reason (minimum 20 characters)
            <textarea
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              minLength={20}
              rows={3}
              style={{ display: 'block', width: '100%', marginTop: 6, padding: 8, border: '1px solid var(--cr-outline-variant, #c6c6cd)', borderRadius: 4, resize: 'vertical' }}
              placeholder="Explain why these are distinct parties."
            />
          </label>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
              fontSize: 'var(--cr-text-label-md, 12px)',
              fontWeight: 600,
              backgroundColor: 'transparent',
              color: 'var(--cr-on-surface-variant, #45464d)',
              border: '1px solid var(--cr-outline-variant, #c6c6cd)',
              borderRadius: 'var(--cr-radius, 0.25rem)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          {canOverride && <button
            onClick={() => onOverride(overrideReason.trim())}
            disabled={saving || overrideReason.trim().length < 20}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
              fontSize: 'var(--cr-text-label-md, 12px)',
              fontWeight: 700,
              backgroundColor: 'var(--cr-primary, #000000)',
              color: 'var(--cr-on-primary, #ffffff)',
              border: 'none',
              borderRadius: 'var(--cr-radius, 0.25rem)',
              cursor: saving || overrideReason.trim().length < 20 ? 'not-allowed' : 'pointer',
              opacity: saving || overrideReason.trim().length < 20 ? 0.7 : 1,
            }}
          >
            {saving && (
              <span className="material-symbols-outlined" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>
                progress_activity
              </span>
            )}
            Create Anyway (Admin Override)
          </button>}
        </div>
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

export default DuplicateConflictModal;