import React, { useState, useEffect, useCallback } from 'react';
import crmService from '../src/services/crm.service';
import CrmNav from '../src/components/CrmNav';

const CrmQuotaDashboard = () => {
  const now = new Date();
  const currentQuarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
  const defaultPeriod = `${now.getFullYear()}-${currentQuarter}`;

  const [period, setPeriod] = useState(defaultPeriod);
  const [dashboard, setDashboard] = useState<any>(null);
  const [quotas, setQuotas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [dashData, quotasData] = await Promise.all([
        crmService.getQuotaDashboard(period),
        crmService.listQuotas({ period }),
      ]);
      setDashboard(dashData);
      setQuotas(quotasData.quotas);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load quota data');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmt = (val: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val);
  const pct = (val: number) => `${val.toFixed(1)}%`;

  const cardStyle: React.CSSProperties = { background: 'var(--color-surface, #fff)', borderRadius: 'var(--radius-lg, 12px)', border: '1px solid var(--color-border, #e5e7eb)', padding: '24px', marginBottom: '16px' };
  const btnStyle = (variant: 'primary' | 'secondary' = 'primary'): React.CSSProperties => ({
    padding: '8px 16px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
    background: variant === 'primary' ? 'var(--color-primary, #4f46e5)' : '#f3f4f6',
    color: variant === 'primary' ? '#fff' : '#374151',
  });
  const inputStyle: React.CSSProperties = { padding: '8px 12px', border: '1px solid var(--color-border, #d1d5db)', borderRadius: '8px', fontSize: '14px' };

  const attainmentColor = (pct: number) => pct >= 100 ? '#059669' : pct >= 50 ? '#d97706' : '#ef4444';

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <CrmNav />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text, #111827)' }}>Quota Dashboard</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 14, fontWeight: 500 }}>Period:</label>
          <input style={inputStyle} value={period} onChange={e => setPeriod(e.target.value)} placeholder="2026-Q1" />
        </div>
      </div>

      {error && <div style={{ ...cardStyle, background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b' }}>{error}</div>}

      {loading ? <div style={cardStyle}><p>Loading...</p></div> : (
        <>
          {/* Summary Cards */}
          {dashboard && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ ...cardStyle, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>Total Target</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{fmt(dashboard.totalTarget)}</div>
              </div>
              <div style={{ ...cardStyle, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>Closed Won</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#059669' }}>{fmt(dashboard.totalClosedWon)}</div>
              </div>
              <div style={{ ...cardStyle, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>Attainment</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: attainmentColor(dashboard.totalAttainmentPct) }}>
                  {pct(dashboard.totalAttainmentPct)}
                </div>
              </div>
            </div>
          )}

          {/* Per-Rep Attainment */}
          {dashboard?.byRep?.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Per-Rep Attainment</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead><tr style={{ borderBottom: '2px solid var(--color-border, #e5e7eb)' }}>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Rep</th>
                  <th style={{ textAlign: 'right', padding: '8px' }}>Target</th>
                  <th style={{ textAlign: 'right', padding: '8px' }}>Closed Won</th>
                  <th style={{ textAlign: 'right', padding: '8px' }}>Attainment</th>
                  <th style={{ padding: '8px', minWidth: 200 }}>Progress</th>
                </tr></thead>
                <tbody>
                  {dashboard.byRep.map((rep: any) => (
                    <tr key={rep.userId} style={{ borderBottom: '1px solid var(--color-border, #e5e7eb)' }}>
                      <td style={{ padding: '8px' }}>{rep.name}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{fmt(rep.target)}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{fmt(rep.closedWon)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: attainmentColor(rep.attainmentPct), fontWeight: 600 }}>{pct(rep.attainmentPct)}</td>
                      <td style={{ padding: '8px' }}>
                        <div style={{ background: '#e5e7eb', borderRadius: 4, height: 8, width: '100%' }}>
                          <div style={{ background: attainmentColor(rep.attainmentPct), borderRadius: 4, height: 8, width: `${Math.min(rep.attainmentPct, 100)}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Per-Territory Attainment */}
          {dashboard?.byTerritory?.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Per-Territory Attainment</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead><tr style={{ borderBottom: '2px solid var(--color-border, #e5e7eb)' }}>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Territory</th>
                  <th style={{ textAlign: 'right', padding: '8px' }}>Target</th>
                  <th style={{ textAlign: 'right', padding: '8px' }}>Closed Won</th>
                  <th style={{ textAlign: 'right', padding: '8px' }}>Attainment</th>
                </tr></thead>
                <tbody>
                  {dashboard.byTerritory.map((t: any) => (
                    <tr key={t.territoryId} style={{ borderBottom: '1px solid var(--color-border, #e5e7eb)' }}>
                      <td style={{ padding: '8px' }}>{t.name}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{fmt(t.target)}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{fmt(t.closedWon)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: attainmentColor(t.attainmentPct), fontWeight: 600 }}>{pct(t.attainmentPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Quota List */}
          {quotas.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Quota Details</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead><tr style={{ borderBottom: '2px solid var(--color-border, #e5e7eb)' }}>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Period</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Territory</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>User</th>
                  <th style={{ textAlign: 'right', padding: '8px' }}>Target</th>
                </tr></thead>
                <tbody>
                  {quotas.map((q: any) => (
                    <tr key={q.id} style={{ borderBottom: '1px solid var(--color-border, #e5e7eb)' }}>
                      <td style={{ padding: '8px' }}>{q.period}</td>
                      <td style={{ padding: '8px' }}>{q.periodType}</td>
                      <td style={{ padding: '8px' }}>{q.territory?.name || '—'}</td>
                      <td style={{ padding: '8px' }}>{q.user ? `${q.user.firstName} ${q.user.lastName}` : '—'}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{fmt(Number(q.targetAmount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CrmQuotaDashboard;