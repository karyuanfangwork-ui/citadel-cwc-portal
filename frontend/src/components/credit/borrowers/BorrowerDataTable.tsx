import React from 'react';
import type { BorrowerListItem } from '@/src/types/credit-ui.types';
import { formatMyr } from '@/src/lib/credit/formatters';
import BorrowerStatusBadge from './BorrowerStatusBadge';

export type BorrowerProfileRow = BorrowerListItem;

interface BorrowerDataTableProps {
  profiles: BorrowerProfileRow[];
  loading: boolean;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  canCreate: boolean;
  canWrite: boolean;
  onSort: (field: 'name' | 'segment' | 'activeApplicationCount' | 'totalExposure' | 'status' | 'updatedAt') => void;
  onRowClick: (id: string) => void;
  onNameClick: (id: string) => void;
  onActiveApplicationsClick: (id: string) => void;
  onActionClick: (id: string, action: string) => void;
}

const label = (value: string | null | undefined) => value ? value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : '—';
const typeLabel = (row: BorrowerProfileRow) => row.segment ? label(row.segment) : label(row.legalType);
const headers: Array<{ key?: 'name' | 'segment' | 'activeApplicationCount' | 'totalExposure' | 'status' | 'updatedAt'; label: string }> = [
  { label: 'Borrower ID' }, { key: 'name', label: 'Borrower' }, { key: 'segment', label: 'Type / Segment' }, { label: 'NRIC / Registration No.' }, { label: 'Contact' }, { label: 'Relationship Owner' }, { key: 'activeApplicationCount', label: 'Active Applications' }, { key: 'totalExposure', label: 'Total Exposure' }, { key: 'status', label: 'Status' }, { key: 'updatedAt', label: 'Last Updated' }, { label: 'Action' },
];

const BorrowerDataTable: React.FC<BorrowerDataTableProps> = ({ profiles, loading, sortBy, sortDirection, canCreate, canWrite, onSort, onRowClick, onNameClick, onActiveApplicationsClick, onActionClick }) => {
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
  if (loading) return <div role="status" aria-label="Loading borrowers" style={{ padding: 16 }}>{[1, 2, 3, 4, 5].map((row) => <div key={row} style={{ height: 48, marginBottom: 8, borderRadius: 6, background: '#e6e8ea', animation: 'pulse 1.5s ease-in-out infinite' }} />)}</div>;
  if (profiles.length === 0) return <div style={{ padding: '48px 24px', textAlign: 'center' }}><span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 44, color: '#76777d' }}>person_search</span><p style={{ fontWeight: 700 }}>No borrowers found</p><p style={{ color: '#45464d' }}>Try changing your search or filters.</p></div>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1080 }}>
        <thead><tr style={{ background: '#f2f4f6' }}>{headers.map((header) => <th key={header.label} scope="col" style={{ padding: '11px 12px', textAlign: header.key === 'totalExposure' ? 'right' : 'left', fontSize: 11, color: '#45464d', whiteSpace: 'nowrap' }}>{header.key ? <button type="button" aria-label={`Sort by ${header.label}`} onClick={() => onSort(header.key!)} style={{ border: 0, background: 'transparent', padding: 0, color: 'inherit', fontWeight: 700, cursor: 'pointer' }}>{header.label}{sortBy === header.key && <span aria-hidden="true"> {sortDirection === 'asc' ? '↑' : '↓'}</span>}</button> : header.label}</th>)}</tr></thead>
        <tbody>{profiles.map((row) => (
          <tr key={row.id} onClick={() => onRowClick(row.id)} style={{ borderBottom: '1px solid #e1e2e6', cursor: 'pointer' }}>
            <td style={{ padding: '12px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{row.borrowerNumber || '—'}</td>
            <td style={{ padding: '12px' }}><button type="button" onClick={(event) => { event.stopPropagation(); onNameClick(row.id); }} style={{ border: 0, background: 'transparent', color: '#0051d5', fontWeight: 700, padding: 0, cursor: 'pointer', textAlign: 'left' }}>{row.name}</button></td>
            <td style={{ padding: '12px' }}><span style={{ fontWeight: 600 }}>{typeLabel(row)}</span><div style={{ color: '#64748b', fontSize: 11 }}>{label(row.legalType)}</div></td>
            <td style={{ padding: '12px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{row.maskedIdentifier || '—'}</td>
            <td style={{ padding: '12px' }}>{row.primaryContact || '—'}</td>
            <td style={{ padding: '12px' }}>{row.relationshipOwner?.name || 'Unassigned'}</td>
            <td style={{ padding: '12px', fontVariantNumeric: 'tabular-nums' }}><button type="button" onClick={(event) => { event.stopPropagation(); onActiveApplicationsClick(row.id); }} style={{ border: 0, background: 'transparent', color: '#0051d5', fontWeight: 700, cursor: 'pointer', padding: 0 }}>{row.activeApplicationCount.toLocaleString()}</button></td>
            <td style={{ padding: '12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatMyr(row.totalExposure)}</td>
            <td style={{ padding: '12px' }}><BorrowerStatusBadge status={row.status} /></td>
            <td style={{ padding: '12px', whiteSpace: 'nowrap', color: '#45464d' }}>{new Date(row.updatedAt).toLocaleDateString('en-GB')}</td>
            <td style={{ padding: '12px', position: 'relative' }}><button type="button" aria-label={`Actions for ${row.name}`} aria-expanded={openMenuId === row.id} onClick={(event) => { event.stopPropagation(); setOpenMenuId(openMenuId === row.id ? null : row.id); }} style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 4 }}><span className="material-symbols-outlined" aria-hidden="true">more_vert</span></button>{openMenuId === row.id && <div role="menu" style={{ position: 'absolute', right: 8, top: '100%', zIndex: 10, minWidth: 170, background: '#fff', border: '1px solid #c6c6cd', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.12)' }}><button role="menuitem" type="button" onClick={() => { setOpenMenuId(null); onActionClick(row.id, 'view'); }} style={menuStyle}>Open 360 View</button>{canCreate && <button role="menuitem" type="button" onClick={() => { setOpenMenuId(null); onActionClick(row.id, 'newApp'); }} style={menuStyle}>New Application</button>}{canWrite && <button role="menuitem" type="button" onClick={() => { setOpenMenuId(null); onActionClick(row.id, 'edit'); }} style={menuStyle}>Edit Borrower</button>}</div>}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
};

const menuStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '9px 12px', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer' };
export default BorrowerDataTable;
