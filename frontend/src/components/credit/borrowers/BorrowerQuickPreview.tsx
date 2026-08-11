import React from 'react';
import type { BorrowerListItem } from '@/src/types/credit-ui.types';
import { formatMyr } from '@/src/lib/credit/formatters';
import BorrowerStatusBadge from './BorrowerStatusBadge';

interface BorrowerQuickPreviewProps { borrower: BorrowerListItem; onClose: () => void; onOpen360: (id: string) => void; onNewApp: (id: string) => void; }

const BorrowerQuickPreview: React.FC<BorrowerQuickPreviewProps> = ({ borrower, onClose, onOpen360, onNewApp }) => (
  <div style={{ padding: 20, fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontFamily: 'monospace', color: '#45464d' }}>{borrower.borrowerNumber || '—'}</span><button type="button" aria-label="Close borrower preview" onClick={onClose} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}><span className="material-symbols-outlined">close</span></button></div>
    <h2 style={{ margin: '16px 0 4px' }}>{borrower.name}</h2>
    <div style={{ color: '#64748b', marginBottom: 12 }}>{borrower.maskedIdentifier || 'No identifier on record'} · {borrower.primaryContact || 'No contact'}</div>
    <BorrowerStatusBadge status={borrower.status} />
    <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 }}><div><dt style={{ color: '#64748b', fontSize: 12 }}>Segment</dt><dd style={{ margin: 0, fontWeight: 700 }}>{borrower.segment || 'Needs backfill'}</dd></div><div><dt style={{ color: '#64748b', fontSize: 12 }}>Owner</dt><dd style={{ margin: 0, fontWeight: 700 }}>{borrower.relationshipOwner?.name || 'Unassigned'}</dd></div><div><dt style={{ color: '#64748b', fontSize: 12 }}>Active applications</dt><dd style={{ margin: 0, fontWeight: 700 }}>{borrower.activeApplicationCount}</dd></div><div><dt style={{ color: '#64748b', fontSize: 12 }}>Total exposure</dt><dd style={{ margin: 0, fontWeight: 700 }}>{formatMyr(borrower.totalExposure)}</dd></div></dl>
    <div style={{ display: 'flex', gap: 8, marginTop: 24 }}><button type="button" onClick={() => onOpen360(borrower.id)} style={{ flex: 1, padding: '9px 12px', border: 0, borderRadius: 6, background: '#0051d5', color: '#fff', cursor: 'pointer' }}>Open 360 View</button><button type="button" onClick={() => onNewApp(borrower.id)} style={{ flex: 1, padding: '9px 12px', border: '1px solid #c6c6cd', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>New Application</button></div>
  </div>
);

export default BorrowerQuickPreview;
