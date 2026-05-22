import React, { useState, useEffect, useCallback } from 'react';
import { reportsApi, PipelineReport, ExposureReport } from '../../src/services/credit.service';
import CreditNav from '../../src/components/CreditNav';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../src/utils/errorMessages';
import RiskBadge from '../../src/components/ui/RiskBadge';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatCurrency = (val: number | null) =>
  val != null
    ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val)
    : '—';

const STATE_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  KYC_REVIEW: 'KYC Review',
  KYC_APPROVED: 'KYC Approved',
  KYC_REJECTED: 'KYC Rejected',
  UNDERWRITING: 'Underwriting',
  CREDIT_ASSESSMENT: 'Credit Assessment',
  COMMITTEE_REVIEW: 'Committee Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  OFFER: 'Offer',
  ACCEPTED: 'Accepted',
  DISBURSED: 'Disbursed',
  ACTIVE: 'Active',
  CLOSED: 'Closed',
  WITHDRAWN: 'Withdrawn',
};

// ---------------------------------------------------------------------------
// Pipeline Report Table
// ---------------------------------------------------------------------------

const PipelineReportView: React.FC<{ data: PipelineReport }> = ({ data }) => (
  <div className="space-y-4">
    {/* Summary Cards */}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">Total Applications</div>
        <div className="text-2xl font-black text-blue-900 mt-1">{data.totalApplications}</div>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="text-xs font-bold text-amber-600 uppercase tracking-wider">SLA Breaches</div>
        <div className="text-2xl font-black text-amber-900 mt-1">{data.slaBreachCount}</div>
      </div>
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="text-xs font-bold text-green-600 uppercase tracking-wider">Active States</div>
        <div className="text-2xl font-black text-green-900 mt-1">{data.states.filter(s => s.count > 0).length}</div>
      </div>
    </div>

    {/* Pipeline Table */}
    <div className="border border-border rounded-xl overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
          <tr>
            <th className="p-3 text-left">State</th>
            <th className="p-3 text-right">Count</th>
            <th className="p-3 text-right">Avg Days</th>
            <th className="p-3 text-left" style={{ width: '40%' }}>Distribution</th>
          </tr>
        </thead>
        <tbody>
          {data.states.map(s => {
            const pct = data.totalApplications > 0 ? (s.count / data.totalApplications) * 100 : 0;
            return (
              <tr key={s.state} className="border-t hover:bg-gray-50 transition-colors">
                <td className="p-3 font-semibold">{STATE_LABELS[s.state] || s.state}</td>
                <td className="p-3 text-right font-bold">{s.count}</td>
                <td className="p-3 text-right">
                  {s.avgDaysInState > 5 ? (
                    <span className="text-red-600 font-semibold">{s.avgDaysInState.toFixed(1)}d</span>
                  ) : s.avgDaysInState > 2 ? (
                    <span className="text-amber-600">{s.avgDaysInState.toFixed(1)}d</span>
                  ) : (
                    <span className="text-green-600">{s.avgDaysInState.toFixed(1)}d</span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-3 rounded-full bg-brand-700 transition-all"
                        style={{ width: `${Math.max(pct, 1)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-10 text-right">{pct.toFixed(0)}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Exposure Report View
// ---------------------------------------------------------------------------

const ExposureReportView: React.FC<{ data: ExposureReport }> = ({ data }) => (
  <div className="space-y-6">
    {/* Portfolio Summary */}
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
      <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Total Portfolio Exposure</div>
      <div className="text-2xl font-black text-emerald-900 mt-1">{formatCurrency(data.totalPortfolio)}</div>
    </div>

    {/* Top Borrowers */}
    <div>
      <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-2">Top Borrowers by Exposure</h3>
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="p-3 text-left">Borrower</th>
              <th className="p-3 text-left">Industry</th>
              <th className="p-3 text-left">Rating</th>
              <th className="p-3 text-right">Exposure</th>
            </tr>
          </thead>
          <tbody>
            {data.topBorrowers.length === 0 ? (
              <tr><td colSpan={4} className="p-6 text-center text-sm text-text-secondary">No borrower exposure data available.</td></tr>
            ) : data.topBorrowers.map(b => (
              <tr key={b.borrowerProfileId} className="border-t hover:bg-gray-50 transition-colors">
                <td className="p-3 font-semibold">{b.borrowerName}</td>
                <td className="p-3 text-text-secondary">{b.industry || '—'}</td>
                <td className="p-3">
                  <RiskBadge rating={b.rating || 'NR'} size="sm" />
                </td>
                <td className="p-3 text-right font-bold">{formatCurrency(b.totalExposure)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* Sector Breakdown */}
    <div>
      <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-2">Sector Breakdown</h3>
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="p-3 text-left">Sector</th>
              <th className="p-3 text-right">Count</th>
              <th className="p-3 text-right">Total Exposure</th>
              <th className="p-3 text-left" style={{ width: '40%' }}>Share</th>
            </tr>
          </thead>
          <tbody>
            {data.sectorBreakdown.length === 0 ? (
              <tr><td colSpan={4} className="p-6 text-center text-sm text-text-secondary">No sector data available.</td></tr>
            ) : data.sectorBreakdown.map(s => {
              const pct = data.totalPortfolio > 0 ? (s.totalExposure / data.totalPortfolio) * 100 : 0;
              return (
                <tr key={s.sector} className="border-t hover:bg-gray-50 transition-colors">
                  <td className="p-3 font-semibold">{s.sector}</td>
                  <td className="p-3 text-right">{s.count}</td>
                  <td className="p-3 text-right font-bold">{formatCurrency(s.totalExposure)}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div className="h-3 rounded-full bg-emerald-600 transition-all" style={{ width: `${Math.max(pct, 1)}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-10 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

    {/* Rating Distribution */}
    <div>
      <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-2">Rating Distribution</h3>
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="p-3 text-left">Rating</th>
              <th className="p-3 text-right">Count</th>
              <th className="p-3 text-right">Total Exposure</th>
            </tr>
          </thead>
          <tbody>
            {data.ratingDistribution.length === 0 ? (
              <tr><td colSpan={3} className="p-6 text-center text-sm text-text-secondary">No rating data available.</td></tr>
            ) : data.ratingDistribution.map(r => (
              <tr key={r.rating} className="border-t hover:bg-gray-50 transition-colors">
                <td className="p-3">
                  <RiskBadge rating={r.rating} size="sm" />
                </td>
                <td className="p-3 text-right">{r.count}</td>
                <td className="p-3 text-right font-bold">{formatCurrency(r.totalExposure)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

type ReportTab = 'pipeline' | 'exposure';

const CreditReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('pipeline');
  const [pipeline, setPipeline] = useState<PipelineReport | null>(null);
  const [exposure, setExposure] = useState<ExposureReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pipeline date filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // Exposure topN filter
  const [topN, setTopN] = useState(10);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'pipeline') {
        const res = await reportsApi.getPipelineReport({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        });
        const payload = (res as any).data?.data ?? (res as any).data ?? res;
        setPipeline(payload);
      } else {
        const res = await reportsApi.getExposureReport({
          topN,
        });
        const payload = (res as any).data?.data ?? (res as any).data ?? res;
        setExposure(payload);
      }
    } catch (err: any) {
      console.error(err);
      const msg = friendlyMessage(err, 'Failed to load report data');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [activeTab, dateFrom, dateTo, topN]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCsv = async () => {
    try {
      if (activeTab === 'pipeline') {
        const res = await reportsApi.getPipelineReport({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          format: 'csv',
        });
        const blob = new Blob([res.data as any], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `pipeline-report-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
        toast.success('Pipeline report exported');
      } else {
        const res = await reportsApi.getExposureReport({
          topN,
          format: 'csv',
        });
        const blob = new Blob([res.data as any], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `exposure-report-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
        toast.success('Exposure report exported');
      }
    } catch (err: any) {
      toast.error(friendlyMessage(err, 'Failed to export CSV'));
    }
  };

  const tabs: { key: ReportTab; label: string; icon: string }[] = [
    { key: 'pipeline', label: 'Pipeline', icon: 'water' },
    { key: 'exposure', label: 'Exposure', icon: 'account_balance_wallet' },
  ];

  return (
    <>
      <CreditNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-text-primary">Credit Reports</h1>
            <p className="text-sm text-text-secondary mt-1">Export pipeline and exposure data for analysis</p>
          </div>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors"
            style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
          >
            <span className="material-symbols-outlined text-base">download</span>
            Export CSV
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-surface-muted rounded-xl p-1 mb-6 overflow-x-auto" role="tablist">
          {tabs.map(tab => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'bg-bg-surface text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              style={{ background: activeTab === tab.key ? 'var(--bg-surface, white)' : 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              <span className="material-symbols-outlined text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-bg-surface border border-border rounded-xl p-4 mb-6 flex flex-wrap items-end gap-4">
          {activeTab === 'pipeline' && (
            <>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Date From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200" style={{ fontFamily: 'var(--font-sans)' }} />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Date To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200" style={{ fontFamily: 'var(--font-sans)' }} />
              </div>
            </>
          )}
          {activeTab === 'exposure' && (
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Top N Borrowers</label>
              <input type="number" min={1} max={50} value={topN} onChange={e => setTopN(Number(e.target.value) || 10)}
                className="px-3 py-2 border border-border rounded-lg text-sm w-20 outline-none focus:ring-2 focus:ring-brand-200" style={{ fontFamily: 'var(--font-sans)' }} />
            </div>
          )}
          <button onClick={fetchReport}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            style={{ background: 'white', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            <span className="material-symbols-outlined text-base">refresh</span>
            Refresh
          </button>
        </div>

        {/* Content */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <span className="material-symbols-outlined animate-spin text-3xl text-brand-700 mr-2">progress_activity</span>
            <span className="text-sm text-text-secondary">Loading report data...</span>
          </div>
        )}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            <span className="material-symbols-outlined text-base align-middle mr-1">error</span>
            {error}
          </div>
        )}
        {!loading && !error && activeTab === 'pipeline' && pipeline && (
          <PipelineReportView data={pipeline} />
        )}
        {!loading && !error && activeTab === 'exposure' && exposure && (
          <ExposureReportView data={exposure} />
        )}
      </div>
    </>
  );
};

export default CreditReports;