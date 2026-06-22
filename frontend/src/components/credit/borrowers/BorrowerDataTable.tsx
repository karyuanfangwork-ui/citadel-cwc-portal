import React from 'react';

type BorrowerType = 'CORPORATE' | 'INDIVIDUAL' | 'SOLE_PROPRIETOR';
type RiskRating = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'CC' | 'C' | 'D' | 'NR';

export interface BorrowerProfileRow {
  id: string;
  borrowerType: BorrowerType;
  name?: string | null;
  creditRiskRating: RiskRating | null;
  amlRiskTier: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  exposureLimit: string | number | null;
  totalExposure: string | number | null;
  isActive: boolean;
  isSanctionedEntity: boolean;
  createdAt: string;
  account?: { id: string; name: string; industry?: string | null } | null;
  contact?: { id: string; firstName: string; lastName: string } | null;
}

interface BorrowerDataTableProps {
  profiles: BorrowerProfileRow[];
  loading: boolean;
  onRowClick: (id: string) => void;
  onNameClick: (id: string) => void;
  onActionClick: (id: string, action: string) => void;
}

// ── Helpers ──

const displayName = (p: BorrowerProfileRow) => p.name || 'Unnamed Borrower';

const formatCurrency = (val: string | number | null | undefined) => {
  if (val == null) return '—';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(num);
};

const TYPE_BADGE: Record<BorrowerType, { label: string; bg: string; text: string }> = {
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

const PSEUDO_CIF = (id: string) => `CIF-${id.slice(0, 8).toUpperCase()}`;

// ── Component ──

const BorrowerDataTable: React.FC<BorrowerDataTableProps> = ({ profiles, loading, onRowClick, onNameClick, onActionClick }) => {
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);

  if (loading) {
    return (
      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--cr-surface-container-low, #f2f4f6)' }}>
              {['Borrower Name', 'CIF Number', 'Type', 'Risk Rating', 'Exposure', 'Status', 'Actions'].map(h => (
                <th key={h} style={{
                  padding: '12px 16px', textAlign: 'left',
                  fontSize: 'var(--cr-text-label-md, 12px)', fontWeight: 600,
                  fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
                  color: 'var(--cr-on-surface-variant, #45464d)',
                  letterSpacing: 'var(--cr-tracking-label, 0.05em)',
                  borderBottom: '1px solid var(--cr-outline-variant, #c6c6cd)',
                  borderTop: '1px solid var(--cr-outline-variant, #c6c6cd)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4].map(i => (
              <tr key={i}>
                {[180, 100, 80, 100, 100, 70, 40].map((w, j) => (
                  <td key={j} style={{ padding: '12px 16px' }}>
                    <div style={{ height: 12, width: w, background: 'var(--cr-surface-container-high, #e6e8ea)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--cr-outline, #76777d)', display: 'block', marginBottom: '12px' }}>person</span>
        <p style={{ fontWeight: 600, color: 'var(--cr-on-surface, #191c1e)', fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)' }}>No borrower profiles yet</p>
        <p style={{ fontSize: 'var(--cr-text-body-md, 14px)', color: 'var(--cr-on-surface-variant, #45464d)' }}>Create your first borrower profile to start credit processing</p>
      </div>
    );
  }

  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--cr-surface-container-low, #f2f4f6)' }}>
            <th style={{
              padding: '12px 16px', textAlign: 'left', width: '250px',
              fontSize: 'var(--cr-text-label-md, 12px)', fontWeight: 600,
              fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
              color: 'var(--cr-on-surface-variant, #45464d)',
              letterSpacing: 'var(--cr-tracking-label, 0.05em)',
              borderBottom: '1px solid var(--cr-outline-variant, #c6c6cd)',
              borderTop: '1px solid var(--cr-outline-variant, #c6c6cd)',
            }}>Borrower Name</th>
            {['CIF Number', 'Type', 'Risk Rating', 'Exposure', 'Status', 'Actions'].map(h => (
              <th key={h} style={{
                padding: '12px 16px', textAlign: h === 'Exposure' ? 'right' : 'left',
                fontSize: 'var(--cr-text-label-md, 12px)', fontWeight: 600,
                fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
                color: 'var(--cr-on-surface-variant, #45464d)',
                letterSpacing: 'var(--cr-tracking-label, 0.05em)',
                borderBottom: '1px solid var(--cr-outline-variant, #c6c6cd)',
                borderTop: '1px solid var(--cr-outline-variant, #c6c6cd)',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody style={{
          fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
          fontSize: 'var(--cr-text-body-sm, 13px)',
          color: 'var(--cr-on-surface, #191c1e)',
        }}>
          {profiles.map(p => {
            const name = displayName(p);
            const typeBadge = TYPE_BADGE[p.borrowerType] || TYPE_BADGE.CORPORATE;
            const ratingInfo = p.creditRiskRating ? RATING_BAR[p.creditRiskRating] : null;
            const industry = p.account?.industry || null;

            return (
              <tr
                key={p.id}
                onClick={() => onRowClick(p.id)}
                style={{
                  cursor: 'pointer',
                  transition: 'background-color 0.12s',
                  borderBottom: '1px solid var(--cr-outline-variant, #c6c6cd)',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--cr-surface-container-low, #f2f4f6)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {/* Borrower Name */}
                <td style={{ padding: '12px 16px' }}>
                  <div>
                    <button
                      onClick={e => { e.stopPropagation(); onNameClick(p.id); }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        fontWeight: 600, color: 'var(--cr-secondary, #0051d5)',
                        fontSize: 'var(--cr-text-body-sm, 13px)',
                        fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
                      }}
                    >{name}</button>
                    {industry && (
                      <div style={{ fontSize: '11px', color: 'var(--cr-on-surface-variant, #45464d)', marginTop: '2px' }}>{industry}</div>
                    )}
                  </div>
                </td>

                {/* CIF Number */}
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
                    fontSize: 'var(--cr-text-body-sm, 13px)',
                    color: 'var(--cr-on-surface-variant, #45464d)',
                    letterSpacing: '0.02em',
                  }}>{PSEUDO_CIF(p.id)}</span>
                </td>

                {/* Type */}
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: typeBadge.bg,
                    color: typeBadge.text,
                  }}>{typeBadge.label}</span>
                </td>

                {/* Risk Rating */}
                <td style={{ padding: '12px 16px' }}>
                  {p.creditRiskRating ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '64px', height: '6px',
                        backgroundColor: 'var(--cr-surface-container-high, #e6e8ea)',
                        borderRadius: '9999px', overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${ratingInfo?.pct ?? 50}%`,
                          backgroundColor: ratingInfo?.color ?? 'var(--cr-outline, #76777d)',
                          borderRadius: '9999px',
                          transition: 'width 0.3s',
                        }} />
                      </div>
                      <span style={{
                        fontSize: 'var(--cr-text-label-md, 12px)',
                        fontWeight: 600,
                        color: ratingInfo?.color ?? 'var(--cr-on-surface-variant, #45464d)',
                      }}>{p.creditRiskRating}</span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--cr-outline, #76777d)' }}>—</span>
                  )}
                </td>

                {/* Exposure (right-aligned) */}
                <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  <div style={{ fontWeight: 600 }}>{formatCurrency(p.totalExposure)}</div>
                  {p.exposureLimit && (
                    <div style={{ fontSize: '11px', color: 'var(--cr-on-surface-variant, #45464d)' }}>
                      Limit: {formatCurrency(p.exposureLimit)}
                    </div>
                  )}
                </td>

                {/* Status */}
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: p.isActive ? '#22c55e20' : '#6b728020',
                    color: p.isActive ? '#16a34a' : '#6b7280',
                  }}>{p.isActive ? 'Active' : 'Inactive'}</span>
                </td>

                {/* Actions (kebab) */}
                <td style={{ padding: '12px 16px', position: 'relative' }}>
                  <button
                    onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === p.id ? null : p.id); }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                      borderRadius: 'var(--cr-radius, 0.25rem)',
                      color: 'var(--cr-on-surface-variant, #45464d)',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>more_vert</span>
                  </button>
                  {openMenuId === p.id && (
                    <div style={{
                      position: 'absolute', right: '16px', top: '100%', zIndex: 40,
                      backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
                      border: '1px solid var(--cr-outline-variant, #c6c6cd)',
                      borderRadius: 'var(--cr-radius-lg, 0.5rem)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                      minWidth: '160px',
                    }}>
                      {[
                        { action: 'view', label: 'Open 360 View', icon: 'visibility' },
                        { action: 'newApp', label: 'New Application', icon: 'note_add' },
                        { action: 'edit', label: 'Edit Borrower', icon: 'edit' },
                      ].map(item => (
                        <button
                          key={item.action}
                          onClick={e => { e.stopPropagation(); setOpenMenuId(null); onActionClick(p.id, item.action); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                            padding: '10px 14px',
                            fontSize: 'var(--cr-text-body-md, 14px)',
                            fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
                            color: 'var(--cr-on-surface, #191c1e)',
                            background: 'none', border: 'none', cursor: 'pointer',
                            textAlign: 'left',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--cr-surface-container-low, #f2f4f6)'; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--cr-on-surface-variant, #45464d)' }}>{item.icon}</span>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default BorrowerDataTable;