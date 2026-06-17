import React from 'react';
import { Branch, CreditProductType } from '../../../services/credit.service';

export interface QuickFilterOption<Key extends string> {
  key: Key;
  label: string;
  icon: string;
}

interface ProductOption {
  value: CreditProductType;
  label: string;
}

interface ApplicationFilterBarProps<Key extends string> {
  quickFilters: QuickFilterOption<Key>[];
  activeQuickFilter: Key;
  onQuickFilterChange: (key: Key) => void;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  productFilter: string;
  onProductFilterChange: (value: string) => void;
  stateFilter: string;
  onStateFilterChange: (value: string) => void;
  branchFilter: string;
  onBranchFilterChange: (value: string) => void;
  branches: Branch[];
  productTypes: ProductOption[];
  stateKeys: string[];
  view: 'table' | 'kanban';
  onViewChange: (view: 'table' | 'kanban') => void;
}

const inputClass = 'h-9 w-full border px-3 text-sm outline-none transition-all focus:ring-1';

const ApplicationFilterBar = <Key extends string>({
  quickFilters,
  activeQuickFilter,
  onQuickFilterChange,
  searchInput,
  onSearchInputChange,
  productFilter,
  onProductFilterChange,
  stateFilter,
  onStateFilterChange,
  branchFilter,
  onBranchFilterChange,
  branches,
  productTypes,
  stateKeys,
  view,
  onViewChange,
}: ApplicationFilterBarProps<Key>) => {
  return (
    <div className="space-y-3 p-4" style={{ background: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg)' }}>
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Quick filter views">
        {quickFilters.map(qf => {
          const active = activeQuickFilter === qf.key;
          return (
            <button
              key={qf.key}
              role="tab"
              aria-selected={active}
              onClick={() => onQuickFilterChange(qf.key)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors"
              style={{
                background: active ? 'var(--cr-primary)' : 'var(--cr-surface-container-lowest)',
                borderColor: active ? 'var(--cr-primary)' : 'var(--cr-outline-variant)',
                color: active ? 'var(--cr-on-primary)' : 'var(--cr-on-surface-variant)',
                cursor: 'pointer',
              }}
            >
              <span className="material-symbols-outlined text-[14px]">{qf.icon}</span>
              {qf.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--cr-on-surface-variant)' }}>App / Borrower</span>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px]" style={{ color: 'var(--cr-on-surface-variant)' }}>search</span>
            <input
              value={searchInput}
              onChange={e => onSearchInputChange(e.target.value)}
              placeholder="Search app no, borrower, purpose..."
              aria-label="Search credit applications"
              className={`${inputClass} pl-10`}
              style={{ background: 'var(--cr-surface-container-low)', borderColor: 'var(--cr-outline-variant)', borderRadius: 'var(--cr-radius)' }}
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--cr-on-surface-variant)' }}>Product</span>
          <select value={productFilter} onChange={e => onProductFilterChange(e.target.value)} className={inputClass} style={{ background: 'white', borderColor: 'var(--cr-outline-variant)', borderRadius: 'var(--cr-radius)' }}>
            <option value="">All Products</option>
            {productTypes.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--cr-on-surface-variant)' }}>State</span>
          <select value={stateFilter} onChange={e => onStateFilterChange(e.target.value)} className={inputClass} style={{ background: 'white', borderColor: 'var(--cr-outline-variant)', borderRadius: 'var(--cr-radius)' }}>
            <option value="">All States</option>
            {stateKeys.map(key => <option key={key} value={key}>{key.replace(/_/g, ' ')}</option>)}
          </select>
        </label>

        {branches.length > 0 && (
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--cr-on-surface-variant)' }}>Branch</span>
            <select value={branchFilter} onChange={e => onBranchFilterChange(e.target.value)} className={inputClass} style={{ background: 'white', borderColor: 'var(--cr-outline-variant)', borderRadius: 'var(--cr-radius)' }}>
              <option value="">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
            </select>
          </label>
        )}

        <div className="flex items-end">
          <div className="inline-flex h-9 overflow-hidden border" style={{ borderColor: 'var(--cr-outline-variant)', borderRadius: 'var(--cr-radius)' }}>
            {(['table', 'kanban'] as const).map(v => (
              <button
                key={v}
                onClick={() => onViewChange(v)}
                className="inline-flex items-center gap-1.5 px-3 text-xs font-bold capitalize transition-colors"
                style={{
                  background: view === v ? 'var(--cr-secondary)' : 'white',
                  color: view === v ? 'var(--cr-on-secondary)' : 'var(--cr-on-surface-variant)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <span className="material-symbols-outlined text-[14px]">{v === 'table' ? 'table_rows' : 'view_column'}</span>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplicationFilterBar;
