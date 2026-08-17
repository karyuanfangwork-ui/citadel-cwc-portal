import React from 'react';
import type { BorrowerListItem } from '@/src/types/credit-ui.types';
import { formatMyr } from '@/src/lib/credit/formatters';
import BorrowerStatusBadge from './BorrowerStatusBadge';
import BorrowerDataQualityBadge from './BorrowerDataQualityBadge';

interface BorrowerQuickPreviewProps {
  borrower: BorrowerListItem;
  onClose: () => void;
  onOpen360: (id: string) => void;
  onNewApp: (id: string) => void;
  canWrite?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  name: 'name',
  identifier: 'identifier (NRIC/registration)',
  contact: 'contact details',
  segment: 'segment',
  owner: 'relationship owner',
};

const BorrowerQuickPreview: React.FC<BorrowerQuickPreviewProps> = ({ borrower, onClose, onOpen360, onNewApp, canWrite = true }) => {
  const headingId = `preview-heading-${borrower.id}`;
  const isIncomplete = borrower.dataQuality === 'INCOMPLETE';

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      onKeyDown={handleKeyDown}
      style={{ padding: 20, fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)', maxHeight: '100dvh', overflowY: 'auto' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'monospace', color: '#45464d' }}>{borrower.borrowerNumber || '—'}</span>
        <button type="button" autoFocus aria-label="Close borrower preview" onClick={onClose} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}><span className="material-symbols-outlined" aria-hidden="true">close</span></button>
      </div>
      <h2 id={headingId} style={{ margin: '16px 0 4px' }}>{borrower.name}</h2>
      <div style={{ color: '#64748b', marginBottom: 12 }}>{borrower.maskedIdentifier || 'No identifier on record'} · {borrower.primaryContact || 'No contact'}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: isIncomplete ? 12 : 0 }}>
        <BorrowerStatusBadge status={borrower.status} />
        <BorrowerDataQualityBadge dataQuality={borrower.dataQuality} missingFields={borrower.missingFields} />
      </div>

      {isIncomplete && (
        <div role="alert" style={{ marginTop: 12, padding: '10px 12px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 6, color: '#92400e', fontSize: 13 }}>
          <strong>Incomplete profile</strong>
          <p style={{ margin: '4px 0 0', fontSize: 12 }}>
            Missing: {borrower.missingFields.map((f) => FIELD_LABELS[f] || f).join(', ')}
          </p>
          {canWrite && (
            <p style={{ margin: '8px 0 0', fontSize: 12 }}>
              <a href={`/credit/borrowers/${borrower.id}`} style={{ color: '#92400e', fontWeight: 600 }}>Complete borrower profile →</a>
            </p>
          )}
        </div>
      )}

      <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 }}>
        <div><dt style={{ color: '#64748b', fontSize: 12 }}>Segment</dt><dd style={{ margin: 0, fontWeight: 700 }}>{borrower.segment || 'Needs backfill'}</dd></div>
        <div><dt style={{ color: '#64748b', fontSize: 12 }}>Owner</dt><dd style={{ margin: 0, fontWeight: 700 }}>{borrower.relationshipOwner?.name || 'Unassigned'}</dd></div>
        <div><dt style={{ color: '#64748b', fontSize: 12 }}>Active applications</dt><dd style={{ margin: 0, fontWeight: 700 }}>{borrower.activeApplicationCount}</dd></div>
        <div><dt style={{ color: '#64748b', fontSize: 12 }}>Total exposure</dt><dd style={{ margin: 0, fontWeight: 700 }}>{formatMyr(borrower.totalExposure)}</dd></div>
      </dl>

      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <button type="button" onClick={() => onOpen360(borrower.id)} style={{ flex: 1, padding: '9px 12px', border: 0, borderRadius: 6, background: '#0051d5', color: '#fff', cursor: 'pointer' }}>Open 360 View</button>
        <button
          type="button"
          onClick={() => {
            if (isIncomplete) {
              const confirmed = window.confirm(`This borrower is missing ${borrower.missingFields.map((f) => FIELD_LABELS[f] || f).join(', ')}. Create application anyway?`);
              if (!confirmed) return;
            }
            onNewApp(borrower.id);
          }}
          style={{ flex: 1, padding: '9px 12px', border: `1px solid ${isIncomplete ? '#f59e0b' : '#c6c6cd'}`, borderRadius: 6, background: isIncomplete ? '#fef3c7' : '#fff', color: isIncomplete ? '#92400e' : '#000', cursor: 'pointer' }}
        >
          New Application{isIncomplete ? ' ⚠' : ''}
        </button>
      </div>
    </div>
  );
};

export default BorrowerQuickPreview;