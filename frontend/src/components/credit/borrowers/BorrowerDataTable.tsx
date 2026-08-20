import React from 'react';
import type { BorrowerListItem, BorrowerDataQuality, BorrowerMissingField } from '@/src/types/credit-ui.types';
import { formatMyr } from '@/src/lib/credit/formatters';
import BorrowerStatusBadge from './BorrowerStatusBadge';
import BorrowerDataQualityBadge from './BorrowerDataQualityBadge';

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
  onClearFilters?: () => void;
}

const label = (value: string | null | undefined) => value ? value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : '—';
const typeLabel = (row: BorrowerProfileRow) => row.segment ? label(row.segment) : label(row.legalType);

const sortableKeys = ['name', 'segment', 'activeApplicationCount', 'totalExposure', 'status', 'updatedAt'] as const;

type SortKey = (typeof sortableKeys)[number];

const headers: Array<{ key?: SortKey; label: string; priority: 'primary' | 'secondary' }> = [
  { label: 'Borrower ID', priority: 'primary' },
  { key: 'name', label: 'Borrower', priority: 'primary' },
  { key: 'segment', label: 'Type / Segment', priority: 'primary' },
  { label: 'NRIC / Registration No.', priority: 'secondary' },
  { label: 'Contact', priority: 'secondary' },
  { label: 'Relationship Owner', priority: 'secondary' },
  { key: 'activeApplicationCount', label: 'Active Applications', priority: 'primary' },
  { key: 'totalExposure', label: 'Total Exposure', priority: 'primary' },
  { key: 'status', label: 'Status', priority: 'primary' },
  { key: 'updatedAt', label: 'Last Updated', priority: 'secondary' },
  { label: 'Action', priority: 'primary' },
];

function getAriaSort(headerKey: SortKey | undefined, currentSortBy: string, currentDirection: 'asc' | 'desc'): 'ascending' | 'descending' | 'none' | undefined {
  if (!headerKey) return undefined;
  if (currentSortBy === headerKey) return currentDirection === 'asc' ? 'ascending' : 'descending';
  return 'none';
}

function buildRowLabel(row: BorrowerProfileRow): string {
  const parts = [row.name || 'Unnamed borrower', row.status ? label(row.status) : 'status unavailable'];
  if (row.dataQuality === 'INCOMPLETE') {
    parts.push('data incomplete');
    if (row.missingFields.length > 0) {
      const fieldLabels: Record<BorrowerMissingField, string> = { name: 'name', identifier: 'identifier', contact: 'contact', segment: 'segment', owner: 'relationship owner' };
      parts.push(`missing ${row.missingFields.map((f) => fieldLabels[f]).join(', ')}`);
    }
  }
  return parts.join('; ');
}

const menuStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '9px 12px', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer' };

const BorrowerDataTable: React.FC<BorrowerDataTableProps> = ({ profiles, loading, sortBy, sortDirection, canCreate, canWrite, onSort, onRowClick, onNameClick, onActiveApplicationsClick, onActionClick, onClearFilters }) => {
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  // Close menu on outside click
  React.useEffect(() => {
    if (openMenuId === null) return undefined;
    const handler = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuId]);

  // Close menu on Escape
  React.useEffect(() => {
    if (openMenuId === null) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenuId(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [openMenuId]);

  if (loading) return <div role="status" aria-label="Loading borrowers" style={{ padding: 16 }}>{[1, 2, 3, 4, 5].map((row) => <div key={row} style={{ height: 48, marginBottom: 8, borderRadius: 6, background: '#e6e8ea', animation: 'pulse 1.5s ease-in-out infinite' }} />)}</div>;
  if (profiles.length === 0) return <div style={{ padding: '48px 24px', textAlign: 'center' }}><span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 44, color: '#76777d' }}>person_search</span><p style={{ fontWeight: 700 }}>No borrowers found</p><p style={{ color: '#45464d' }}>Try changing your search or filters.</p>{onClearFilters && <button type="button" onClick={onClearFilters} style={{ marginTop: 8, padding: '8px 12px', border: '1px solid #c6c6cd', borderRadius: 6, background: '#fff', color: '#0051d5', cursor: 'pointer', fontWeight: 600 }}>Clear search and filters</button>}</div>;

  return (
    <div className="borrower-table-scroll" style={{ maxWidth: '100%', overflowX: 'auto', overscrollBehaviorX: 'contain' }}>
      <style>{`@media (max-width: 900px) { .borrower-table-scroll table { min-width: 0 !important; table-layout: fixed; } .borrower-table-scroll th, .borrower-table-scroll td { padding: 10px 8px !important; } .borrower-table-scroll [data-priority="secondary"] { display: none; } .borrower-table-scroll th:nth-child(2), .borrower-table-scroll td:nth-child(2) { width: 32%; } .borrower-table-scroll th:nth-child(7), .borrower-table-scroll td:nth-child(7) { width: 18%; } .borrower-table-scroll th:nth-child(9), .borrower-table-scroll td:nth-child(9) { width: 24%; } .borrower-table-scroll th:last-child, .borrower-table-scroll td:last-child { width: 42px; } }`}</style>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 0 }} aria-label="Borrower list">
        <thead><tr style={{ background: '#f2f4f6' }}>{headers.map((header) => <th key={header.label} data-priority={header.priority} scope="col" aria-sort={getAriaSort(header.key, sortBy, sortDirection)} style={{ padding: '11px 12px', textAlign: header.key === 'totalExposure' ? 'right' : 'left', fontSize: 11, color: '#45464d', whiteSpace: 'nowrap' }}>{header.key ? <button type="button" aria-label={`Sort by ${header.label}`} onClick={() => onSort(header.key!)} style={{ border: 0, background: 'transparent', padding: 0, color: 'inherit', fontWeight: 700, cursor: 'pointer' }}>{header.label}{sortBy === header.key && <span aria-hidden="true"> {sortDirection === 'asc' ? '↑' : '↓'}</span>}</button> : header.label}</th>)}</tr></thead>
        <tbody>{profiles.map((row) => {
          const rowLabel = buildRowLabel(row);
          return (
            <tr
              key={row.id}
              tabIndex={0}
              aria-label={rowLabel}
              onClick={() => onRowClick(row.id)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onRowClick(row.id); } }}
              style={{ borderBottom: '1px solid #e1e2e6', cursor: 'pointer' }}
            >
              <td data-priority="primary" style={{ padding: '12px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{row.borrowerNumber || '—'}</td>
              <td data-priority="primary" style={{ padding: '12px' }}><button type="button" onClick={(event) => { event.stopPropagation(); onNameClick(row.id); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.stopPropagation(); } }} style={{ border: 0, background: 'transparent', color: '#0051d5', fontWeight: 700, padding: 0, cursor: 'pointer', textAlign: 'left' }}>{row.name || 'Unnamed borrower'}</button></td>
              <td data-priority="primary" style={{ padding: '12px' }}><span style={{ fontWeight: 600 }}>{typeLabel(row)}</span><div style={{ color: '#64748b', fontSize: 11 }}>{label(row.legalType)}</div></td>
              <td data-priority="secondary" style={{ padding: '12px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{row.maskedIdentifier || '—'}</td>
              <td data-priority="secondary" style={{ padding: '12px' }}>{row.primaryContact || '—'}</td>
              <td data-priority="secondary" style={{ padding: '12px' }}>{row.relationshipOwner?.name || 'Unassigned'}</td>
              <td data-priority="primary" style={{ padding: '12px', fontVariantNumeric: 'tabular-nums' }}><button type="button" onClick={(event) => { event.stopPropagation(); onActiveApplicationsClick(row.id); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.stopPropagation(); } }} style={{ border: 0, background: 'transparent', color: '#0051d5', fontWeight: 700, cursor: 'pointer', padding: 0 }} aria-label={`${row.activeApplicationCount} active applications`}>{row.activeApplicationCount.toLocaleString()}</button></td>
              <td data-priority="primary" style={{ padding: '12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatMyr(row.totalExposure)}</td>
              <td data-priority="primary" style={{ padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <BorrowerStatusBadge status={row.status} />
                  <BorrowerDataQualityBadge dataQuality={row.dataQuality} missingFields={row.missingFields} />
                </div>
              </td>
              <td data-priority="secondary" style={{ padding: '12px', whiteSpace: 'nowrap', color: '#45464d' }}>{new Date(row.updatedAt).toLocaleDateString('en-GB')}</td>
              <td data-priority="primary" style={{ padding: '12px', position: 'relative' }}>
                <button type="button" aria-label={`Actions for ${row.name}`} aria-expanded={openMenuId === row.id} aria-controls={openMenuId === row.id ? `action-menu-${row.id}` : undefined} onClick={(event) => { event.stopPropagation(); setOpenMenuId(openMenuId === row.id ? null : row.id); }} style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 4 }}><span className="material-symbols-outlined" aria-hidden="true">more_vert</span></button>
                {openMenuId === row.id && (
                  <div ref={menuRef} id={`action-menu-${row.id}`} role="menu" style={{ position: 'absolute', right: 8, top: '100%', zIndex: 10, minWidth: 170, background: '#fff', border: '1px solid #c6c6cd', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.12)' }}>
                    <button role="menuitem" type="button" onClick={() => { setOpenMenuId(null); onActionClick(row.id, 'view'); }} style={menuStyle}>Open 360 View</button>
                    {canCreate && <button role="menuitem" type="button" onClick={() => { setOpenMenuId(null); onActionClick(row.id, 'newApp'); }} style={menuStyle}>New Application</button>}
                    {canWrite && <button role="menuitem" type="button" onClick={() => { setOpenMenuId(null); onActionClick(row.id, 'edit'); }} style={menuStyle}>Edit Borrower</button>}
                  </div>
                )}
              </td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
};

export default BorrowerDataTable;
