import React from 'react';
import { BorrowerProfileRow } from './BorrowerDataTable';

interface BorrowerQuickPreviewProps {
  borrower: BorrowerProfileRow;
  onClose: () => void;
  onOpen360: (id: string) => void;
  onNewApp: (id: string) => void;
}

const TYPE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  CORPORATE: { label: 'Corporate', bg: '#3b82f620', text: '#2563eb' },
  INDIVIDUAL: { label: 'Individual', bg: '#a855f720', text: '#7e22ce' },
  SOLE_PROPRIETOR: { label: 'Sole Prop.', bg: '#f59e0b20', text: '#d97706' },
};

const RATING_BAR: Record<string, { color: string; pct: number }> = {
  AAA: { color: '#16a34a', pct: 100 },
  AA:  { color: '#16a34a', pct: 90 },
  A:   { color: '#16a34a', pct: 80 },
  BBB: { color: '#0051d5', pct: 65 },
  BB:  { color: '#0051d5', pct: 55 },
  B:   { color: '#d97706', pct: 40 },
  CCC: { color: '#d97706', pct: 30 },
  CC:  { color: '#ba1a1a', pct: 20 },
  C:   { color: '#ba1a1a', pct: 15 },
  D:   { color: '#ba1a1a', pct: 5 },
};

const formatCurrency = (val: string | number | null | undefined) => {
  if (val == null) return '—';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(num);
};

const displayName = (p: BorrowerProfileRow) => {
  if (p.account) return p.account.name;
  if (p.contact) return `${p.contact.firstName} ${p.contact.lastName}`.trim();
  if (p.name) return p.name;
  return 'Unnamed Borrower';
};

const BorrowerQuickPreview: React.FC<BorrowerQuickPreviewProps> = ({ borrower, onClose, onOpen360, onNewApp }) => {
  const name = displayName(borrower);
  const typeBadge = TYPE_BADGE[borrower.borrowerType] || TYPE_BADGE.CORPORATE;
  const ratingInfo = borrower.creditRiskRating ? RATING_BAR[borrower.creditRiskRating] : null;

  // Utilization: totalExposure / exposureLimit
  const totalExp = typeof borrower.totalExposure === 'string' ? parseFloat(borrower.totalExposure) : borrower.totalExposure;
  const expLimit = typeof borrower.exposureLimit === 'string' ? parseFloat(borrower.exposureLimit) : borrower.exposureLimit;
  const utilizationPct = totalExp && expLimit ? Math.min(Math.round((totalExp / expLimit) * 100), 100) : null;

  // KYC Status derived from amlRiskTier
  const kycStatus = borrower.amlRiskTier === 'HIGH' ? 'Pending Review' : borrower.amlRiskTier ? 'Valid' : '—';

  const industry = (borrower.account as any)?.industry || null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
    }}>
      {/* ── Close button ── */}
      <div style={{
        display: 'flex', justifyContent: 'flex-end', padding: '8px 8px 0',
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--cr-on-surface-variant, #45464d)',
            padding: '4px', borderRadius: 'var(--cr-radius, 0.25rem)',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--cr-surface-container-low, #f2f4f6)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
        </button>
      </div>

      {/* ── Header ── */}
      <div style={{ padding: '0 20px 16px' }}>
        {/* Badges row */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <span style={{
            padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600,
            backgroundColor: typeBadge.bg, color: typeBadge.text,
          }}>{typeBadge.label}</span>
          <span style={{
            padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600,
            backgroundColor: borrower.isActive ? '#22c55e20' : '#6b728020',
            color: borrower.isActive ? '#16a34a' : '#6b7280',
          }}>{borrower.isActive ? 'Active' : 'Inactive'}</span>
          {borrower.isSanctionedEntity && (
            <span style={{
              padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600,
              backgroundColor: 'var(--cr-error-container, #ffdad6)', color: 'var(--cr-error, #ba1a1a)',
            }}>Watchlist</span>
          )}
        </div>

        {/* Name */}
        <h3 style={{
          fontSize: 'var(--cr-text-headline-md, 20px)',
          lineHeight: 'var(--cr-leading-headline-md, 28px)',
          fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
          fontWeight: 700,
          color: 'var(--cr-on-surface, #191c1e)',
          margin: 0,
        }}>{name}</h3>

        {/* CIF + Industry */}
        <div style={{
          fontSize: 'var(--cr-text-body-sm, 13px)',
          color: 'var(--cr-on-surface-variant, #45464d)',
          marginTop: '4px',
        }}>
          <span style={{ fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)' }}>
            CIF-{borrower.id.slice(0, 8).toUpperCase()}
          </span>
          {industry && (
            <span style={{ marginLeft: '8px' }}>· {industry}</span>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button
            onClick={() => onOpen360(borrower.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px',
              backgroundColor: 'var(--cr-secondary, #0051d5)',
              color: 'var(--cr-on-secondary, #ffffff)',
              border: 'none', borderRadius: 'var(--cr-radius, 0.25rem)',
              fontSize: 'var(--cr-text-label-md, 12px)',
              fontWeight: 600,
              fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
              cursor: 'pointer',
              letterSpacing: 'var(--cr-tracking-label, 0.05em)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
            Open 360 View
          </button>
          <button
            onClick={() => onNewApp(borrower.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px',
              backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
              color: 'var(--cr-on-surface, #191c1e)',
              border: '1px solid var(--cr-outline-variant, #c6c6cd)',
              borderRadius: 'var(--cr-radius, 0.25rem)',
              fontSize: 'var(--cr-text-label-md, 12px)',
              fontWeight: 600,
              fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
              cursor: 'pointer',
              letterSpacing: 'var(--cr-tracking-label, 0.05em)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>note_add</span>
            New Application
          </button>
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ height: '1px', backgroundColor: 'var(--cr-outline-variant, #c6c6cd)', margin: '0 20px' }} />

      {/* ── Exposure Section ── */}
      <div style={{ padding: '16px 20px' }}>
        <div style={{
          fontSize: 'var(--cr-text-label-md, 12px)',
          fontWeight: 600,
          letterSpacing: 'var(--cr-tracking-label, 0.05em)',
          color: 'var(--cr-on-surface-variant, #45464d)',
          marginBottom: '8px',
          display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>account_balance</span>
          Total Exposure
        </div>
        <div style={{
          fontSize: 'var(--cr-text-headline-md, 20px)',
          fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
          fontWeight: 700,
          color: 'var(--cr-on-surface, #191c1e)',
        }}>
          {formatCurrency(borrower.totalExposure)}
        </div>

        {/* Utilization bar */}
        {utilizationPct !== null && (
          <div style={{ marginTop: '8px' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 'var(--cr-text-label-md, 12px)',
              color: 'var(--cr-on-surface-variant, #45464d)',
              marginBottom: '4px',
            }}>
              <span>Utilized: {utilizationPct}%</span>
              <span>Limit: {formatCurrency(borrower.exposureLimit)}</span>
            </div>
            <div style={{
              width: '100%', height: '6px',
              backgroundColor: 'var(--cr-surface-container-high, #e6e8ea)',
              borderRadius: '9999px', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${utilizationPct}%`,
                backgroundColor: utilizationPct > 85 ? '#ba1a1a' : utilizationPct > 60 ? '#d97706' : '#16a34a',
                borderRadius: '9999px',
                transition: 'width 0.3s',
              }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Divider ── */}
      <div style={{ height: '1px', backgroundColor: 'var(--cr-outline-variant, #c6c6cd)', margin: '0 20px' }} />

      {/* ── Info Cards Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '16px 20px' }}>
        {/* Risk Rating */}
        <div style={{
          backgroundColor: 'var(--cr-surface-container-low, #f2f4f6)',
          borderRadius: 'var(--cr-radius-md, 0.375rem)',
          padding: '12px',
        }}>
          <div style={{
            fontSize: 'var(--cr-text-label-md, 12px)',
            fontWeight: 600,
            letterSpacing: 'var(--cr-tracking-label, 0.05em)',
            color: 'var(--cr-on-surface-variant, #45464d)',
            marginBottom: '4px',
          }}>Risk Rating</div>
          {borrower.creditRiskRating && ratingInfo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '40px', height: '5px',
                backgroundColor: 'var(--cr-surface-container-high, #e6e8ea)',
                borderRadius: '9999px', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', width: `${ratingInfo.pct}%`,
                  backgroundColor: ratingInfo.color, borderRadius: '9999px',
                }} />
              </div>
              <span style={{ fontSize: 'var(--cr-text-body-md, 14px)', fontWeight: 600, color: ratingInfo.color }}>
                {borrower.creditRiskRating}
              </span>
            </div>
          ) : (
            <span style={{ color: 'var(--cr-outline, #76777d)' }}>—</span>
          )}
        </div>

        {/* KYC Status */}
        <div style={{
          backgroundColor: 'var(--cr-surface-container-low, #f2f4f6)',
          borderRadius: 'var(--cr-radius-md, 0.375rem)',
          padding: '12px',
        }}>
          <div style={{
            fontSize: 'var(--cr-text-label-md, 12px)',
            fontWeight: 600,
            letterSpacing: 'var(--cr-tracking-label, 0.05em)',
            color: 'var(--cr-on-surface-variant, #45464d)',
            marginBottom: '4px',
          }}>KYC Status</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {kycStatus === 'Valid' ? (
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#16a34a' }}>check_circle</span>
            ) : kycStatus === 'Pending Review' ? (
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#d97706' }}>pending</span>
            ) : null}
            <span style={{
              fontSize: 'var(--cr-text-body-md, 14px)', fontWeight: 600,
              color: kycStatus === 'Valid' ? '#16a34a' : kycStatus === 'Pending Review' ? '#d97706' : 'var(--cr-on-surface-variant, #45464d)',
            }}>{kycStatus}</span>
          </div>
        </div>
      </div>

      {/* ── AML Tier ── */}
      {borrower.amlRiskTier && (
        <div style={{ padding: '0 20px 12px' }}>
          <div style={{
            backgroundColor: 'var(--cr-surface-container-low, #f2f4f6)',
            borderRadius: 'var(--cr-radius-md, 0.375rem)',
            padding: '12px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{
              fontSize: 'var(--cr-text-label-md, 12px)',
              fontWeight: 600,
              letterSpacing: 'var(--cr-tracking-label, 0.05em)',
              color: 'var(--cr-on-surface-variant, #45464d)',
            }}>AML Risk Tier</span>
            <span style={{
              padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600,
              backgroundColor: borrower.amlRiskTier === 'HIGH' ? '#ef444420' : borrower.amlRiskTier === 'MEDIUM' ? '#f59e0b20' : '#22c55e20',
              color: borrower.amlRiskTier === 'HIGH' ? '#dc2626' : borrower.amlRiskTier === 'MEDIUM' ? '#d97706' : '#16a34a',
            }}>{borrower.amlRiskTier}</span>
          </div>
        </div>
      )}

      {/* ── Spacer ── */}
      <div style={{ flex: 1 }} />

      {/* ── Footer ── */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid var(--cr-outline-variant, #c6c6cd)',
        fontSize: 'var(--cr-text-label-md, 12px)',
        color: 'var(--cr-on-surface-variant, #45464d)',
        textAlign: 'center',
      }}>
        Created {new Date(borrower.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </div>
    </div>
  );
};

export default BorrowerQuickPreview;