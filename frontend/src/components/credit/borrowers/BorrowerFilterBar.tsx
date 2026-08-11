import React, { useEffect, useRef, useState } from 'react';

export interface BorrowerFilterState {
  search: string;
  segmentFilter: string;
  statusFilter: string;
  activeApplicationFilter: string;
}

interface BorrowerFilterBarProps {
  filters: BorrowerFilterState;
  onFilterChange: (filters: BorrowerFilterState) => void;
}

const BorrowerFilterBar: React.FC<BorrowerFilterBarProps> = ({ filters, onFilterChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const activeCount = [filters.segmentFilter, filters.statusFilter, filters.activeApplicationFilter].filter(Boolean).length;
  const update = (key: keyof BorrowerFilterState, value: string) => onFilterChange({ ...filters, [key]: value });

  return (
    <div style={{ background: 'var(--cr-surface-container-lowest, #fff)', border: '1px solid var(--cr-outline-variant, #c6c6cd)', borderRadius: 8, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, flexWrap: 'wrap' }}>
        <label style={{ position: 'relative', flex: '1 1 280px', maxWidth: 520 }}>
          <span className="material-symbols-outlined" aria-hidden="true" style={{ position: 'absolute', left: 10, top: 9, fontSize: 18, color: '#76777d' }}>search</span>
          <input
            type="search"
            aria-label="Search borrowers by name, borrower ID, or identifier"
            value={filters.search}
            onChange={(event) => update('search', event.target.value)}
            placeholder="Search borrower, ID, NRIC, or registration no."
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 36px', border: '1px solid #c6c6cd', borderRadius: 6, background: '#f2f4f6' }}
          />
        </label>
        <div ref={ref} style={{ position: 'relative' }}>
          <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', border: '1px solid #c6c6cd', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 16 }}>filter_list</span>
            Filters{activeCount > 0 ? ` (${activeCount})` : ''}
          </button>
          {open && (
            <div role="dialog" aria-label="Borrower filters" style={{ position: 'absolute', zIndex: 20, top: 'calc(100% + 4px)', left: 0, minWidth: 250, padding: 16, background: '#fff', border: '1px solid #c6c6cd', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.12)' }}>
              <label style={{ display: 'block', marginBottom: 12 }}>Segment<select aria-label="Segment" value={filters.segmentFilter} onChange={(event) => update('segmentFilter', event.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}><option value="">All segments</option><option value="INDIVIDUAL">Individual</option><option value="SME">SME</option><option value="CORPORATE">Corporate</option></select></label>
              <label style={{ display: 'block', marginBottom: 12 }}>Status<select aria-label="Status" value={filters.statusFilter} onChange={(event) => update('statusFilter', event.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ARCHIVED">Archived</option></select></label>
              <label style={{ display: 'block' }}>Active application<select aria-label="Active application" value={filters.activeApplicationFilter} onChange={(event) => update('activeApplicationFilter', event.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}><option value="">Any</option><option value="true">Yes</option><option value="false">No</option></select></label>
            </div>
          )}
        </div>
        {activeCount > 0 && <button type="button" onClick={() => onFilterChange({ ...filters, segmentFilter: '', statusFilter: '', activeApplicationFilter: '' })} style={{ border: 0, background: 'transparent', color: '#0051d5', cursor: 'pointer', fontWeight: 600 }}>Clear filters</button>}
      </div>
    </div>
  );
};

export default BorrowerFilterBar;
