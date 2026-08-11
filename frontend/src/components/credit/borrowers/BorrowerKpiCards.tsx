import React from 'react';

export interface BorrowerKpiData {
  total: number;
  active: number;
  individual: number;
  sme: number;
  corporate: number;
}

const CARDS: Array<{ key: keyof BorrowerKpiData; label: string; icon: string; color: string }> = [
  { key: 'total', label: 'Total borrowers', icon: 'groups', color: '#0051d5' },
  { key: 'active', label: 'Active borrowers', icon: 'check_circle', color: '#15803d' },
  { key: 'individual', label: 'Individual', icon: 'person', color: '#7e22ce' },
  { key: 'sme', label: 'SME', icon: 'storefront', color: '#b45309' },
  { key: 'corporate', label: 'Corporate', icon: 'business', color: '#0369a1' },
];

const BorrowerKpiCards: React.FC<BorrowerKpiData> = (data) => (
  <div aria-label="Borrower summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
    {CARDS.map((card) => (
      <div key={card.key} style={{ minWidth: 0, padding: '12px 16px', background: '#fff', border: '1px solid #c6c6cd', borderRadius: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#45464d', fontSize: 12 }}><span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 16, color: card.color }}>{card.icon}</span>{card.label}</div>
        <div style={{ marginTop: 4, color: '#191c1e', fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{data[card.key].toLocaleString()}</div>
      </div>
    ))}
  </div>
);

export default BorrowerKpiCards;
