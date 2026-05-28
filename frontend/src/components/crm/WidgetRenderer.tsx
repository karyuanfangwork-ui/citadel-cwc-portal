import React from 'react';

// Individual widget components — each receives its data via props

export const KpiHeroWidget: React.FC = () => {
  // This widget already exists in CrmDashboard; we'll wrap it
  return <div id="widget-kpi-hero">KPI Hero Banner</div>;
};

export const TodayPrioritiesWidget: React.FC = () => {
  return <div id="widget-today-priorities">Today's Priorities</div>;
};

export const MyPerformanceWidget: React.FC = () => {
  return <div id="widget-my-performance">My Performance</div>;
};

export const PipelineFunnelWidget: React.FC = () => {
  return <div id="widget-pipeline-funnel">Pipeline Funnel</div>;
};

export const RecentActivityWidget: React.FC = () => {
  return <div id="widget-recent-activity">Recent Activity</div>;
};

export const WonLostWidget: React.FC = () => {
  return <div id="widget-won-lost">Won/Lost This Month</div>;
};

export const StaleLeadsWidget: React.FC = () => {
  return <div id="widget-stale-leads">Stale Leads Alert</div>;
};

export const TeamLeaderboardWidget: React.FC = () => {
  return <div id="widget-team-leaderboard">Team Leaderboard</div>;
};

export const QuotaAttainmentWidget: React.FC = () => {
  return <div id="widget-quota-attainment">Quota Attainment</div>;
};

export const AiBriefingWidget: React.FC = () => {
  return <div id="widget-ai-briefing">AI Daily Briefing</div>;
};

// Widget component map
const WIDGET_MAP: Record<string, React.FC> = {
  kpi_hero: KpiHeroWidget,
  today_priorities: TodayPrioritiesWidget,
  my_performance: MyPerformanceWidget,
  pipeline_funnel: PipelineFunnelWidget,
  recent_activity: RecentActivityWidget,
  won_lost: WonLostWidget,
  stale_leads: StaleLeadsWidget,
  team_leaderboard: TeamLeaderboardWidget,
  quota_attainment: QuotaAttainmentWidget,
  ai_briefing: AiBriefingWidget,
};

interface WidgetRendererProps {
  widgetId: string;
  title?: string;
}

const WidgetRenderer: React.FC<WidgetRendererProps> = ({ widgetId, title }) => {
  const WidgetComponent = WIDGET_MAP[widgetId];
  if (!WidgetComponent) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af' }}>
        Unknown widget: {widgetId}
      </div>
    );
  }
  return <WidgetComponent />;
};

export default WidgetRenderer;
export { WIDGET_MAP };