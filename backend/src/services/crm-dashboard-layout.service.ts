import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default widget definitions
const WIDGET_REGISTRY = [
  { widgetId: 'kpi_hero', title: 'KPI Hero Banner', size: 'full', defaultOrder: 0, roles: ['ALL'] },
  { widgetId: 'today_priorities', title: "Today's Priorities", size: 'medium', defaultOrder: 1, roles: ['ALL'] },
  { widgetId: 'my_performance', title: 'My Performance', size: 'small', defaultOrder: 2, roles: ['AGENT'] },
  { widgetId: 'pipeline_funnel', title: 'Pipeline Funnel', size: 'medium', defaultOrder: 3, roles: ['ALL'] },
  { widgetId: 'recent_activity', title: 'Recent Activity', size: 'medium', defaultOrder: 4, roles: ['ALL'] },
  { widgetId: 'won_lost', title: 'Won/Lost This Month', size: 'small', defaultOrder: 5, roles: ['ALL'] },
  { widgetId: 'stale_leads', title: 'Stale Leads Alert', size: 'small', defaultOrder: 6, roles: ['AGENT'] },
  { widgetId: 'team_leaderboard', title: 'Team Leaderboard', size: 'medium', defaultOrder: 7, roles: ['ADMIN', 'MANAGER'] },
  { widgetId: 'quota_attainment', title: 'Quota Attainment', size: 'medium', defaultOrder: 8, roles: ['ADMIN', 'MANAGER'] },
  { widgetId: 'ai_briefing', title: 'AI Daily Briefing', size: 'full', defaultOrder: 9, roles: ['ALL'] },
];

// Default layouts per role category
const DEFAULT_LAYOUTS: Record<string, Array<{ widgetId: string; order: number; size: string; visible: boolean }>> = {
  REP: [
    { widgetId: 'kpi_hero', order: 0, size: 'full', visible: true },
    { widgetId: 'today_priorities', order: 1, size: 'medium', visible: true },
    { widgetId: 'my_performance', order: 2, size: 'small', visible: true },
    { widgetId: 'pipeline_funnel', order: 3, size: 'medium', visible: true },
    { widgetId: 'recent_activity', order: 4, size: 'medium', visible: true },
    { widgetId: 'won_lost', order: 5, size: 'small', visible: true },
    { widgetId: 'stale_leads', order: 6, size: 'small', visible: true },
    { widgetId: 'ai_briefing', order: 7, size: 'full', visible: true },
  ],
  MANAGER: [
    { widgetId: 'kpi_hero', order: 0, size: 'full', visible: true },
    { widgetId: 'today_priorities', order: 1, size: 'medium', visible: true },
    { widgetId: 'pipeline_funnel', order: 2, size: 'medium', visible: true },
    { widgetId: 'team_leaderboard', order: 3, size: 'medium', visible: true },
    { widgetId: 'quota_attainment', order: 4, size: 'medium', visible: true },
    { widgetId: 'recent_activity', order: 5, size: 'medium', visible: true },
    { widgetId: 'won_lost', order: 6, size: 'small', visible: true },
    { widgetId: 'ai_briefing', order: 7, size: 'full', visible: true },
  ],
};

/**
 * Get the widget registry (all available widgets)
 */
export function getWidgetRegistry() {
  return WIDGET_REGISTRY;
}

/**
 * Get default layout for a given role
 */
export function getDefaultLayout(role: string) {
  if (role === 'ADMIN' || role === 'MANAGER') return DEFAULT_LAYOUTS.MANAGER;
  return DEFAULT_LAYOUTS.REP;
}

/**
 * Get a user's dashboard layout (or default if none saved)
 */
export async function getDashboardLayout(userId: string, role: string) {
  const saved = await prisma.crmDashboardLayout.findUnique({ where: { userId } });
  if (saved) {
    return { layout: saved.layout as Array<Record<string, unknown>>, isDefault: false, updatedAt: saved.updatedAt };
  }
  // Return default layout based on role
  return { layout: getDefaultLayout(role), isDefault: true, updatedAt: null };
}

/**
 * Save (upsert) a user's dashboard layout
 */
export async function saveDashboardLayout(
  userId: string,
  layout: Array<{ widgetId: string; order: number; size: string; visible: boolean }>
) {
  return prisma.crmDashboardLayout.upsert({
    where: { userId },
    create: { userId, layout: layout as any },
    update: { layout: layout as any },
  });
}

/**
 * Reset a user's dashboard layout to default (delete saved layout)
 */
export async function resetDashboardLayout(userId: string) {
  try {
    await prisma.crmDashboardLayout.delete({ where: { userId } });
  } catch { /* ignore if not found */ }
  return { success: true };
}

export default {
  getWidgetRegistry,
  getDefaultLayout,
  getDashboardLayout,
  saveDashboardLayout,
  resetDashboardLayout,
};