import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import crmService from '../src/services/crm.service';
import type { DashboardStats } from '../src/services/crm.service';
import { DashboardLayoutProvider, useDashboardLayout } from '../src/components/crm/DashboardLayoutProvider';
import AiInsightCard from '../src/components/crm/AiInsightCard';
import CrmKpiCard from '../src/components/crm/CrmKpiCard';
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
const TEAL_BG = '#86f2e4';
const NAVY = '#131b2e';
const SURFACE = '#f8f9ff';
const CARD_BORDER = '#e2e8f0';
const TEXT_PRIMARY = '#0b1c30';
const TEXT_SECONDARY = '#45464d';

function presetToDates(preset: DatePreset): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const to = now.toISOString();
  if (preset === '7d') return { dateFrom: new Date(now.getTime() - 7 * 86400_000).toISOString(), dateTo: to };
  if (preset === '90d') return { dateFrom: new Date(now.getTime() - 90 * 86400_000).toISOString(), dateTo: to };
  if (preset === 'quarter') {
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    return { dateFrom: qStart.toISOString(), dateTo: to };
  }
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

// --- New Sub-Components ---

/** Greeting header with quick actions */
const WelcomeHeader: React.FC<{ userName?: string; datePreset: DatePreset; setDatePreset: (p: DatePreset) => void; myDeals: boolean; setMyDeals: (v: boolean) => void; activitiesDue: number }> = ({ userName, datePreset, setDatePreset, myDeals, setMyDeals, activitiesDue }) => {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const dateStr = now.toLocaleDateString('en-MY', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h2 className="text-[24px] font-semibold text-[#0b1c30] tracking-tight">
          {greeting}, {userName ?? 'Sales Rep'} 👋
        </h2>
        <p className="text-[13px] text-[#45464d] mt-1">
          {dateStr} • <span className="font-semibold" style={{ color: TEAL }}>You have {activitiesDue} activities due today.</span>
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <DateRangeDropdown value={datePreset} onChange={setDatePreset} />
        <Link
          to="/crm/leads?action=create"
          className="flex items-center gap-2 px-4 py-2 border border-[#e2e8f0] rounded-lg text-[13px] font-semibold text-[#0b1c30] hover:bg-[#eff4ff] transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          New Lead
        </Link>
        <Link
          to="/crm/opportunities?action=create"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold text-white hover:opacity-90 transition-all shadow-sm"
          style={{ background: TEAL }}
        >
          <span className="material-symbols-outlined text-[18px]">add_chart</span>
          New Opportunity
        </Link>
        <label className="flex items-center gap-2 text-[13px] text-[#45464d] cursor-pointer select-none bg-white border border-[#e2e8f0] rounded-full px-4 py-1.5">
          <input type="checkbox" checked={myDeals} onChange={(e) => setMyDeals(e.target.checked)} className="rounded border-[#e2e8f0] accent-[#006a61]" />
          My deals only
        </label>
      </div>
    </div>
  );
};

/** Hot Leads list — top 5 leads by score */
const HotLeadsSection: React.FC<{ leads: DashboardStats['hotLeads'] }> = ({ leads }) => {
  if (!leads.length) return null;
  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <section className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
        <h3 className="text-[18px] font-semibold text-[#0b1c30] flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ color: TEAL, fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
          Hot Leads (Priority 1)
        </h3>
        <Link to="/crm/leads?sort=score" className="text-[13px] font-semibold hover:underline" style={{ color: TEAL }}>View All</Link>
      </div>
      <div className="divide-y divide-[#e2e8f0]">
        {leads.map((lead) => (
          <div key={lead.id} className="px-6 py-3 flex items-center justify-between hover:bg-[#f8f9ff] transition-colors group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[14px]" style={{ background: TEAL_BG + '33', color: TEAL }}>
                {lead.contactName ? initials(lead.contactName) : initials(lead.title)}
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#0b1c30]">{lead.contactName ?? lead.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {lead.tags.map((tag) => (
                    <span key={tag} className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#dce9ff] text-[#3f465c]">{tag}</span>
                  ))}
                  {lead.estimatedValue != null && (
                    <span className="text-[11px] font-medium text-[#0b1c30]">{fmt(lead.estimatedValue)}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-[10px] font-bold tracking-wider uppercase text-[#45464d] opacity-70">LendScore</p>
                <p className="text-[18px] font-semibold" style={{ color: lead.score >= 80 ? TEAL : lead.score >= 50 ? '#3f465c' : '#ba1a1a' }}>{lead.score}</p>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link
                  to={`/crm/leads/${lead.id}`}
                  className="px-3 py-1 text-[13px] font-semibold text-white rounded-lg hover:opacity-90 transition-all"
                  style={{ background: NAVY }}
                >
                  Open
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

/** Today's Follow-Ups */
const FollowUpsWidget: React.FC<{ items: DashboardStats['upcomingFollowUps']; followUpDueToday: number }> = ({ items, followUpDueToday }) => {
  const priorityColor = (idx: number) => {
    if (idx === 0) return '#ba1a1a'; // high = red
    if (idx === 1) return TEAL; // standard = teal
    return '#45464d'; // medium = gray
  };

  return (
    <section className="bg-white border border-[#e2e8f0] rounded-xl flex flex-col h-[400px]">
      <div className="px-6 py-4 border-b border-[#e2e8f0]">
        <h3 className="text-[18px] font-semibold text-[#0b1c30]">Today's Follow-Ups</h3>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="divide-y divide-[#e2e8f0]">
          {items.length === 0 && (
            <p className="text-[13px] text-[#45464d] opacity-60 text-center py-8">No follow-ups today</p>
          )}
          {items.map((fu, idx) => (
            <div key={fu.id} className="px-6 py-3 flex items-start gap-4">
              <div className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: priorityColor(idx) }} />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#0b1c30] truncate">{fu.title}</p>
                {fu.followUpNote && <p className="text-[11px] text-[#45464d] mt-0.5 truncate">{fu.followUpNote}</p>}
                <div className="flex items-center gap-3 mt-1.5 text-[10px] font-bold text-[#45464d] uppercase">
                  <span>{new Date(fu.followUpDate).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' })}</span>
                  <span style={{ color: priorityColor(idx) }}>{idx === 0 ? 'High Priority' : idx === 1 ? 'Standard' : 'Medium'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/** My Tasks widget — overdue + in-progress grouped */
const MyTasksWidget: React.FC<{ tasks: DashboardStats['tasks'] }> = ({ tasks }) => (
  <section className="bg-white border border-[#e2e8f0] rounded-xl flex flex-col h-[400px]">
    <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
      <h3 className="text-[18px] font-semibold text-[#0b1c30]">My Tasks</h3>
      <span className="bg-[#e5eeff] px-2 py-0.5 rounded text-[10px] font-bold text-[#45464d]">{tasks.overdueCount + tasks.inProgressCount} Active</span>
    </div>
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
      {tasks.overdue.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold tracking-wider uppercase text-[#45464d]">Status: Overdue ({tasks.overdueCount})</p>
          {tasks.overdue.map((t) => (
            <div key={t.id} className="p-3 bg-[#ffdad6]/20 border border-[#ba1a1a]/10 rounded-lg flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#93000a]">{t.subject}</span>
              <span className="text-[10px] font-bold text-[#ba1a1a]">{t.scheduledAt ? 'PAST DUE' : '—'}</span>
            </div>
          ))}
        </div>
      )}
      {tasks.inProgress.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold tracking-wider uppercase text-[#45464d]">In Progress ({tasks.inProgressCount})</p>
          {tasks.inProgress.map((t) => (
            <div key={t.id} className="p-3 bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#0b1c30]">{t.subject}</span>
              <span className="material-symbols-outlined text-[#45464d] text-[18px]">more_vert</span>
            </div>
          ))}
        </div>
      )}
      {tasks.overdue.length === 0 && tasks.inProgress.length === 0 && (
        <p className="text-[13px] text-[#45464d] opacity-60 text-center py-8">No tasks</p>
      )}
    </div>
  </section>
);

/** Opportunity Pipeline — horizontal stages with counts and values */
const PipelineWidget: React.FC<{ stages: DashboardStats['opportunitiesByStage'] }> = ({ stages }) => {
  const activeStages = stages.filter(s => !s.isWonStage && !s.isLostStage).sort((a, b) => a.displayOrder - b.displayOrder);
  const totalValue = activeStages.reduce((s, st) => s + st._sum.value, 0);
  const stageColors = ['#86f2e4', '#6bd8cb', '#3fc4ad', TEAL]; // gradient from light to dark teal

  return (
    <section className="bg-white border border-[#e2e8f0] rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[18px] font-semibold text-[#0b1c30]">Opportunity Pipeline</h3>
        <div className="text-right">
          <p className="text-[10px] font-bold tracking-wider uppercase text-[#45464d] opacity-70">Total Volume</p>
          <p className="text-[16px] font-bold text-[#0b1c30]">{fmt(totalValue)}</p>
        </div>
      </div>
      <div className="flex gap-2">
        {activeStages.map((stage, idx) => {
          const color = stageColors[idx % stageColors.length];
          const textColor = idx >= stageColors.length - 1 ? '#fff' : TEAL;
          return (
            <div key={stage.stageId} className="flex-1 h-20 rounded flex flex-col items-center justify-center border-b-4" style={{ background: color + (idx < 2 ? '4D' : idx === 2 ? '80' : 'CC'), borderBottomColor: TEAL, opacity: 0.3 + (idx * 0.2) }}>
              <p className="text-[10px] font-bold" style={{ color: textColor }}>{stage.name}</p>
              <p className="text-[13px] font-semibold" style={{ color: textColor, fontFamily: "'JetBrains Mono', monospace" }}>{stage._count} ({fmt(stage._sum.value).replace('MYR', '').trim()})</p>
            </div>
          );
        })}
        {activeStages.length === 0 && (
          <p className="text-[13px] text-[#45464d] opacity-60 text-center w-full">No active pipeline stages</p>
        )}
      </div>
    </section>
  );
};

/** Calendar / Upcoming Meetings */
const CalendarWidget: React.FC<{ meetingsToday: DashboardStats['meetingsToday'] }> = ({ meetingsToday }) => {
  const { count, nextMeeting } = meetingsToday;
  return (
    <section className="bg-white border border-[#e2e8f0] rounded-xl p-6">
      <h3 className="text-[18px] font-semibold text-[#0b1c30] mb-4">Calendar</h3>
      <div className="space-y-4">
        {count === 0 && !nextMeeting && (
          <p className="text-[13px] text-[#45464d] opacity-60 text-center py-4">No meetings today</p>
        )}
        {nextMeeting && (
          <div className="flex gap-4">
            <div className="w-12 text-center shrink-0">
              <p className="font-bold" style={{ color: TEAL }}>{new Date(nextMeeting.scheduledAt).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' })}</p>
              <p className="text-[10px] text-[#45464d] font-bold uppercase">{new Date(nextMeeting.scheduledAt).toLocaleTimeString('en-MY', { hour12: true }).split(' ')[1]}</p>
            </div>
            <div className="flex-1 p-3 bg-[#f8f9ff] rounded-lg border-l-4" style={{ borderColor: TEAL }}>
              <p className="text-[13px] font-bold text-[#0b1c30]">{nextMeeting.subject}</p>
              {nextMeeting.accountName && (
                <p className="text-[11px] text-[#45464d] flex items-center gap-1 mt-0.5">
                  <span className="material-symbols-outlined text-[14px]">location_on</span>
                  {nextMeeting.accountName}
                </p>
              )}
            </div>
          </div>
        )}
        {count > 1 && (
          <p className="text-[11px] text-[#45464d] text-center">{count} meetings today</p>
        )}
      </div>
    </section>
  );
};

/** Recent Activity timeline */
const RecentActivityWidget: React.FC<{ activities: DashboardStats['recentActivities']; filter: ActivityFilter; setFilter: (f: ActivityFilter) => void }> = ({ activities, filter, setFilter }) => {
  const iconMap: Record<string, string> = {
    CALL: 'call', EMAIL: 'mail', MEETING: 'event', NOTE: 'edit_note',
    TASK: 'task_alt', FOLLOW_UP: 'follow_the_signs', WHATSAPP: 'chat',
    SITE_VISIT: 'location_on', LEAD_CREATED: 'person_add', OPPORTUNITY_CREATED: 'add_chart',
  };
  const colorMap: Record<string, string> = {
    CALL: TEAL, EMAIL: '#3B82F6', MEETING: TEAL, NOTE: '#45464d',
    TASK: '#3f465c', FOLLOW_UP: TEAL, SITE_VISIT: '#006a61',
    LEAD_CREATED: TEAL, OPPORTUNITY_CREATED: TEAL,
  };

  return (
    <section className="bg-white border border-[#e2e8f0] rounded-xl p-6">
      <h3 className="text-[18px] font-semibold text-[#0b1c30] mb-4">Recent Activity</h3>
      <div className="relative space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-0 before:w-[1px] before:bg-[#e2e8f0]">
        {activities.length === 0 && (
          <p className="text-[13px] text-[#45464d] opacity-60 text-center py-4">No recent activities</p>
        )}
        {activities.map((a) => {
          const icon = iconMap[a.activityType] ?? 'history';
          const bg = colorMap[a.activityType] ?? TEAL;
          return (
            <div key={a.id} className="relative flex gap-4 pl-8">
              <div className="absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white" style={{ background: bg + '1A' }}>
                <span className="material-symbols-outlined text-[14px]" style={{ color: bg }}>{icon}</span>
              </div>
              <div>
                <p className="text-[13px]"><span className="font-bold text-[#0b1c30]">{a.subject ?? a.activityType}</span></p>
                {a.description && <p className="text-[11px] text-[#45464d] mt-0.5 line-clamp-1">{a.description}</p>}
                <p className="text-[10px] text-[#45464d] opacity-60 mt-0.5">{new Date(a.createdAt).toLocaleString('en-MY', { dateStyle: 'short', timeStyle: 'short' })}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

/** AI Sales Assistant widget */
const AiSalesAssistantWidget: React.FC<{ briefing: any; loading: boolean; error: string | null; onRefresh: () => void }> = ({ briefing, loading, error, onRefresh }) => (
  <section className="relative overflow-hidden rounded-xl p-6 text-white" style={{ background: NAVY }}>
    <div className="absolute top-0 right-0 p-4 opacity-10">
      <span className="material-symbols-outlined text-[80px]">auto_awesome</span>
    </div>
    <div className="relative z-10">
      <h3 className="text-[18px] font-semibold flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined">bolt</span>
        AI Sales Assistant
      </h3>
      <div className="space-y-4">
        {briefing?.topPriority && (
          <div className="bg-white/10 p-3 rounded-lg border border-white/20">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#6bd8cb]">Next Best Action</p>
            <p className="text-[13px] mt-1">{briefing.topPriority}</p>
          </div>
        )}
        {briefing?.bullets?.length > 0 && (
          <div className="bg-white/10 p-3 rounded-lg border border-white/20 opacity-80">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#6bd8cb]">Insight</p>
            <p className="text-[13px] mt-1">{briefing.bullets[0]}</p>
          </div>
        )}
        {loading && (
          <div className="bg-white/10 p-3 rounded-lg border border-white/20 animate-pulse">
            <p className="text-[13px]">Generating insights...</p>
          </div>
        )}
        {error && !loading && (
          <div className="bg-white/10 p-3 rounded-lg border border-white/20">
            <p className="text-[13px] text-[#ffdad6]">Unable to load AI insights</p>
            <button onClick={onRefresh} className="text-[11px] underline mt-1">Retry</button>
          </div>
        )}
        {!briefing && !loading && !error && (
          <div className="bg-white/10 p-3 rounded-lg border border-white/20">
            <p className="text-[13px] opacity-60">No AI insights available</p>
          </div>
        )}
      </div>
    </div>
  </section>
);

// --- Main Dashboard ---

const DashboardInner: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myDeals, setMyDeals] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const { briefing, loading: briefingLoading, error: briefingError, fetch: fetchBriefing } = useDailyBriefing();
  const { layout } = useDashboardLayout();

  const isVisible = (widgetId: string): boolean => {
    const entry = layout.find(w => w.widgetId === widgetId);
    return entry ? entry.visible : true;
  };

  const now = new Date();

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

  const didAutoLoad = React.useRef(false);
  useEffect(() => {
    if (!didAutoLoad.current) { didAutoLoad.current = true; fetchBriefing(); }
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

  const activitiesDueToday = (stats?.followUpDueToday ?? 0) + (stats?.tasks?.overdueCount ?? 0);

  return (
    <div className="min-h-full p-6 space-y-4 max-w-[1440px] mx-auto" style={{ background: SURFACE }}>
      {/* Welcome Header */}
      <WelcomeHeader
        userName={undefined}
        datePreset={datePreset}
        setDatePreset={setDatePreset}
        myDeals={myDeals}
        setMyDeals={setMyDeals}
        activitiesDue={activitiesDueToday}
      />

      {/* KPI Strip */}
      {isVisible('kpi_cards') && (
        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <CrmKpiCard
            label="My Leads"
            value={loading ? '—' : numFmt(stats?.totalActiveLeads ?? 0)}
            icon="person_add"
            trend={delta.leadsDelta > 0 ? 'up' : delta.leadsDelta < 0 ? 'down' : 'flat'}
            trendPercent={delta.leadsDelta}
            trendPositive={delta.leadsDelta >= 0}
          />
          <CrmKpiCard
            label="Follow Ups"
            value={loading ? '—' : numFmt(stats?.followUpDueToday ?? 0)}
            icon="schedule"
            trendLabel={stats?.followUpDueToday ? 'Urgent' : undefined}
            trendPositive={false}
          />
          <CrmKpiCard
            label="Open Opps"
            value={loading ? '—' : numFmt(stats?.totalOpenOpps ?? 0)}
            icon="pending_actions"
            trend={delta.oppsDelta > 0 ? 'up' : delta.oppsDelta < 0 ? 'down' : 'flat'}
            trendPercent={delta.oppsDelta}
            trendPositive={delta.oppsDelta >= 0}
          />
          <CrmKpiCard
            label="Overdue"
            value={loading ? '—' : numFmt(stats?.overdueDeals ?? 0)}
            icon="priority_high"
            trendPositive={false}
            highlight
          />
          <CrmKpiCard
            label="Meetings Today"
            value={loading ? '—' : numFmt(stats?.meetingsToday?.count ?? 0)}
            icon="event"
            subtitle={stats?.meetingsToday?.nextMeeting ? `Next at ${new Date(stats.meetingsToday.nextMeeting.scheduledAt).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' })}` : undefined}
          />
          <CrmKpiCard
            label="Monthly Conv."
            value={loading ? '—' : numFmt(stats?.monthlyConversions?.count ?? 0)}
            icon="emoji_events"
            trend={stats?.monthlyConversions?.percentage ? 'up' : 'flat'}
            trendLabel={stats?.monthlyConversions ? `${stats.monthlyConversions.percentage}% Target` : undefined}
            trendPositive={true}
            highlight
          />
        </section>
      )}

      {/* Main Grid: Left 8 cols, Right 4 cols */}
      <div className="grid grid-cols-12 gap-4 items-start">
        {/* Left Column */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          {/* Hot Leads */}
          {isVisible('hot_leads') && !loading && stats?.hotLeads && (
            <HotLeadsSection leads={stats.hotLeads} />
          )}

          {/* Follow-ups + Tasks side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isVisible('upcoming_activities') && (
              <FollowUpsWidget items={stats?.upcomingFollowUps ?? []} followUpDueToday={stats?.followUpDueToday ?? 0} />
            )}
            {isVisible('my_tasks') && (
              <MyTasksWidget tasks={stats?.tasks ?? { overdue: [], inProgress: [], overdueCount: 0, inProgressCount: 0 }} />
            )}
          </div>

          {/* Pipeline */}
          {isVisible('opportunity_funnel') && (
            <PipelineWidget stages={stats?.opportunitiesByStage ?? []} />
          )}
        </div>

        {/* Right Column */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          {/* AI Sales Assistant */}
          {isVisible('ai_briefing') && (
            <AiSalesAssistantWidget briefing={briefing} loading={briefingLoading} error={briefingError} onRefresh={fetchBriefing} />
          )}

          {/* Calendar */}
          {isVisible('calendar') && (
            <CalendarWidget meetingsToday={stats?.meetingsToday ?? { count: 0, nextMeeting: null }} />
          )}

          {/* Recent Activity */}
          {isVisible('recent_activities') && (
            <RecentActivityWidget activities={filteredActivities} filter={activityFilter} setFilter={setActivityFilter} />
          )}
        </div>
      </div>
    </div>
  );
};

const CrmDashboard: React.FC = () => (
  <DashboardLayoutProvider>
    <DashboardInner />
  </DashboardLayoutProvider>
);

export default CrmDashboard;