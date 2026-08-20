import React from 'react';

export interface BorrowerKpiData {
  total: number;
  active: number;
  individual: number;
  sme: number;
  corporate: number;
  scope?: 'global' | 'filtered';
  filteredTotal?: number;
}

const CARDS: Array<{ key: keyof BorrowerKpiData; label: string; icon: string; color: string }> = [
  { key: 'total', label: 'Total borrowers', icon: 'groups', color: '#0051d5' },
  { key: 'active', label: 'Active borrowers', icon: 'check_circle', color: '#15803d' },
  { key: 'individual', label: 'Individual', icon: 'person', color: '#7e22ce' },
  { key: 'sme', label: 'SME', icon: 'storefront', color: '#b45309' },
  { key: 'corporate', label: 'Corporate', icon: 'business', color: '#0369a1' },
];

const BorrowerKpiCards: React.FC<BorrowerKpiData> = (data) => {
  const isFiltered = data.scope === 'filtered';
  const scopeLabel = isFiltered ? 'Filtered borrowers' : 'All borrowers';

  return (
    <section aria-label="Borrower summary" style={{ marginBottom: 20 }}>
      {isFiltered && data.filteredTotal !== undefined && (
        <div style={{ marginBottom: 8, fontSize: 'var(--cr-text-label-md)', color: 'var(--cr-on-surface-variant)', fontWeight: 'var(--cr-fw-label)' }}>
          Showing {data.filteredTotal.toLocaleString()} of {data.total.toLocaleString()} total borrowers
        </div>
      )}
      {!isFiltered && (
        <div style={{ marginBottom: 8, fontSize: 'var(--cr-text-label-md)', color: 'var(--cr-on-surface-variant)', fontWeight: 'var(--cr-fw-label)' }}>
          {scopeLabel}
        </div>
      )}
      <ul aria-label="Borrower summary metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))', gap: 12, margin: 0, padding: 0, listStyle: 'none' }}>
      {CARDS.map((card) => {
        const value = data[card.key];
        const showFiltered = isFiltered && card.key === 'total' && data.filteredTotal !== undefined;
        return (
          <li key={card.key} style={{ minWidth: 0, padding: '16px', background: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--cr-on-surface-variant)', fontSize: 'var(--cr-text-label-md)', fontWeight: 'var(--cr-fw-label)' }}><span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 16, color: card.color }}>{card.icon}</span>{card.label}</div>
            <div style={{ marginTop: 6, color: 'var(--cr-on-surface)', fontFamily: 'var(--cr-font-display)', fontSize: 'var(--cr-text-headline-lg)', fontWeight: 'var(--cr-fw-display)', fontVariantNumeric: 'tabular-nums' }}>
              {showFiltered ? data.filteredTotal!.toLocaleString() : (typeof value === 'number' ? value.toLocaleString() : value)}
            </div>
          </li>
        );
      })}
      </ul>
    </section>
  );
};

export default BorrowerKpiCards;
