import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import creditService from '../src/services/credit.service';
import CreditNav from '../src/components/CreditNav';

const formatCurrency = (val: number | null) =>
  val != null ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val) : '—';

const CreditDashboard: React.FC = () => {
  const [stats, setStats] = useState<{
    totalBorrowers: number;
    pendingReviews: number;
    approvedToday: number;
    totalDisbursed: number;
    recentActivities: Array<{ id: string; type: string; description: string; createdAt: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    creditService.getDashboard()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <CreditNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
        <h1 className="text-2xl font-black text-text-primary mb-6">Credit Dashboard</h1>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Borrowers', value: stats?.totalBorrowers ?? '—', icon: 'person', color: '#6366f1' },
            { label: 'Pending Reviews', value: stats?.pendingReviews ?? '—', icon: 'rate_review', color: '#f59e0b' },
            { label: 'Approved Today', value: stats?.approvedToday ?? '—', icon: 'check_circle', color: '#22c55e' },
            { label: 'Total Disbursed', value: typeof stats?.totalDisbursed === 'number' ? formatCurrency(stats.totalDisbursed) : '—', icon: 'payments', color: '#3b82f6' },
          ].map(card => (
            <div key={card.label} className="bg-bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${card.color}15` }}>
                  <span className="material-symbols-outlined text-lg" style={{ color: card.color }}>{card.icon}</span>
                </div>
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">{card.label}</span>
              </div>
              <p className="text-2xl font-black text-text-primary">{loading ? '...' : card.value}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="bg-bg-surface border border-border rounded-xl p-5 mb-8">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Quick Actions</h3>
          <div className="flex gap-3 flex-wrap">
            <Link to="/credit/borrowers" className="flex items-center gap-2 bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors" style={{ textDecoration: 'none' }}>
              <span className="material-symbols-outlined text-base">person</span> View Borrowers
            </Link>
            <Link to="/credit/applications" className="flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-sm font-semibold hover:bg-bg-subtle transition-colors" style={{ textDecoration: 'none', color: 'var(--color-text-primary)' }}>
              <span className="material-symbols-outlined text-base">description</span> Applications
            </Link>
            <Link to="/credit/reports" className="flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-sm font-semibold hover:bg-bg-subtle transition-colors" style={{ textDecoration: 'none', color: 'var(--color-text-primary)' }}>
              <span className="material-symbols-outlined text-base">bar_chart</span> Reports
            </Link>
          </div>
        </div>

        {/* Recent activities */}
        <div className="bg-bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Recent Activity</h3>
          {!stats?.recentActivities?.length ? (
            <p className="text-sm text-text-secondary">No recent activity.</p>
          ) : (
            <div className="space-y-3">
              {stats.recentActivities.map(a => (
                <div key={a.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <span className="material-symbols-outlined text-base text-brand-700">timeline</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary">{a.description}</p>
                  </div>
                  <span className="text-xs text-text-secondary shrink-0">
                    {new Date(a.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CreditDashboard;