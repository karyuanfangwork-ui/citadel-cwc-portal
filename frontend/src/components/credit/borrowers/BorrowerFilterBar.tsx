import React, { useState, useRef, useEffect } from 'react';

export interface BorrowerFilterState {
  search: string;
  typeFilter: string;
  statusFilter: string;
  riskFilter: string;
}

interface BorrowerFilterBarProps {
  filters: BorrowerFilterState;
  onFilterChange: (filters: BorrowerFilterState) => void;
  onExport: () => void;
}

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'CORPORATE', label: 'Corporate' },
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'SOLE_PROPRIETOR', label: 'Sole Proprietor' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const RISK_OPTIONS = [
  { value: '', label: 'All Ratings' },
  { value: 'AAA-AA', label: 'AAA – AA' },
  { value: 'A', label: 'A' },
  { value: 'BBB-BB', label: 'BBB – BB' },
  { value: 'B-', label: 'B or below' },
];

const BorrowerFilterBar: React.FC<BorrowerFilterBarProps> = ({ filters, onFilterChange, onExport }) => {
  const [showFilters, setShowFilters] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilters(false);
      }
    };
    if (showFilters) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilters]);

  const activeChips: { key: string; label: string }[] = [];
  if (filters.typeFilter) {
    const opt = TYPE_OPTIONS.find(o => o.value === filters.typeFilter);
    if (opt) activeChips.push({ key: 'typeFilter', label: `Type: ${opt.label}` });
  }
  if (filters.statusFilter) {
    const opt = STATUS_OPTIONS.find(o => o.value === filters.statusFilter);
    if (opt) activeChips.push({ key: 'statusFilter', label: `Status: ${opt.label}` });
  }
  if (filters.riskFilter) {
    const opt = RISK_OPTIONS.find(o => o.value === filters.riskFilter);
    if (opt) activeChips.push({ key: 'riskFilter', label: `Risk: ${opt.label}` });
  }

  const clearChip = (key: string) => {
    onFilterChange({ ...filters, [key]: '' });
  };

  const clearAll = () => {
    onFilterChange({ search: filters.search, typeFilter: '', statusFilter: '', riskFilter: '' });
  };

  return (
    <div style={{
      backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
      border: '1px solid var(--cr-outline-variant, #c6c6cd)',
      borderRadius: 'var(--cr-radius-lg, 0.5rem)',
      marginBottom: 'var(--cr-gap, 16px)',
    }}>
      {/* Top row: Search + Filters dropdown + Export */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
      }}>
        {/* Search input */}
        <div style={{ position: 'relative', flex: 1, maxWidth: '480px' }}>
          <span className="material-symbols-outlined" style={{
            position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
            fontSize: '18px', color: 'var(--cr-outline, #76777d)',
          }}>search</span>
          <input
            type="text"
            value={filters.search}
            onChange={e => onFilterChange({ ...filters, search: e.target.value })}
            placeholder="Search by Borrower Name, CIF, IC..."
            style={{
              width: '100%',
              paddingLeft: '36px',
              paddingRight: '12px',
              paddingTop: '8px',
              paddingBottom: '8px',
              fontSize: 'var(--cr-text-body-md, 14px)',
              fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
              color: 'var(--cr-on-surface, #191c1e)',
              backgroundColor: 'var(--cr-surface-container-low, #f2f4f6)',
              border: '1px solid var(--cr-outline-variant, #c6c6cd)',
              borderRadius: 'var(--cr-radius, 0.25rem)',
              outline: 'none',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </div>

        {/* Filters dropdown trigger */}
        <div ref={filterRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px',
              fontSize: 'var(--cr-text-body-md, 14px)',
              fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
              color: 'var(--cr-on-surface-variant, #45464d)',
              backgroundColor: activeChips.length > 0 ? 'var(--cr-surface-container, #eceef0)' : 'var(--cr-surface-container-lowest, #ffffff)',
              border: '1px solid var(--cr-outline-variant, #c6c6cd)',
              borderRadius: 'var(--cr-radius, 0.25rem)',
              cursor: 'pointer',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>filter_list</span>
            Filters
            {activeChips.length > 0 && (
              <span style={{
                backgroundColor: 'var(--cr-secondary, #0051d5)',
                color: 'var(--cr-on-secondary, #ffffff)',
                borderRadius: '9999px',
                padding: '1px 6px',
                fontSize: '11px',
                fontWeight: 600,
              }}>{activeChips.length}</span>
            )}
          </button>

          {/* Dropdown */}
          {showFilters && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 50,
              marginTop: '4px',
              backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
              border: '1px solid var(--cr-outline-variant, #c6c6cd)',
              borderRadius: 'var(--cr-radius-lg, 0.5rem)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              padding: '16px',
              minWidth: '240px',
            }}>
              {/* Type filter */}
              <label style={{ display: 'block', marginBottom: '12px' }}>
                <span style={{
                  display: 'block', marginBottom: '4px',
                  fontSize: 'var(--cr-text-label-md, 12px)',
                  fontWeight: 'var(--cr-fw-label, 600)',
                  fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
                  color: 'var(--cr-on-surface-variant, #45464d)',
                  letterSpacing: 'var(--cr-tracking-label, 0.05em)',
                }}>TYPE</span>
                <select
                  value={filters.typeFilter}
                  onChange={e => onFilterChange({ ...filters, typeFilter: e.target.value })}
                  style={{
                    width: '100%', padding: '8px 10px',
                    fontSize: 'var(--cr-text-body-md, 14px)',
                    fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
                    color: 'var(--cr-on-surface, #191c1e)',
                    backgroundColor: 'var(--cr-surface-container-low, #f2f4f6)',
                    border: '1px solid var(--cr-outline-variant, #c6c6cd)',
                    borderRadius: 'var(--cr-radius, 0.25rem)',
                    cursor: 'pointer',
                  }}
                >
                  {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>

              {/* Status filter */}
              <label style={{ display: 'block', marginBottom: '12px' }}>
                <span style={{
                  display: 'block', marginBottom: '4px',
                  fontSize: 'var(--cr-text-label-md, 12px)',
                  fontWeight: 'var(--cr-fw-label, 600)',
                  fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
                  color: 'var(--cr-on-surface-variant, #45464d)',
                  letterSpacing: 'var(--cr-tracking-label, 0.05em)',
                }}>STATUS</span>
                <select
                  value={filters.statusFilter}
                  onChange={e => onFilterChange({ ...filters, statusFilter: e.target.value })}
                  style={{
                    width: '100%', padding: '8px 10px',
                    fontSize: 'var(--cr-text-body-md, 14px)',
                    fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
                    color: 'var(--cr-on-surface, #191c1e)',
                    backgroundColor: 'var(--cr-surface-container-low, #f2f4f6)',
                    border: '1px solid var(--cr-outline-variant, #c6c6cd)',
                    borderRadius: 'var(--cr-radius, 0.25rem)',
                    cursor: 'pointer',
                  }}
                >
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>

              {/* Risk Rating filter */}
              <label style={{ display: 'block' }}>
                <span style={{
                  display: 'block', marginBottom: '4px',
                  fontSize: 'var(--cr-text-label-md, 12px)',
                  fontWeight: 'var(--cr-fw-label, 600)',
                  fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
                  color: 'var(--cr-on-surface-variant, #45464d)',
                  letterSpacing: 'var(--cr-tracking-label, 0.05em)',
                }}>RISK RATING</span>
                <select
                  value={filters.riskFilter}
                  onChange={e => onFilterChange({ ...filters, riskFilter: e.target.value })}
                  style={{
                    width: '100%', padding: '8px 10px',
                    fontSize: 'var(--cr-text-body-md, 14px)',
                    fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
                    color: 'var(--cr-on-surface, #191c1e)',
                    backgroundColor: 'var(--cr-surface-container-low, #f2f4f6)',
                    border: '1px solid var(--cr-outline-variant, #c6c6cd)',
                    borderRadius: 'var(--cr-radius, 0.25rem)',
                    cursor: 'pointer',
                  }}
                >
                  {RISK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            </div>
          )}
        </div>

        {/* Export button */}
        <button
          onClick={onExport}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px',
            fontSize: 'var(--cr-text-body-md, 14px)',
            fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
            color: 'var(--cr-on-surface-variant, #45464d)',
            backgroundColor: 'var(--cr-surface, #f7f9fb)',
            border: '1px solid var(--cr-outline-variant, #c6c6cd)',
            borderRadius: 'var(--cr-radius, 0.25rem)',
            cursor: 'pointer',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
          Export
        </button>
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px',
          padding: '10px 16px',
          backgroundColor: 'var(--cr-surface-container-low, #f2f4f6)',
          borderTop: '1px solid var(--cr-outline-variant, #c6c6cd)',
        }}>
          {activeChips.map(chip => (
            <span key={chip.key} style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '4px 10px',
              backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
              border: '1px solid var(--cr-outline-variant, #c6c6cd)',
              borderRadius: '9999px',
              fontSize: 'var(--cr-text-body-sm, 13px)',
              fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
              color: 'var(--cr-on-surface, #191c1e)',
            }}>
              {chip.label}
              <button
                onClick={() => clearChip(chip.key)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 0, lineHeight: 1, color: 'var(--cr-outline, #76777d)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
              </button>
            </span>
          ))}
          <button
            onClick={clearAll}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 'var(--cr-text-label-md, 12px)',
              fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
              fontWeight: 'var(--cr-fw-label, 600)',
              color: 'var(--cr-secondary, #0051d5)',
              letterSpacing: 'var(--cr-tracking-label, 0.05em)',
            }}
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
};

export default BorrowerFilterBar;