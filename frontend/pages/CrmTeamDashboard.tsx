import React, { useState, useEffect } from 'react';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';
import { Navigate } from 'react-router-dom';
import crmService, { TeamPerformance } from '../src/services/crm.service';
import CrmNav from '../src/components/CrmNav';

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val);

const SkeletonBox = ({ w, h }: { w: string; h: string }) => (
  <div
    style={{
      width: w,
      height: h,
      background: 'var(--color-border)',
      borderRadius: 'var(--radius-sm)',
      animation: 'pulse 1.5s ease-in-out infinite',
    }}
  />
);

const CrmTeamDashboard = () => {
  const { user } = useAuth();
  const [agents, setAgents] = useState<TeamPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Permission guard — crm:admin only
  if (!hasPermission(user, 'crm:admin')) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await crmService.getTeamPerformance();
        setAgents(data.agents);
      } catch (e: any) {
        setError(e.message || 'Failed to load team performance');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  // Aggregated totals
  const totalLeads = agents.reduce((s, a) => s + a.leads, 0);
  const totalPipelineValue = agents.reduce((s, a) => s + a.pipelineValue, 0);
  const totalWonCount = agents.reduce((s, a) => s + a.wonThisMonth.count, 0);
  const totalWonValue = agents.reduce((s, a) => s + a.wonThisMonth.value, 0);

  return (
    <>
      <CrmNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4338ca] rounded-xl py-10 px-4 sm:px-8 relative overflow-hidden mb-6">
        <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: '30%', width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div className="relative z-10">
          <div className="text-xs font-bold text-white/60 tracking-widest uppercase mb-2">CRM Dashboard</div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
            Team Performance <span className="text-white/65 font-normal">Overview</span>
          </h1>
          <p className="text-sm text-white/70 mt-2">Monitor your agents' pipeline activity, deal progress, and stale leads.</p>
        </div>
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6">
          <p className="font-bold">Error loading team performance</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        {loading ? (
          [0, 1, 2].map((i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-5 flex items-center gap-4">
              <SkeletonBox w="44px" h="44px" />
              <div>
                <SkeletonBox w="60px" h="28px" />
                <div className="mt-1">
                  <SkeletonBox w="100px" h="12px" />
                </div>
              </div>
            </div>
          ))
        ) : (
          [
            { label: 'Total Leads', value: totalLeads, icon: 'lightbulb', bg: '#fef3c7', color: '#92400e' },
            { label: 'Pipeline Value', value: formatCurrency(totalPipelineValue), icon: 'payments', bg: '#ecfdf5', color: '#065f46' },
            { label: 'Won This Month', value: `${totalWonCount} · ${formatCurrency(totalWonValue)}`, icon: 'emoji_events', bg: '#f0fdf4', color: '#166534' },
          ].map((s) => (
            <div key={s.label} className="bg-surface border border-border rounded-xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow cursor-default">
              <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ background: s.bg }}>
                <span className="material-symbols-outlined text-[22px]" style={{ color: s.color }}>
                  {s.icon}
                </span>
              </div>
              <div>
                <div className="text-2xl font-black leading-none" style={{ color: s.color }}>
                  {s.value}
                </div>
                <div className="text-xs font-semibold mt-0.5 text-text-secondary">{s.label}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Agent Table */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-extrabold text-text-primary">Agent Performance</h2>
        </div>

        {loading ? (
          <div className="p-5 space-y-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3">
                <SkeletonBox w="36px" h="36px" />
                <div className="flex-1">
                  <SkeletonBox w="60%" h="14px" />
                  <div className="mt-2">
                    <SkeletonBox w="40%" h="10px" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="p-12 text-center text-text-secondary">
            <span className="material-symbols-outlined text-5xl mb-4 block opacity-30">groups</span>
            <p className="font-bold">No agents found</p>
            <p className="text-sm mt-1">Team performance data will appear here once agents are assigned</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50">
                  <th className="text-left font-bold text-text-secondary px-5 py-3">Agent</th>
                  <th className="text-right font-bold text-text-secondary px-5 py-3">Leads</th>
                  <th className="text-right font-bold text-text-secondary px-5 py-3">Open Deals</th>
                  <th className="text-right font-bold text-text-secondary px-5 py-3">Pipeline Value</th>
                  <th className="text-right font-bold text-text-secondary px-5 py-3">Won This Month</th>
                  <th className="text-right font-bold text-text-secondary px-5 py-3">Stale Leads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {agents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                    {/* Agent */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {agent.avatarUrl ? (
                          <img src={agent.avatarUrl} alt={agent.name} className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-indigo-700">{agent.name.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-text-primary truncate">{agent.name}</div>
                          <div className="text-xs text-text-secondary truncate">{agent.email}</div>
                        </div>
                      </div>
                    </td>
                    {/* Leads */}
                    <td className="text-right px-5 py-4 font-semibold text-text-primary">{agent.leads}</td>
                    {/* Open Deals */}
                    <td className="text-right px-5 py-4 font-semibold text-text-primary">{agent.openDeals}</td>
                    {/* Pipeline Value */}
                    <td className="text-right px-5 py-4 font-semibold text-emerald-700">{formatCurrency(agent.pipelineValue)}</td>
                    {/* Won This Month */}
                    <td className="text-right px-5 py-4">
                      <div className="font-semibold text-text-primary">{agent.wonThisMonth.count} deals</div>
                      <div className="text-xs text-emerald-600">{formatCurrency(agent.wonThisMonth.value)}</div>
                    </td>
                    {/* Stale Leads */}
                    <td className="text-right px-5 py-4">
                      <span
                        className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-bold ${
                          agent.staleLeads > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {agent.staleLeads}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default CrmTeamDashboard;