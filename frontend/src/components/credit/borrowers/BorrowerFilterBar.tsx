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
  const popoverRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent) => { if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // Close on Escape and return focus to filter button
  useEffect(() => {
    if (!open) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        filterButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const activeCount = [filters.search, filters.segmentFilter, filters.statusFilter, filters.activeApplicationFilter].filter(Boolean).length;
  const update = (key: keyof BorrowerFilterState, value: string) => onFilterChange({ ...filters, [key]: value });

  const clearAllFilters = () => {
    onFilterChange({ search: '', segmentFilter: '', statusFilter: '', activeApplicationFilter: '' });
  };

  return (
    <section aria-label="Borrower search and filters" style={{ background: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg)', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, flexWrap: 'wrap' }}>
        <label style={{ position: 'relative', flex: '1 1 280px', minWidth: 0, maxWidth: 620 }}>
          <span className="material-symbols-outlined" aria-hidden="true" style={{ position: 'absolute', left: 12, top: 10, fontSize: 18, color: 'var(--cr-outline)' }}>search</span>
          <input
            type="search"
            aria-label="Search borrowers by name, borrower ID, or identifier"
            value={filters.search}
            onChange={(event) => update('search', event.target.value)}
            placeholder="Search borrower, ID, NRIC, or registration no."
            style={{ width: '100%', minHeight: 40, boxSizing: 'border-box', padding: '9px 12px 9px 38px', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius)', background: 'var(--cr-surface-container-low)', color: 'var(--cr-on-surface)', fontFamily: 'var(--cr-font-body)', fontSize: 'var(--cr-text-body-md)' }}
          />
        </label>
        <div ref={popoverRef} style={{ position: 'relative' }}>
          <button ref={filterButtonRef} type="button" aria-expanded={open} aria-controls={open ? 'borrower-filter-popover' : undefined} onClick={() => setOpen((value) => !value)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '9px 14px', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius)', background: 'var(--cr-surface-container-lowest)', color: 'var(--cr-on-surface)', cursor: 'pointer', fontFamily: 'var(--cr-font-body)', fontSize: 'var(--cr-text-body-md)', fontWeight: 'var(--cr-fw-label)' }}>
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 16 }}>filter_list</span>
            Filters{activeCount > 0 ? ` (${activeCount})` : ''}
          </button>
          {open && (
            <div id="borrower-filter-popover" role="dialog" aria-label="Borrower filters" style={{ position: 'absolute', zIndex: 20, top: 'calc(100% + 8px)', right: 0, width: 'min(320px, calc(100vw - 32px))', maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box', padding: 16, background: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg)', boxShadow: '0 8px 24px rgba(25,28,30,.16)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Filters</h3>
                <button type="button" aria-label="Close" onClick={() => { setOpen(false); filterButtonRef.current?.focus(); }} style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span></button>
              </div>
              {activeCount > 0 && <div role="status" aria-live="polite" style={{ fontSize: 'var(--cr-text-label-md)', color: 'var(--cr-on-surface-variant)', marginBottom: 12 }}>{activeCount} filter{activeCount !== 1 ? 's' : ''} active</div>}
              <label style={{ display: 'block', marginBottom: 12 }}>Segment<select aria-label="Segment" value={filters.segmentFilter} onChange={(event) => update('segmentFilter', event.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}><option value="">All segments</option><option value="INDIVIDUAL">Individual</option><option value="SME">SME</option><option value="CORPORATE">Corporate</option></select></label>
              <label style={{ display: 'block', marginBottom: 12 }}>Status<select aria-label="Status" value={filters.statusFilter} onChange={(event) => update('statusFilter', event.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ARCHIVED">Archived</option></select></label>
              <label style={{ display: 'block' }}>Active application<select aria-label="Active application" value={filters.activeApplicationFilter} onChange={(event) => update('activeApplicationFilter', event.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}><option value="">Any</option><option value="true">Yes</option><option value="false">No</option></select></label>
              {activeCount > 0 && <button type="button" aria-label="Clear all filters" onClick={clearAllFilters} style={{ display: 'block', width: '100%', marginTop: 12, padding: '8px 12px', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius)', background: 'var(--cr-surface-container-lowest)', cursor: 'pointer', fontWeight: 'var(--cr-fw-label)', color: 'var(--cr-secondary)' }}>Clear all filters</button>}
            </div>
          )}
        </div>
        {activeCount > 0 && <button type="button" onClick={clearAllFilters} style={{ border: 0, background: 'transparent', color: 'var(--cr-secondary)', cursor: 'pointer', fontFamily: 'var(--cr-font-body)', fontWeight: 'var(--cr-fw-label)' }}>Clear filters</button>}
      </div>
    </section>
  );
};

export default BorrowerFilterBar;
