import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import crmService from '../src/services/crm.service';
import type { DashboardStats } from '../src/services/crm.service';
import { DashboardLayoutProvider, useDashboardLayout } from '../src/components/crm/DashboardLayoutProvider';
import AiInsightCard from '../src/components/crm/AiInsightCard';
import CrmKpiCard from '../src/components/crm/CrmKpiCard';
import PipelineFunnelChart from '../src/components/crm/PipelineFunnelChart';
import MonthlyTrendChart from '../src/components/crm/MonthlyTrendChart';
import MyTasksWidget from '../src/components/crm/MyTasksWidget';
import UpcomingFollowUpsWidget from '../src/components/crm/UpcomingFollowUpsWidget';
import DateRangeDropdown, { type DatePreset } from '../src/components/crm/DateRangeDropdown';
import { useDailyBriefing } from '../src/hooks/useCrmAi';

const fmt = (value: number) => new Intl.NumberFormat('en-MY', {
  style: 'currency',
  currency: 'MYR',
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(value);

const numFmt = (value: number) => new Intl.NumberFormat('en-MY').format(value);

const TEAL = '#006a61';

// Utility — converts a DatePreset key to { dateFrom, dateTo } ISO strings
function presetToDates(preset: DatePreset): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const to = now.toISOString();
  if (preset === '7d') {
    return { dateFrom: new Date(now.getTime() - 7 * 86400_000).toISOString(), dateTo: to };
  }
  if (preset === '90d') {
    return { dateFrom: new Date(now.getTime() - 90 * 86400_000).toISOString(), dateTo: to };
  }
  if (preset === 'quarter') {
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    return { dateFrom: qStart.toISOString(), dateTo: to };
  }
  // default: 30d
  return { dateFrom: new Date(now.getTime() - 30 * 86400_000).toISOString(), dateTo: to };
}

const PRESET_LABELS: Record<DatePreset, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  'quarter': 'This quarter',
};

type ActivityFilter = 'all' | 'lead' | 'opportunity' | 'deal';

const ACTIVITY_TYPE_MAP: Record<ActivityFilter, string[]> = {
  all: [],
  lead: ['LEAD_CREATED', 'LEAD_UPDATED', 'LEAD_CONVERTED', 'NOTE'],
  opportunity: ['OPPORTUNITY_CREATED', 'OPPORTUNITY_UPDATED', 'STAGE_CHANGE'],
  deal: ['DEAL_WON', 'DEAL_LOST', 'CLOSED'],
};

const DashboardInner: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myDeals, setMyDeals] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [exporting, setExporting] = useState(false);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [activityFilterOpen, setActivityFilterOpen] = useState(false);
  const activityFilterRef = useRef<HTMLDivElement>(null);
  const { briefing, loading: briefingLoading, error: briefingError, fetch: fetchBriefing } = useDailyBriefing();
  const { layout } = useDashboardLayout();

  const isVisible = (widgetId: string): boolean => {
    const entry = layout.find(w => w.widgetId === widgetId);
    return entry ? entry.visible : true; // default visible if not configured
  };

  const now = new Date();
  const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`;
  const lastUpdated = now.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const { dateFrom, dateTo } = presetToDates(datePreset);
    crmService.getDashboard(myDeals, dateFrom, dateTo)
      .then((data) => { if (!cancelled) setStats(data); })
      .catch((err: any) => { if (!cancelled) setError(err.message ?? 'Failed to load dashboard'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [myDeals, datePreset]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (activityFilterRef.current && !activityFilterRef.current.contains(e.target as Node)) {
        setActivityFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const didAutoLoad = React.useRef(false);
  useEffect(() => {
    if (!didAutoLoad.current) {
      didAutoLoad.current = true;
      fetchBriefing();
    }
  }, [fetchBriefing]);

  if (error) {
    return (
      <div className="p-6 text-center text-[#ba1a1a]">
        <span className="material-symbols-outlined text-4xl block mb-2">error_outline</span>
        {error}
      </div>
    );
  }

  const delta = stats?.delta ?? { leadsDelta: 0, oppsDelta: 0, wonDelta: 0, lostDelta: 0, pipelineDelta: 0, winRateDelta: 0 };

  const filteredActivities = (stats?.recentActivities ?? [])
    .filter(a => activityFilter === 'all' || ACTIVITY_TYPE_MAP[activityFilter].some(t => a.activityType?.includes(t)))
    .slice(0, 5);

  return (
    <div className="min-h-full bg-[#f8f9ff] p-6 space-y-5 max-w-screen-2xl mx-auto">

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[28px] font-bold leading-tight text-[#0b1c30] tracking-tight">CRM Dashboard</h2>
          <p className="text-[13px] text-[#45464d] mt-0.5">
            Performance overview — {PRESET_LABELS[datePreset]}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeDropdown value={datePreset} onChange={setDatePreset} />
          <button
            onClick={async () => {
              setExporting(true);
              const { dateFrom, dateTo } = presetToDates(datePreset);
              await crmService.exportDashboard(myDeals, dateFrom, dateTo).catch(() => {});
              setExporting(false);
            }}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-1.5 bg-[#006a61] text-white text-[13px] font-medium rounded-full hover:opacity-90 transition-all shadow-md disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">{exporting ? 'hourglass_top' : 'download'}</span>
            {exporting ? 'Exporting…' : 'Export Report'}
          </button>
          <label
            aria-label="My deals only"
            className="flex items-center gap-2 text-[13px] text-[#45464d] cursor-pointer select-none bg-white border border-[#e2e8f0] rounded-full px-4 py-1.5"
          >
            <input
              type="checkbox"
              checked={myDeals}
              onChange={(e) => setMyDeals(e.target.checked)}
              className="rounded border-[#e2e8f0] accent-[#006a61]"
            />
            My deals only
          </label>
        </div>
      </div>

      {/* AI Briefing */}
      {isVisible('ai_briefing') && (briefing || briefingLoading || briefingError) && (
        <AiInsightCard
          title="AI Daily Briefing"
          loading={briefingLoading}
          error={briefingError}
          onRefresh={fetchBriefing}
        >
          <div className="space-y-2">
            <p className="text-[14px] font-semibold text-[#0b1c30]">{briefing?.headline}</p>
            {!!briefing?.bullets?.length && (
              <ul className="space-y-1 text-[13px] text-[#45464d] list-disc pl-5">
                {briefing.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            )}
            {briefing?.topPriority && (
              <p className="text-[13px] text-[#0b1c30]">
                <span className="font-semibold">Top priority:</span> {briefing.topPriority}
              </p>
            )}
          </div>
        </AiInsightCard>
      )}

      {/* KPI Cards */}
      {isVisible('kpi_cards') && (
        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <CrmKpiCard
            label="New Leads"
            value={loading ? '—' : numFmt(stats?.totalLeads ?? 0)}
            icon="person_add"
            trend={delta.leadsDelta > 0 ? 'up' : delta.leadsDelta < 0 ? 'down' : 'flat'}
            trendPercent={delta.leadsDelta}
            trendPositive={delta.leadsDelta >= 0}
          />
          <CrmKpiCard
            label="Open Opps"
            value={loading ? '—' : numFmt(stats?.totalOpportunities ?? 0)}
            icon="pending_actions"
            trend={delta.oppsDelta > 0 ? 'up' : delta.oppsDelta < 0 ? 'down' : 'flat'}
            trendPercent={delta.oppsDelta}
            trendPositive={delta.oppsDelta >= 0}
          />
          <CrmKpiCard
            label="Won Opps"
            value={loading ? '—' : numFmt(stats?.wonDeals?.count ?? 0)}
            icon="check_circle"
            trend={delta.wonDelta > 0 ? 'up' : delta.wonDelta < 0 ? 'down' : 'flat'}
            trendPercent={delta.wonDelta}
            subtitle={stats ? fmt(stats.wonDeals.value) : undefined}
            trendPositive={delta.wonDelta >= 0}
          />
          <CrmKpiCard
            label="Lost Opps"
            value={loading ? '—' : numFmt(stats?.lostDeals?.count ?? 0)}
            icon="cancel"
            trend={delta.lostDelta > 0 ? 'up' : delta.lostDelta < 0 ? 'down' : 'flat'}
            trendPercent={delta.lostDelta}
            trendPositive={delta.lostDelta <= 0}
          />
          <CrmKpiCard
            label="Pipeline Val"
            value={loading ? '—' : (stats ? fmt(stats.pipelineValue) : '—')}
            icon="account_balance"
            trend={delta.pipelineDelta > 0 ? 'up' : 'flat'}
            trendPercent={delta.pipelineDelta}
            trendPositive={delta.pipelineDelta >= 0}
            highlight
          />
          <CrmKpiCard
            label="Conv. Rate"
            value={loading ? '—' : `${stats?.winRate ?? 0}%`}
            icon="emoji_events"
            trend={delta.winRateDelta > 0 ? 'up' : delta.winRateDelta < 0 ? 'down' : 'flat'}
            trendPercent={delta.winRateDelta}
            trendPositive={delta.winRateDelta >= 0}
          />
        </section>
      )}

      {/* Charts Row: Monthly Trend (8) + Funnel (4) */}
      {(isVisible('monthly_trend') || isVisible('opportunity_funnel')) && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {isVisible('monthly_trend') && (
            <div className="lg:col-span-8 bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h3 className="text-[16px] font-semibold text-[#0b1c30]">Monthly Sales Trend</h3>
                  <p className="text-[12px] text-[#45464d] opacity-70 mt-0.5">Lead generation vs closed deals</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: TEAL }} />
                    <span className="text-[10px] font-bold tracking-wider uppercase text-[#45464d] opacity-70">Revenue</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#adc6ff]" />
                    <span className="text-[10px] font-bold tracking-wider uppercase text-[#45464d] opacity-70">Leads</span>
                  </div>
                </div>
              </div>
              {loading ? (
                <div className="h-52 bg-[#f8f9ff] rounded-lg animate-pulse" />
              ) : (
                <div className="h-52">
                  <MonthlyTrendChart data={stats?.monthlyTrend ?? []} />
                </div>
              )}
            </div>
          )}
          {isVisible('opportunity_funnel') && (
            <div className="lg:col-span-4 bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm">
              <h3 className="text-[16px] font-semibold text-[#0b1c30] mb-5">Opportunity Funnel</h3>
              {loading ? (
                <div className="space-y-3 animate-pulse">
                  {[100, 75, 50, 30].map((w) => (
                    <div key={w} className="h-8 bg-[#f8f9ff] rounded" style={{ width: `${w}%` }} />
                  ))}
                </div>
              ) : (
                <PipelineFunnelChart
                  items={stats?.pipelineByName ?? []}
                  opportunitiesByStage={stats?.opportunitiesByStage ?? []}
                  avgVelocityDays={stats?.avgVelocityDays ?? null}
                />
              )}
            </div>
          )}
        </section>
      )}

      {/* Bottom Row: Upcoming Activities (6) + My Tasks (6) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Upcoming Activities */}
        {isVisible('upcoming_activities') && (
          <div className="lg:col-span-6 bg-white border border-[#e2e8f0] rounded-xl shadow-sm flex flex-col">
            <div className="px-5 py-4 border-b border-[#e2e8f0] flex justify-between items-center">
              <h3 className="text-[15px] font-semibold text-[#0b1c30]">Upcoming Activities</h3>
              <Link
                to="/crm/leads?filter=upcoming"
                className="text-[13px] font-semibold"
                style={{ color: TEAL, textDecoration: 'none' }}
              >
                View All
              </Link>
            </div>
            <div className="p-4 flex-1 overflow-y-auto max-h-72">
              {loading ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-[#f8f9ff] rounded-lg" />)}
                </div>
              ) : (
                <UpcomingFollowUpsWidget items={stats?.upcomingFollowUps ?? []} />
              )}
            </div>
          </div>
        )}

        {/* My Tasks */}
        {isVisible('my_tasks') && (
          <div className="lg:col-span-6 bg-white border border-[#e2e8f0] rounded-xl shadow-sm flex flex-col">
            <div className="px-5 py-4 border-b border-[#e2e8f0] flex justify-between items-center">
              <h3 className="text-[15px] font-semibold text-[#0b1c30]">My Tasks</h3>
              <Link
                to="/crm/leads?filter=stale"
                className="text-[13px] font-semibold"
                style={{ color: TEAL, textDecoration: 'none' }}
              >
                View All
              </Link>
            </div>
            <div className="p-4 flex-1 overflow-y-auto max-h-72">
              {loading ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-[#f8f9ff] rounded-lg" />)}
                </div>
              ) : (
                <MyTasksWidget
                  activities={stats?.recentActivities ?? []}
                  overdueDeals={stats?.overdueDeals ?? 0}
                  staleLeads={stats?.staleLeads ?? 0}
                  followUpDueToday={stats?.followUpDueToday ?? 0}
                />
              )}
            </div>
          </div>
        )}
      </section>

      {/* Recent Activities */}
      {isVisible('recent_activities') && (
        <section className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b border-[#e2e8f0] flex justify-between items-center">
            <h3 className="text-[15px] font-semibold text-[#0b1c30]">Recent Activities</h3>
            <div ref={activityFilterRef} className="relative">
              <button
                onClick={() => setActivityFilterOpen(o => !o)}
                aria-label="Filter recent activities"
                className="p-1 rounded-lg hover:bg-[#f8f9ff] transition-colors"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined text-[#45464d] opacity-60 text-[18px]">filter_list</span>
              </button>
              {activityFilterOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-30 w-44 bg-white border border-[#e2e8f0] rounded-xl shadow-lg p-1.5">
                  {([['all', 'All Activities'], ['lead', 'Leads'], ['opportunity', 'Opportunities'], ['deal', 'Deals']] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => { setActivityFilter(key); setActivityFilterOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[13px] font-semibold rounded-lg text-left transition-colors"
                      style={{
                        background: activityFilter === key ? '#86f2e4' : 'transparent',
                        color: activityFilter === key ? '#006a61' : '#64748b',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-[#f8f9ff] rounded-lg" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-4 p-3 rounded-lg hover:bg-[#f8f9ff] transition-colors">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#86f2e4', color: TEAL }}>
                      <span className="material-symbols-outlined text-[16px]">history</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-[#0b1c30] truncate">
                        {activity.subject ?? activity.activityType}
                      </p>
                      {activity.description && (
                        <p className="text-[12px] text-[#45464d] opacity-70 mt-0.5 line-clamp-1">{activity.description}</p>
                      )}
                    </div>
                    <p className="text-[11px] text-[#45464d] opacity-60 flex-shrink-0 mt-0.5">
                      {new Date(activity.createdAt).toLocaleString('en-MY', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                ))}
                {!stats?.recentActivities?.length && (
                  <p className="text-[13px] text-[#45464d] opacity-60 text-center py-4">No recent activities</p>
                )}
              </div>
            )}
          </div>
        </section>
      )}

    </div>
  );
};

const CrmDashboard: React.FC = () => (
  <DashboardLayoutProvider>
    <DashboardInner />
  </DashboardLayoutProvider>
);

export default CrmDashboard;