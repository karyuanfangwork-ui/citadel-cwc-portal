import React from 'react';

interface BorrowerKpiCardsProps {
  total: number;
  active: number | null;
  pendingKyc: number | null;
  watchlist: number | null;
}

const CARDS = [
  {
    key: 'total' as const,
    label: 'Total Borrowers',
    icon: 'groups',
    iconColor: 'var(--cr-secondary, #0051d5)',
    bgWatermark: 'var(--cr-surface-container, #eceef0)',
  },
  {
    key: 'active' as const,
    label: 'Active Borrowers',
    icon: 'check_circle',
    iconColor: '#16a34a',
    bgWatermark: '#f0fdf4',
  },
  {
    key: 'pendingKyc' as const,
    label: 'Pending KYC',
    icon: 'pending_actions',
    iconColor: '#d97706',
    bgWatermark: '#fffbeb',
  },
  {
    key: 'watchlist' as const,
    label: 'Watchlist',
    icon: 'warning',
    iconColor: 'var(--cr-error, #ba1a1a)',
    bgWatermark: 'var(--cr-error-container, #ffdad6)',
    borderOverride: 'var(--cr-error-container, #ffdad6)',
  },
] as const;

const BorrowerKpiCards: React.FC<BorrowerKpiCardsProps> = ({ total, active, pendingKyc, watchlist }) => {
  const values = { total, active, pendingKyc, watchlist };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 'var(--cr-gap, 16px)',
      marginBottom: 'var(--cr-gap, 16px)',
    }}>
      {CARDS.map((card) => {
        const val = values[card.key];
        const isError = card.key === 'watchlist';
        return (
          <div
            key={card.key}
            style={{
              backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
              border: `1px solid ${isError ? card.borderOverride : 'var(--cr-outline-variant, #c6c6cd)'}`,
              borderRadius: 'var(--cr-radius-lg, 0.5rem)',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Label row */}
            <div style={{
              fontSize: 'var(--cr-text-body-sm, 13px)',
              lineHeight: 'var(--cr-leading-body-sm, 18px)',
              fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
              color: 'var(--cr-on-surface-variant, #45464d)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: card.iconColor }}>
                {card.icon}
              </span>
              {card.label}
            </div>
            {/* Value */}
            <div style={{
              fontSize: 'var(--cr-text-display, 36px)',
              lineHeight: 'var(--cr-leading-display, 44px)',
              fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
              fontWeight: 'var(--cr-fw-display, 700)',
              color: 'var(--cr-on-surface, #191c1e)',
              letterSpacing: 'var(--cr-tracking-display, -0.02em)',
            }}>
              {val !== null ? val.toLocaleString() : '—'}
            </div>
            {/* Background watermark icon */}
            <div style={{
              position: 'absolute',
              bottom: '-12px',
              right: '-8px',
              color: card.bgWatermark,
              pointerEvents: 'none',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '80px', fontVariationSettings: "'FILL' 1" }}>
                {card.icon}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BorrowerKpiCards;