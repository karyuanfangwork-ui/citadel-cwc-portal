import React, { useEffect, useState } from 'react';
import crmService from '../src/services/crm.service';
import type { DashboardStats } from '../src/services/crm.service';
import { DashboardLayoutProvider } from '../src/components/crm/DashboardLayoutProvider';
import AiInsightCard from '../src/components/crm/AiInsightCard';
import CrmKpiCard from '../src/components/crm/CrmKpiCard';
import PipelineFunnelChart from '../src/components/crm/PipelineFunnelChart';
import MonthlyTrendChart from '../src/components/crm/MonthlyTrendChart';
import ProductMixChart from '../src/components/crm/ProductMixChart';
import MyTasksWidget from '../src/components/crm/MyTasksWidget';
import UpcomingFollowUpsWidget from '../src/components/crm/UpcomingFollowUpsWidget';
import { useDailyBriefing } from '../src/hooks/useCrmAi';

const fmt = (value: number) => new Intl.NumberFormat('en-MY', {
  style: 'currency',
  currency: 'MYR',
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(value);

const DashboardInner: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myDeals, setMyDeals] = useState(false);
  const { briefing, loading: briefingLoading, error: briefingError, fetch: fetchBriefing } = useDailyBriefing();

  const now = new Date();
  const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`;
  const lastUpdated = now.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    crmService.getDashboard(myDeals)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message ?? 'Failed to load dashboard');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [myDeals]);

  const didAutoLoad = React.useRef(false);
  useEffect(() => {
    if (!didAutoLoad.current) {
      didAutoLoad.current = true;
      fetchBriefing();
    }
  }, [fetchBriefing]);

  if (error) {
    return (
      <div className="p-6 text-center text-red-600">
        <span className="material-symbols-outlined text-4xl block mb-2">error_outline</span>
        {error}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <section className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--text-primary,#111827)]">Relationship Overview</h1>
          <p className="text-sm text-[var(--text-secondary,#6b7280)] mt-0.5">
            Performance summary for {quarter} · Last updated: Today, {lastUpdated}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary,#6b7280)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={myDeals}
            onChange={(event) => setMyDeals(event.target.checked)}
            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          My deals only
        </label>
      </section>

      {(briefing || briefingLoading || briefingError) && (
        <AiInsightCard
          title="AI Daily Briefing"
          loading={briefingLoading}
          error={briefingError}
          onRefresh={fetchBriefing}
        >
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[var(--text-primary,#111827)]">{briefing?.headline}</p>
            {!!briefing?.bullets?.length && (
              <ul className="space-y-1 text-sm text-[var(--text-secondary,#6b7280)] list-disc pl-5">
                {briefing.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            )}
            {briefing?.topPriority && (
              <p className="text-sm text-[var(--text-primary,#111827)]">
                <span className="font-semibold">Top priority:</span> {briefing.topPriority}
              </p>
            )}
          </div>
        </AiInsightCard>
      )}

      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <CrmKpiCard
          label="Today's Leads"
          value={loading ? '—' : (stats?.totalLeads ?? 0)}
          icon="person_add"
          trend={stats?.totalLeads ? 'up' : 'flat'}
          trendLabel={stats ? `${stats.totalLeads} active` : undefined}
          trendPositive
        />
        <CrmKpiCard
          label="Active Opportunities"
          value={loading ? '—' : (stats?.totalOpportunities ?? 0)}
          icon="pending_actions"
          trend="flat"
          trendLabel="Stable flow"
        />
        <CrmKpiCard
          label="Follow-ups Today"
          value={loading ? '—' : (stats?.followUpDueToday ?? 0)}
          icon="rate_review"
          trend={stats?.followUpDueToday ? 'up' : 'flat'}
          trendLabel={stats?.followUpDueToday ? `${stats.followUpDueToday} due` : undefined}
          trendPositive={false}
        />
        <CrmKpiCard
          label="Won This Month"
          value={loading ? '—' : (stats?.wonDeals.count ?? 0)}
          icon="check_circle"
          trend="up"
          trendLabel={stats ? fmt(stats.wonDeals.value) : undefined}
          trendPositive
        />
        <CrmKpiCard
          label="Pipeline Value"
          value={loading ? '—' : (stats ? fmt(stats.pipelineValue) : '—')}
          icon="account_balance"
          trend="up"
          trendLabel={stats?.wonDeals.count ? `${stats.wonDeals.count} won` : undefined}
          trendPositive
        />
        <CrmKpiCard
          label="Win Rate"
          value={loading ? '—' : `${stats?.winRate ?? 0}%`}
          icon="emoji_events"
          trend={stats && stats.winRate >= 50 ? 'up' : 'down'}
          trendLabel={stats ? `${stats.lostDeals.count} lost` : undefined}
          trendPositive={stats ? stats.winRate >= 50 : true}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 bg-white border border-[var(--border,#e5e7eb)] rounded-xl p-5">
          <h3 className="text-base font-bold text-[var(--text-primary,#111827)] mb-4">Pipeline Funnel</h3>
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[100, 80, 60, 40].map((width) => (
                <div key={width} className="h-8 bg-gray-100 rounded" style={{ width: `${width}%` }} />
              ))}
            </div>
          ) : (
            <PipelineFunnelChart items={stats?.pipelineByName ?? []} />
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-[var(--border,#e5e7eb)] rounded-xl p-5">
          <div className="flex justify-between items-center mb-4 gap-3">
            <h3 className="text-base font-bold text-[var(--text-primary,#111827)]">Monthly Won Deals</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-brand-600" />
              <span className="text-[11px] text-[var(--text-secondary,#6b7280)]">Closed value</span>
            </div>
          </div>
          {loading ? (
            <div className="h-48 bg-gray-50 rounded animate-pulse" />
          ) : (
            <div className="h-48">
              <MonthlyTrendChart data={stats?.monthlyTrend ?? []} />
            </div>
          )}
        </div>

        <div className="lg:col-span-3 bg-white border border-[var(--border,#e5e7eb)] rounded-xl p-5">
          <h3 className="text-base font-bold text-[var(--text-primary,#111827)] mb-4">Pipeline Mix</h3>
          {loading ? (
            <div className="flex flex-col items-center gap-4 animate-pulse">
              <div className="w-32 h-32 rounded-full bg-gray-100" />
              <div className="w-full space-y-2">
                {[1, 2, 3, 4].map((index) => <div key={index} className="h-4 bg-gray-100 rounded" />)}
              </div>
            </div>
          ) : (
            <ProductMixChart items={stats?.pipelineByName ?? []} />
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white border border-[var(--border,#e5e7eb)] rounded-xl flex flex-col">
          <div className="px-5 py-4 border-b border-[var(--border,#e5e7eb)] flex justify-between items-center">
            <h3 className="text-sm font-bold text-[var(--text-primary,#111827)]">My Tasks</h3>
            <button className="text-xs font-semibold text-brand-600 hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              View all
            </button>
          </div>
          <div className="p-4 flex-1 overflow-y-auto max-h-80">
            {loading ? (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map((index) => <div key={index} className="h-12 bg-gray-100 rounded" />)}
              </div>
            ) : (
              <MyTasksWidget activities={stats?.recentActivities ?? []} />
            )}
          </div>
        </div>

        <div className="bg-white border border-[var(--border,#e5e7eb)] rounded-xl flex flex-col">
          <div className="px-5 py-4 border-b border-[var(--border,#e5e7eb)] flex justify-between items-center">
            <h3 className="text-sm font-bold text-[var(--text-primary,#111827)]">Recent Activities</h3>
            <span className="material-symbols-outlined text-[var(--text-secondary,#6b7280)] text-[18px] cursor-pointer">filter_list</span>
          </div>
          <div className="p-4 flex-1 overflow-y-auto max-h-80">
            {loading ? (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map((index) => <div key={index} className="h-14 bg-gray-100 rounded" />)}
              </div>
            ) : (
              <div className="relative border-l-2 border-gray-100 ml-2 pl-5 space-y-5 py-1">
                {(stats?.recentActivities ?? []).slice(0, 5).map((activity) => (
                  <div key={activity.id} className="relative">
                    <span className="absolute -left-[29px] top-1 w-3.5 h-3.5 bg-brand-600 rounded-full border-2 border-white" />
                    <p className="text-sm font-semibold text-[var(--text-primary,#111827)]">
                      {activity.subject ?? activity.activityType}
                    </p>
                    {activity.description && (
                      <p className="text-xs text-[var(--text-secondary,#6b7280)] mt-0.5 line-clamp-2">{activity.description}</p>
                    )}
                    <p className="text-[11px] text-[var(--text-secondary,#9ca3af)] mt-1">
                      {new Date(activity.createdAt).toLocaleString('en-MY', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                ))}
                {!stats?.recentActivities?.length && (
                  <p className="text-sm text-[var(--text-secondary,#6b7280)]">No recent activities</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-[var(--border,#e5e7eb)] rounded-xl flex flex-col">
          <div className="px-5 py-4 border-b border-[var(--border,#e5e7eb)] flex justify-between items-center">
            <h3 className="text-sm font-bold text-[var(--text-primary,#111827)]">Upcoming Follow-Ups</h3>
            <div className="flex gap-1">
              <button className="p-0.5 rounded border border-[var(--border,#e5e7eb)] hover:bg-gray-50" style={{ background: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              <button className="p-0.5 rounded border border-[var(--border,#e5e7eb)] hover:bg-gray-50" style={{ background: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
          <div className="p-4 flex-1 overflow-y-auto max-h-80">
            {loading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map((index) => <div key={index} className="h-16 bg-gray-100 rounded" />)}
              </div>
            ) : (
              <UpcomingFollowUpsWidget items={stats?.upcomingFollowUps ?? []} />
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

const CrmDashboard: React.FC = () => (
  <DashboardLayoutProvider>
    <DashboardInner />
  </DashboardLayoutProvider>
);

export default CrmDashboard;
