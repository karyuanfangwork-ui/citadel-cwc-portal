import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import creditService, { BorrowerProfile, trendApi, RatioCategory, TrendItem, TrendDataPoint } from '../src/services/credit.service';
import { getBorrowerDisplayName } from '../src/components/credit/BorrowerSummaryCard';

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

const directionDisplay = (dir: string) => {
  if (dir === 'improving') return { icon: 'arrow_upward', color: 'text-green-600', label: 'UP' };
  if (dir === 'declining') return { icon: 'arrow_downward', color: 'text-red-600', label: 'DOWN' };
  return { icon: 'arrow_forward', color: 'text-gray-400', label: 'STABLE' };
};

const formatValue = (val: number) => {
  if (Math.abs(val) >= 100) return val.toLocaleString('en-MY', { maximumFractionDigits: 0 });
  return val.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatPeriod = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.getFullYear().toString();
  } catch {
    return iso;
  }
};

const FinancialAnalysis: React.FC = () => {
  const [borrowers, setBorrowers] = useState<BorrowerProfile[]>([]);
  const [selectedBorrowerId, setSelectedBorrowerId] = useState('');
  const [trends, setTrends] = useState<TrendItem[]>([]);
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

  const fetchTrends = useCallback(async () => {
    if (!selectedBorrowerId) return;
    try {
      setLoading(true);
      const data = await trendApi.getTrends(selectedBorrowerId);
      // API returns { borrowerProfileId, statements, trends: TrendItem[] }
      const trendsArr: TrendItem[] = (data as any).trends ?? [];
      setTrends(trendsArr);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [selectedBorrowerId]);

  useEffect(() => { fetchTrends(); }, [fetchTrends]);

  const toggleCategory = (cat: RatioCategory) => {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const trendsByCategory = CATEGORY_ORDER.map(cat => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    icon: CATEGORY_ICONS[cat],
    trends: trends.filter(t => t.category === cat),
  }));

  return (
    <>
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
                <option key={b.id} value={b.id}>{getBorrowerDisplayName(b)}</option>
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
        ) : trends.length === 0 ? (
          <div className="bg-bg-surface border border-border rounded-xl p-12 text-center text-text-secondary">
            <span className="material-symbols-outlined text-5xl block mb-3 opacity-30">functions</span>
            <p className="font-semibold">No ratios available</p>
            <p className="text-sm mt-1">Financial statements and ratio computations are needed first</p>
          </div>
        ) : (
          <div className="space-y-4">
            {trendsByCategory.filter(group => group.trends.length > 0).map(group => (
              <div key={group.category} className="bg-bg-surface border border-border rounded-xl overflow-hidden">
                {/* Category Header */}
                <button onClick={() => toggleCategory(group.category)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-brand-700">{group.icon}</span>
                    <span className="text-sm font-bold text-text-primary uppercase tracking-wider">{group.label}</span>
                    <span className="text-xs text-text-secondary bg-bg-subtle px-2 py-0.5 rounded-full">{group.trends.length}</span>
                  </div>
                  <span className={`material-symbols-outlined text-text-secondary transition-transform ${collapsed[group.category] ? '' : 'rotate-180'}`}>
                    expand_more
                  </span>
                </button>

                {/* Trend Rows */}
                {!collapsed[group.category] && (
                  <div className="border-t border-border">
                    {group.trends.map(trend => {
                      const dir = directionDisplay(trend.direction);
                      const latest = trend.dataPoints[trend.dataPoints.length - 1];
                      const previous = trend.dataPoints.length >= 2 ? trend.dataPoints[trend.dataPoints.length - 2] : null;
                      const change = previous != null && latest ? latest.value - previous.value : null;

                      return (
                        <div key={trend.ratioKey} className="border-b border-border last:border-b-0">
                          {/* Ratio summary row */}
                          <div className="flex items-center justify-between px-5 py-3">
                            <div>
                              <span className="text-sm font-medium text-text-primary">{trend.ratioLabel}</span>
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="text-right">
                                <span className="text-xs text-text-secondary block">Current</span>
                                <span className="text-sm font-bold text-text-primary">{latest ? formatValue(latest.value) : '—'}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-xs text-text-secondary block">Trend</span>
                                <span className={`flex items-center gap-1 text-sm font-bold ${dir.color}`}>
                                  <span className="material-symbols-outlined text-base">{dir.icon}</span>
                                  {dir.label}
                                </span>
                              </div>
                              {previous != null && (
                                <div className="text-right">
                                  <span className="text-xs text-text-secondary block">Previous</span>
                                  <span className="text-sm text-text-secondary">{formatValue(previous.value)}</span>
                                </div>
                              )}
                              {change != null && (
                                <div className="text-right">
                                  <span className="text-xs text-text-secondary block">Change</span>
                                  <span className={`text-sm font-semibold ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                    {change > 0 ? '+' : ''}{formatValue(change)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Mini sparkline / period detail */}
                          {trend.dataPoints.length > 1 && (
                            <div className="px-5 pb-3">
                              <div className="flex items-end gap-3">
                                {trend.dataPoints.map((dp, i) => {
                                  const maxVal = Math.max(...trend.dataPoints.map(d => Math.abs(d.value)));
                                  const barH = maxVal > 0 ? (Math.abs(dp.value) / maxVal) * 48 : 0;
                                  return (
                                    <div key={dp.statementId + i} className="flex flex-col items-center gap-1">
                                      <span className="text-xs font-medium text-text-primary">{formatValue(dp.value)}</span>
                                      <div
                                        className="w-8 rounded-sm"
                                        style={{
                                          height: Math.max(barH, 4),
                                          background: i === trend.dataPoints.length - 1
                                            ? 'var(--color-brand-700)'
                                            : 'var(--color-brand-200)',
                                        }}
                                      />
                                      <span className="text-xs text-text-secondary">{formatPeriod(dp.fiscalYearEnd)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
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