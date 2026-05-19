import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import creditService, { BorrowerProfile, trendApi, FinancialRatio, RatioCategory } from '../src/services/credit.service';
import CreditNav from '../src/components/CreditNav';

const CATEGORY_ORDER: RatioCategory[] = ['PROFITABILITY', 'LEVERAGE', 'LIQUIDITY', 'COVERAGE', 'ACTIVITY'];
const CATEGORY_LABELS: Record<RatioCategory, string> = {
  PROFITABILITY: 'Profitability',
  LEVERAGE: 'Leverage',
  LIQUIDITY: 'Liquidity',
  COVERAGE: 'Coverage',
  ACTIVITY: 'Activity',
};
const CATEGORY_ICONS: Record<RatioCategory, string> = {
  PROFITABILITY: 'trending_up',
  LEVERAGE: 'balance',
  LIQUIDITY: 'water_drop',
  COVERAGE: 'shield',
  ACTIVITY: 'speed',
};

const trendIcon = (trend: string | null) => {
  if (trend === 'UP') return { icon: 'arrow_upward', color: 'text-green-600' };
  if (trend === 'DOWN') return { icon: 'arrow_downward', color: 'text-red-600' };
  return { icon: 'arrow_forward', color: 'text-gray-400' };
};

const formatValue = (val: number) => {
  if (Math.abs(val) >= 100) return val.toLocaleString('en-MY', { maximumFractionDigits: 0 });
  return val.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const FinancialAnalysis: React.FC = () => {
  const [borrowers, setBorrowers] = useState<BorrowerProfile[]>([]);
  const [selectedBorrowerId, setSelectedBorrowerId] = useState('');
  const [ratios, setRatios] = useState<FinancialRatio[]>([]);
  const [periods, setPeriods] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<RatioCategory, boolean>>({
    PROFITABILITY: false,
    LEVERAGE: false,
    LIQUIDITY: false,
    COVERAGE: false,
    ACTIVITY: false,
  });

  const fetchBorrowers = useCallback(async () => {
    try {
      const data = await creditService.listBorrowerProfiles({ limit: 100 });
      setBorrowers(data.profiles);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchBorrowers(); }, [fetchBorrowers]);

  const fetchRatios = useCallback(async () => {
    if (!selectedBorrowerId) return;
    try {
      setLoading(true);
      const data = await trendApi.getTrends(selectedBorrowerId);
      setRatios(data.ratios);
      setPeriods(data.periods);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [selectedBorrowerId]);

  useEffect(() => { fetchRatios(); }, [fetchRatios]);

  const toggleCategory = (cat: RatioCategory) => {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const ratiosByCategory = CATEGORY_ORDER.map(cat => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    icon: CATEGORY_ICONS[cat],
    ratios: ratios.filter(r => r.category === cat),
  }));

  return (
    <>
      <CreditNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: '2rem' }} className="px-4 sm:px-8 py-4 sm:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-4">
          <Link to="/credit" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">Credit</Link>
          <span>/</span>
          <span className="font-semibold text-text-primary">Financial Analysis</span>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black text-text-primary">Ratio & Trend Analysis</h1>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-text-secondary text-base">person</span>
            <select value={selectedBorrowerId} onChange={e => setSelectedBorrowerId(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }}>
              <option value="">Select borrower...</option>
              {borrowers.map(b => (
                <option key={b.id} value={b.id}>{b.account?.name || (b.contact ? `${b.contact.firstName} ${b.contact.lastName}` : 'Unnamed Borrower')}</option>
              ))}
            </select>
          </div>
        </div>

        {!selectedBorrowerId ? (
          <div className="bg-bg-surface border border-border rounded-xl p-12 text-center text-text-secondary">
            <span className="material-symbols-outlined text-5xl block mb-3 opacity-30">analytics</span>
            <p className="font-semibold">Select a borrower to view ratios</p>
          </div>
        ) : loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ height: 80, borderRadius: 12, background: 'var(--bg-subtle)', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : ratios.length === 0 ? (
          <div className="bg-bg-surface border border-border rounded-xl p-12 text-center text-text-secondary">
            <span className="material-symbols-outlined text-5xl block mb-3 opacity-30">functions</span>
            <p className="font-semibold">No ratios available</p>
            <p className="text-sm mt-1">Financial statements and ratio computations are needed first</p>
          </div>
        ) : (
          <div className="space-y-4">
            {ratiosByCategory.filter(group => group.ratios.length > 0).map(group => (
              <div key={group.category} className="bg-bg-surface border border-border rounded-xl overflow-hidden">
                {/* Category Header */}
                <button onClick={() => toggleCategory(group.category)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-brand-700">{group.icon}</span>
                    <span className="text-sm font-bold text-text-primary uppercase tracking-wider">{group.label}</span>
                    <span className="text-xs text-text-secondary bg-bg-subtle px-2 py-0.5 rounded-full">{group.ratios.length}</span>
                  </div>
                  <span className={`material-symbols-outlined text-text-secondary transition-transform ${collapsed[group.category] ? '' : 'rotate-180'}`}>
                    expand_more
                  </span>
                </button>

                {/* Ratio Rows */}
                {!collapsed[group.category] && (
                  <div className="border-t border-border">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-surface-muted)' }}>
                          {['Ratio', 'Current', 'Trend', 'Previous', 'Change'].map(h => (
                            <th key={h} style={{ padding: 'var(--space-2) var(--space-4)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.ratios.map(ratio => {
                          const t = trendIcon(ratio.trend);
                          const prevValue = ratio.previousValue;
                          const change = prevValue != null ? ratio.value - prevValue : null;
                          return (
                            <tr key={ratio.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                              <td style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                                {ratio.ratioLabel}
                              </td>
                              <td style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                                {formatValue(ratio.value)}
                              </td>
                              <td style={{ padding: 'var(--space-2) var(--space-4)' }}>
                                <span className={`flex items-center gap-1 text-sm font-bold ${t.color}`}>
                                  <span className="material-symbols-outlined text-base">{t.icon}</span>
                                  {ratio.trend || 'N/A'}
                                </span>
                              </td>
                              <td style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                                {prevValue != null ? formatValue(prevValue) : '—'}
                              </td>
                              <td style={{ padding: 'var(--space-2) var(--space-4)' }}>
                                {change != null ? (
                                  <span className={`text-sm font-semibold ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                    {change > 0 ? '+' : ''}{formatValue(change)}
                                  </span>
                                ) : (
                                  <span className="text-text-secondary text-sm">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default FinancialAnalysis;