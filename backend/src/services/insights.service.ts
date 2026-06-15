/**
 * Insights Service
 *
 * Centralized aggregation service with Redis caching.
 * Provides cross-module KPIs, ITSM analytics, CRM overview, and Credit overview.
 */

import prisma from '../utils/prisma';
import { cacheGetJSON, cacheSetJSON } from '../utils/cache';
import { RESOLVED_STATUSES, CLOSED_STATUSES } from '../constants/requestStatuses';

// Module-team mapping — assignedTeam values mapped to module names
const MODULE_TEAMS: Record<string, string> = {
  IT: 'IT',
  HR: 'HR',
  FINANCE: 'Finance',
  CRM: 'CRM',
  CREDIT: 'Credit',
};

// ── Type helpers ─────────────────────────────────────────────────────────────

interface DateFilter {
  createdAt?: { gte?: Date; lte?: Date };
}

interface OverviewData {
  totalOpen: number;
  slaBreachRate: number;
  avgResolutionHours: number | null;
  byModule: Array<{ module: string; count: number }>;
}

interface ItsmSummaryData {
  total: number;
  open: number;
  resolved: number;
  unassigned: number;
  avgResolutionHours: number | null;
}

interface TrendBucket {
  bucket: Date;
  total: number;
  resolved: number;
  breached: number;
}

interface ServiceDeskBucket {
  serviceDeskId: string | null;
  name: string | null;
  code: string | null;
  count: number;
}

interface PriorityBucket {
  priority: string;
  count: number;
}

interface AgentWorkloadItem {
  assignedToId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  openTickets: number;
}

interface SlaComplianceData {
  withinSla: number;
  breached: number;
  noSla: number;
}

interface CrmOverviewData {
  totalLeads: number;
  totalOpportunities: number;
  conversionRate: number;
  pipelineValue: number;
  pipelineStages: Array<{
    stageId: string;
    stageName: string;
    probability: number;
    dealCount: number;
    totalValue: number;
  }>;
}

interface CreditOverviewData {
  totalApplications: number;
  byState: Array<{ state: string; count: number }>;
  totalRequestedAmount: number;
  approvedCount: number;
  rejectedCount: number;
  outstandingCount: number;
}

// ── Insights Service class ────────────────────────────────────────────────────

class InsightsService {
  // ── Overview KPIs ────────────────────────────────────────────────────────

  async getOverview(role: string, userId: string): Promise<OverviewData> {
    const cacheKey = `insights:overview:${role}:${userId}`;
    const cached = await cacheGetJSON<OverviewData>(cacheKey);
    if (cached) return cached;

    // Total open requests
    const totalOpen = await prisma.request.count({
      where: {
        deletedAt: null,
        status: { notIn: CLOSED_STATUSES },
      },
    });

    // SLA breach rate for last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const openFilter = {
      deletedAt: null,
      createdAt: { gte: thirtyDaysAgo },
      status: { notIn: CLOSED_STATUSES },
    };

    const [withinSla, breached, noSla] = await Promise.all([
      prisma.request.count({
        where: { ...openFilter, slaDueAt: { gt: new Date() } },
      }),
      prisma.request.count({
        where: { ...openFilter, slaDueAt: { lte: new Date() } },
      }),
      prisma.request.count({
        where: { ...openFilter, slaDueAt: null },
      }),
    ]);

    const totalSla = withinSla + breached + noSla;
    const slaBreachRate = totalSla > 0 ? Math.round((breached / totalSla) * 100) / 100 : 0;

    // Avg resolution time
    const resolvedRequests = await prisma.request.findMany({
      where: {
        deletedAt: null,
        resolvedAt: { not: null },
        status: { in: RESOLVED_STATUSES },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    });

    let avgResolutionHours: number | null = null;
    if (resolvedRequests.length > 0) {
      const totalMs = resolvedRequests.reduce((sum, r) => {
        return sum + (r.resolvedAt!.getTime() - r.createdAt.getTime());
      }, 0);
      avgResolutionHours =
        Math.round((totalMs / resolvedRequests.length / (1000 * 60 * 60)) * 100) / 100;
    }

    // Module-specific counts (by assignedTeam)
    const byModuleRaw = await prisma.request.groupBy({
      by: ['assignedTeam'],
      where: {
        deletedAt: null,
        status: { notIn: CLOSED_STATUSES },
        assignedTeam: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const byModule = byModuleRaw.map((row) => ({
      module: MODULE_TEAMS[row.assignedTeam!] || row.assignedTeam!,
      count: row._count.id,
    }));

    const data: OverviewData = {
      totalOpen,
      slaBreachRate,
      avgResolutionHours,
      byModule,
    };

    await cacheSetJSON(cacheKey, data, 300);
    return data;
  }

  // ── ITSM Summary ──────────────────────────────────────────────────────────

  async getItsmSummary(dateFilter: DateFilter): Promise<ItsmSummaryData> {
    const from = (dateFilter.createdAt as any)?.gte?.toISOString() || 'all';
    const to = (dateFilter.createdAt as any)?.lte?.toISOString() || 'all';
    const cacheKey = `insights:itsm:summary:${from}:${to}`;
    const cached = await cacheGetJSON<ItsmSummaryData>(cacheKey);
    if (cached) return cached;

    const [total, openRequests, resolvedRequests, unassignedRequests, avgResolution] =
      await Promise.all([
        prisma.request.count({ where: { deletedAt: null, ...dateFilter } }),
        prisma.request.count({
          where: { deletedAt: null, status: { notIn: CLOSED_STATUSES }, ...dateFilter },
        }),
        prisma.request.count({
          where: { deletedAt: null, status: { in: RESOLVED_STATUSES }, ...dateFilter },
        }),
        prisma.request.count({
          where: {
            deletedAt: null,
            assignedToId: null,
            status: { notIn: CLOSED_STATUSES },
            ...dateFilter,
          },
        }),
        prisma.request.findMany({
          where: {
            deletedAt: null,
            resolvedAt: { not: null },
            ...dateFilter,
          },
          select: { createdAt: true, resolvedAt: true },
        }),
      ]);

    let avgResolutionHours: number | null = null;
    if (avgResolution.length > 0) {
      const totalMs = avgResolution.reduce((sum, r) => {
        return sum + (r.resolvedAt!.getTime() - r.createdAt.getTime());
      }, 0);
      avgResolutionHours =
        Math.round((totalMs / avgResolution.length / (1000 * 60 * 60)) * 100) / 100;
    }

    const data: ItsmSummaryData = {
      total,
      open: openRequests,
      resolved: resolvedRequests,
      unassigned: unassignedRequests,
      avgResolutionHours,
    };

    await cacheSetJSON(cacheKey, data, 300);
    return data;
  }

  // ── ITSM Trends ───────────────────────────────────────────────────────────

  async getItsmTrends(
    from: Date,
    to: Date,
    granularity: 'day' | 'week' | 'month',
  ): Promise<TrendBucket[]> {
    const cacheKey = `insights:itsm:trends:${from.toISOString()}:${to.toISOString()}:${granularity}`;
    const cached = await cacheGetJSON<TrendBucket[]>(cacheKey);
    if (cached) return cached;

    // Map granularity to PostgreSQL date_trunc values
    const truncMap: Record<string, string> = {
      day: 'day',
      week: 'week',
      month: 'month',
    };
    const truncVal = truncMap[granularity] || 'day';

    const rows = await prisma.$queryRaw<
      Array<{
        bucket: Date;
        total: bigint;
        resolved: bigint;
        breached: bigint;
      }>
    >`
      SELECT
        date_trunc(${truncVal}, "createdAt") as bucket,
        count(*) as total,
        count(*) FILTER (WHERE "resolvedAt" IS NOT NULL) as resolved,
        count(*) FILTER (WHERE "slaDueAt" IS NOT NULL AND "slaDueAt" < NOW() AND "resolvedAt" IS NULL AND "deletedAt" IS NULL) as breached
      FROM "requests"
      WHERE "deletedAt" IS NULL AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY bucket
      ORDER BY bucket
    `;

    const data: TrendBucket[] = rows.map((row) => ({
      bucket: row.bucket,
      total: Number(row.total),
      resolved: Number(row.resolved),
      breached: Number(row.breached),
    }));

    await cacheSetJSON(cacheKey, data, 300);
    return data;
  }

  // ── ITSM By Service Desk ──────────────────────────────────────────────────

  async getItsmByServiceDesk(dateFilter: DateFilter): Promise<ServiceDeskBucket[]> {
    const from = (dateFilter.createdAt as any)?.gte?.toISOString() || 'all';
    const to = (dateFilter.createdAt as any)?.lte?.toISOString() || 'all';
    const cacheKey = `insights:itsm:by-service-desk:${from}:${to}`;
    const cached = await cacheGetJSON<ServiceDeskBucket[]>(cacheKey);
    if (cached) return cached;

    const grouped = await prisma.request.groupBy({
      by: ['serviceDeskId'],
      where: { deletedAt: null, ...dateFilter },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const serviceDeskIds = grouped
      .map((g) => g.serviceDeskId)
      .filter((id): id is string => id !== null);

    const serviceDesks = await prisma.serviceDesk.findMany({
      where: { id: { in: serviceDeskIds } },
      select: { id: true, name: true, code: true },
    });

    const sdMap = new Map(serviceDesks.map((sd) => [sd.id, sd]));

    const data: ServiceDeskBucket[] = grouped.map((g) => {
      const sd = g.serviceDeskId ? sdMap.get(g.serviceDeskId) : null;
      return {
        serviceDeskId: g.serviceDeskId,
        name: sd?.name ?? null,
        code: sd?.code ?? null,
        count: g._count.id,
      };
    });

    await cacheSetJSON(cacheKey, data, 300);
    return data;
  }

  // ── ITSM By Priority ──────────────────────────────────────────────────────

  async getItsmByPriority(dateFilter: DateFilter): Promise<PriorityBucket[]> {
    const from = (dateFilter.createdAt as any)?.gte?.toISOString() || 'all';
    const to = (dateFilter.createdAt as any)?.lte?.toISOString() || 'all';
    const cacheKey = `insights:itsm:by-priority:${from}:${to}`;
    const cached = await cacheGetJSON<PriorityBucket[]>(cacheKey);
    if (cached) return cached;

    const grouped = await prisma.request.groupBy({
      by: ['priority'],
      where: { deletedAt: null, ...dateFilter },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const data: PriorityBucket[] = grouped.map((g) => ({
      priority: g.priority,
      count: g._count.id,
    }));

    await cacheSetJSON(cacheKey, data, 300);
    return data;
  }

  // ── ITSM Agent Workload ──────────────────────────────────────────────────

  async getItsmAgentWorkload(): Promise<AgentWorkloadItem[]> {
    const cacheKey = 'insights:itsm:agent-workload';
    const cached = await cacheGetJSON<AgentWorkloadItem[]>(cacheKey);
    if (cached) return cached;

    const grouped = await prisma.request.groupBy({
      by: ['assignedToId'],
      where: {
        deletedAt: null,
        assignedToId: { not: null },
        status: { notIn: CLOSED_STATUSES },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const agentIds = grouped
      .map((g) => g.assignedToId)
      .filter((id): id is string => id !== null);

    const agents = await prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    const agentMap = new Map(agents.map((a) => [a.id, a]));

    const data: AgentWorkloadItem[] = grouped.map((g) => {
      const agent = g.assignedToId ? agentMap.get(g.assignedToId) : null;
      return {
        assignedToId: g.assignedToId,
        firstName: agent?.firstName ?? null,
        lastName: agent?.lastName ?? null,
        email: agent?.email ?? null,
        openTickets: g._count.id,
      };
    });

    await cacheSetJSON(cacheKey, data, 300);
    return data;
  }

  // ── ITSM SLA Compliance ──────────────────────────────────────────────────

  async getItsmSlaCompliance(dateFilter: DateFilter): Promise<SlaComplianceData> {
    const from = (dateFilter.createdAt as any)?.gte?.toISOString() || 'all';
    const to = (dateFilter.createdAt as any)?.lte?.toISOString() || 'all';
    const cacheKey = `insights:itsm:sla-compliance:${from}:${to}`;
    const cached = await cacheGetJSON<SlaComplianceData>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const openFilter = {
      deletedAt: null,
      status: { notIn: CLOSED_STATUSES },
      ...dateFilter,
    };

    const [withinSla, breached, noSla] = await Promise.all([
      prisma.request.count({
        where: { ...openFilter, slaDueAt: { gt: now } },
      }),
      prisma.request.count({
        where: { ...openFilter, slaDueAt: { lte: now } },
      }),
      prisma.request.count({
        where: { ...openFilter, slaDueAt: null },
      }),
    ]);

    const data: SlaComplianceData = { withinSla, breached, noSla };

    await cacheSetJSON(cacheKey, data, 300);
    return data;
  }

  // ── CRM Overview ──────────────────────────────────────────────────────────

  async getCrmOverview(role: string, userId: string): Promise<CrmOverviewData> {
    const cacheKey = `insights:crm:overview:${role}:${userId}`;
    const cached = await cacheGetJSON<CrmOverviewData>(cacheKey);
    if (cached) return cached;

    const ownerFilter = userId ? { ownerId: userId } : {};

    const [totalLeads, totalOpportunities, leadsByStatus, oppByStage] = await Promise.all([
      // Total leads (active, not converted/lost)
      prisma.crmLead.count({
        where: { status: { notIn: ['CONVERTED', 'LOST'] }, deletedAt: null, ...ownerFilter },
      }),
      // Total opportunities
      prisma.crmOpportunity.count({
        where: { deletedAt: null, ...ownerFilter },
      }),
      // Leads by status for conversion rate
      prisma.crmLead.groupBy({
        by: ['status'],
        _count: true,
        where: { deletedAt: null, ...ownerFilter },
      }),
      // Pipeline stages distribution
      prisma.crmOpportunity.groupBy({
        by: ['stageId'],
        _count: true,
        _sum: { value: true },
        where: { deletedAt: null, ...ownerFilter },
      }),
    ]);

    // Conversion rate
    const totalAllLeads = leadsByStatus.reduce((sum, r) => sum + r._count, 0);
    const convertedLeads =
      leadsByStatus.find((r) => r.status === 'CONVERTED')?._count || 0;
    const conversionRate =
      totalAllLeads > 0 ? Math.round((convertedLeads / totalAllLeads) * 100) : 0;

    // Pipeline value (active deals only)
    const pipelineAggregate = await prisma.crmOpportunity.aggregate({
      _sum: { value: true },
      where: {
        stage: { isWonStage: false, isLostStage: false },
        deletedAt: null,
        ...ownerFilter,
      },
    });
    const pipelineValue = Number(pipelineAggregate._sum.value || 0);

    // Fetch stage details for pipeline breakdown
    const stageIds = oppByStage.map((s) => s.stageId);
    const stages = await prisma.crmPipelineStage.findMany({
      where: { id: { in: stageIds } },
      select: { id: true, name: true, probability: true },
    });
    const stageMap = new Map(stages.map((s) => [s.id, s]));

    const pipelineStages = oppByStage.map((row) => {
      const stage = stageMap.get(row.stageId);
      return {
        stageId: row.stageId,
        stageName: stage?.name ?? 'Unknown',
        probability: stage?.probability ?? 0,
        dealCount: row._count,
        totalValue: Number(row._sum.value || 0),
      };
    });

    const data: CrmOverviewData = {
      totalLeads,
      totalOpportunities,
      conversionRate,
      pipelineValue,
      pipelineStages,
    };

    await cacheSetJSON(cacheKey, data, 300);
    return data;
  }

  // ── Credit Overview ───────────────────────────────────────────────────────

  async getCreditOverview(role: string, userId: string): Promise<CreditOverviewData> {
    const cacheKey = `insights:credit:overview:${role}:${userId}`;
    const cached = await cacheGetJSON<CreditOverviewData>(cacheKey);
    if (cached) return cached;

    // Total applications
    const totalApplications = await prisma.creditApplication.count({
      where: { deletedAt: null },
    });

    // Applications by state
    const byStateRaw = await prisma.creditApplication.groupBy({
      by: ['state'],
      where: { deletedAt: null },
      _count: true,
    });

    const byState = byStateRaw.map((row) => ({
      state: row.state,
      count: row._count,
    }));

    // Total requested amount
    const amountAggregate = await prisma.creditApplication.aggregate({
      _sum: { requestedAmount: true },
      where: { deletedAt: null },
    });
    const totalRequestedAmount = Number(amountAggregate._sum.requestedAmount || 0);

    // Counts for key states
    const approvedCount = byStateRaw.find((r) => r.state === 'APPROVED')?._count || 0;
    const rejectedCount = byStateRaw.find((r) => r.state === 'REJECTED')?._count || 0;
    const outstandingCount = byStateRaw
      .filter((r) => !['APPROVED', 'REJECTED', 'CLOSED', 'WITHDRAWN'].includes(r.state))
      .reduce((sum, r) => sum + r._count, 0);

    const data: CreditOverviewData = {
      totalApplications,
      byState,
      totalRequestedAmount,
      approvedCount,
      rejectedCount,
      outstandingCount,
    };

    await cacheSetJSON(cacheKey, data, 300);
    return data;
  }
}

export default new InsightsService();