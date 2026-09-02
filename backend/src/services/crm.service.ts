import { Prisma } from '@prisma/client';
import { generateWinLossDebrief } from './crm-ai.service';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/error.middleware';
import { applyOwnerScope } from './crm-scope.service';

import prisma from '../utils/prisma';

// ============================================================================
// DASHBOARD STATISTICS
// ============================================================================

export interface CrmDashboardScope {
  currentUserId: string;
  visibleOwnerIds: string[] | null;
  myDeals?: boolean;
}

export async function getDashboardStats(
  scope: CrmDashboardScope,
  dateFrom?: Date,
  dateTo?: Date,
) {
  const effectiveOwnerIds = scope.myDeals ? [scope.currentUserId] : scope.visibleOwnerIds;
  const scopedOwnerIds = effectiveOwnerIds ?? [];
  const ownerFilter = effectiveOwnerIds === null ? {} : { ownerId: { in: scopedOwnerIds } };
  const contactOwnerFilter = effectiveOwnerIds === null
    ? {}
    : { account: { ownerId: { in: scopedOwnerIds } } };
  const activityOwnerFilter = effectiveOwnerIds === null
    ? {}
    : {
        OR: [
          { userId: { in: scopedOwnerIds } },
          { account: { ownerId: { in: scopedOwnerIds } } },
          { contact: { account: { ownerId: { in: scopedOwnerIds } } } },
          { lead: { ownerId: { in: scopedOwnerIds } } },
          { opportunity: { ownerId: { in: scopedOwnerIds } } },
        ],
      };
  const ownerScopedActivityFilter = effectiveOwnerIds === null ? {} : activityOwnerFilter;
  const now = dateTo ?? new Date();
  const windowStart = dateFrom ?? new Date(now.getTime() - 30 * 86400_000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalAccounts,
    totalContacts,
    totalLeads,
    totalOpportunities,
    pipelineValue,
    wonDeals,
    lostDeals,
    recentActivities,
    leadsByStatus,
    opportunitiesByStageRaw,
    followUpDueToday,
    staleLeads,
    overdueDeals,
    monthlyTrend,
    pipelinesWithValues,
    upcomingFollowUpsRaw,
    wonOppsForVelocity,
    // Phase 3 additions — Sales Rep Dashboard
    totalActiveLeads,
    totalOpenOpps,
    meetingsTodayCount,
    nextMeetingRaw,
    monthlyConversionsCount,
    quotaTargetRaw,
    hotLeadsRaw,
    overdueTasksRaw,
    inProgressTasksRaw,
  ] = await Promise.all([
    prisma.crmAccount.count({ where: { isActive: true, deletedAt: null, ...ownerFilter } }),
    prisma.crmContact.count({ where: { isActive: true, deletedAt: null, ...contactOwnerFilter } }),
    prisma.crmLead.count({ where: { status: { notIn: ['CONVERTED', 'LOST'] }, deletedAt: null, createdAt: { gte: windowStart, lte: now }, ...ownerFilter } }),
    prisma.crmOpportunity.count({ where: { deletedAt: null, createdAt: { gte: windowStart, lte: now }, ...ownerFilter } }),
    prisma.crmOpportunity.aggregate({
      _sum: { value: true },
      where: {
        stage: { isWonStage: false, isLostStage: false },
        deletedAt: null,
        createdAt: { gte: windowStart, lte: now },
        ...ownerFilter,
      },
    }),
    prisma.crmOpportunity.aggregate({
      _sum: { value: true },
      _count: true,
      where: { stage: { isWonStage: true }, deletedAt: null, wonAt: { gte: windowStart, lte: now }, ...ownerFilter },
    }),
    prisma.crmOpportunity.aggregate({
      _sum: { value: true },
      _count: true,
      where: { stage: { isLostStage: true }, deletedAt: null, lostAt: { gte: windowStart, lte: now }, ...ownerFilter },
    }),
    prisma.crmActivity.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      where: ownerScopedActivityFilter,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        opportunity: { select: { id: true, name: true } },
      },
    }),
    prisma.crmLead.groupBy({
      by: ['status'],
      _count: true,
      where: { deletedAt: null, ...ownerFilter },
    }),
    prisma.crmOpportunity.groupBy({
      by: ['stageId'],
      _count: true,
      _sum: { value: true },
      where: { deletedAt: null, ...ownerFilter },
    }),
    // Follow-ups due today
    prisma.crmLead.count({
      where: {
        followUpDate: { gte: todayStart, lt: todayEnd },
        status: { notIn: ['CONVERTED', 'LOST'] },
        deletedAt: null,
        ...ownerFilter,
      },
    }),
    // Stale leads (no activity in 7 days)
    prisma.crmLead.count({
      where: {
        status: { notIn: ['CONVERTED', 'LOST'] },
        deletedAt: null,
        ...ownerFilter,
        activities: { none: { createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } } },
      },
    }),
    // Overdue deals (past expected close date, not won/lost)
    prisma.crmOpportunity.count({
      where: {
        expectedCloseDate: { lt: now },
        wonAt: null,
        lostAt: null,
        deletedAt: null,
        ...ownerFilter,
      },
    }),
    (async () => {
      // Determine how many months to show based on date window
      const windowMs = now.getTime() - windowStart.getTime();
      const windowMonths = Math.max(1, Math.min(6, Math.ceil(windowMs / (30 * 86400_000))));

      const months: { month: string; wonCount: number; wonValue: number }[] = [];
      for (let i = windowMonths - 1; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const result = await prisma.crmOpportunity.aggregate({
          _sum: { value: true },
          _count: true,
          where: {
            stage: { isWonStage: true },
            updatedAt: { gte: start, lt: end },
            deletedAt: null,
            ...ownerFilter,
          },
        });
        months.push({
          month: start.toLocaleString('en-MY', { month: 'short' }),
          wonCount: result._count,
          wonValue: Number(result._sum.value || 0),
        });
      }
      return months;
    })(),
    prisma.crmPipeline.findMany({
      where: { isActive: true },
      select: {
        name: true,
        opportunities: {
          where: {
            stage: { isWonStage: false, isLostStage: false },
            deletedAt: null,
            ...ownerFilter,
          },
          select: { value: true },
        },
      },
    }),
    prisma.crmLead.findMany({
      take: 5,
      orderBy: { followUpDate: 'asc' },
      where: {
        followUpDate: { gte: todayStart },
        status: { notIn: ['CONVERTED', 'LOST'] },
        deletedAt: null,
        ...ownerFilter,
      },
      select: {
        id: true,
        title: true,
        followUpDate: true,
        followUpNote: true,
        contactName: true,
      },
    }),
    // Avg velocity: days from creation to won
    prisma.crmOpportunity.findMany({
      select: { createdAt: true, wonAt: true },
      where: {
        stage: { isWonStage: true },
        wonAt: { not: null },
        deletedAt: null,
        ...(dateFrom || dateTo ? { wonAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
        ...ownerFilter,
      },
      take: 100,
    }),
    // ---- Phase 3: Sales Rep Dashboard additions ----
    // 1. Total active leads (non-windowed — all non-CONVERTED/LOST for owner)
    prisma.crmLead.count({
      where: { status: { notIn: ['CONVERTED', 'LOST'] }, deletedAt: null, ...ownerFilter },
    }),
    // 2. Total open opps (non-windowed — active stages)
    prisma.crmOpportunity.count({
      where: { stage: { isWonStage: false, isLostStage: false }, deletedAt: null, ...ownerFilter },
    }),
    // 3. Meetings today count
    prisma.crmActivity.count({
      where: {
        activityType: 'MEETING',
        scheduledAt: { gte: todayStart, lt: todayEnd },
        ...ownerScopedActivityFilter,
      },
    }),
    // 4. Next upcoming meeting (today or future)
    prisma.crmActivity.findFirst({
      where: {
        activityType: 'MEETING',
        scheduledAt: { gte: todayStart },
        ...ownerScopedActivityFilter,
      },
      orderBy: { scheduledAt: 'asc' },
      select: {
        id: true,
        subject: true,
        scheduledAt: true,
        description: true,
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        opportunity: { select: { id: true, name: true } },
      },
    }),
    // 5. Monthly conversions count (leads converted this month)
    prisma.crmLead.count({
      where: {
        status: 'CONVERTED',
        convertedAt: { gte: monthStart, lt: now },
        deletedAt: null,
        ...ownerFilter,
      },
    }),
    // 6. Current user's quota for this month
    effectiveOwnerIds !== null
      ? prisma.crmQuota.findFirst({
          where: {
            userId: scope.currentUserId,
            periodType: 'MONTHLY',
            period: now.toISOString().slice(0, 7), // "2026-06"
          },
          select: { targetAmount: true },
        })
      : Promise.resolve(null),
    // 7. Hot leads — top 5 by ruleScore/aiScore
    prisma.crmLead.findMany({
      take: 5,
      where: { status: { notIn: ['CONVERTED', 'LOST'] }, deletedAt: null, ...ownerFilter },
      orderBy: [{ ruleScore: 'desc' }, { aiScore: 'desc' }],
      select: {
        id: true,
        title: true,
        contactName: true,
        estimatedValue: true,
        ruleScore: true,
        aiScore: true,
        source: true,
      },
    }),
    // 8. Overdue tasks (scheduledAt < now, not completed)
    prisma.crmActivity.findMany({
      where: {
        activityType: 'TASK',
        completedAt: null,
        scheduledAt: { lt: now },
        ...ownerScopedActivityFilter,
      },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
      select: {
        id: true,
        subject: true,
        description: true,
        scheduledAt: true,
        lead: { select: { id: true, title: true } },
        opportunity: { select: { id: true, name: true } },
      },
    }),
    // 9. In-progress tasks (not completed, scheduled >= now or no schedule)
    prisma.crmActivity.findMany({
      where: {
        activityType: 'TASK',
        completedAt: null,
        scheduledAt: { gte: now },
        ...ownerScopedActivityFilter,
      },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
      select: {
        id: true,
        subject: true,
        description: true,
        scheduledAt: true,
        lead: { select: { id: true, title: true } },
        opportunity: { select: { id: true, name: true } },
      },
    }),
  ]);

  // B1: Previous-month counts for delta badges
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
  const [
    prevTotalLeads,
    prevTotalOpportunities,
    prevWonDeals,
    prevLostDeals,
    prevPipelineValue,
  ] = await Promise.all([
    prisma.crmLead.count({
      where: { status: { notIn: ['CONVERTED', 'LOST'] }, deletedAt: null, createdAt: { gte: prevMonthStart, lt: prevMonthEnd }, ...ownerFilter },
    }),
    prisma.crmOpportunity.count({
      where: { deletedAt: null, createdAt: { gte: prevMonthStart, lt: prevMonthEnd }, ...ownerFilter },
    }),
    prisma.crmOpportunity.aggregate({
      _count: true,
      where: { stage: { isWonStage: true }, deletedAt: null, updatedAt: { gte: prevMonthStart, lt: prevMonthEnd }, ...ownerFilter },
    }),
    prisma.crmOpportunity.aggregate({
      _count: true,
      where: { stage: { isLostStage: true }, deletedAt: null, updatedAt: { gte: prevMonthStart, lt: prevMonthEnd }, ...ownerFilter },
    }),
    prisma.crmOpportunity.aggregate({
      _sum: { value: true },
      where: { stage: { isWonStage: false, isLostStage: false }, deletedAt: null, createdAt: { gte: prevMonthStart, lt: prevMonthEnd }, ...ownerFilter },
    }),
  ]);

  const pct = (curr: number, prev: number) => prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 0;
  const delta = {
    leadsDelta: pct(totalLeads, prevTotalLeads),
    oppsDelta: pct(totalOpportunities, prevTotalOpportunities),
    wonDelta: pct(wonDeals._count, prevWonDeals._count),
    lostDelta: pct(lostDeals._count, prevLostDeals._count),
    pipelineDelta: pct(Number(pipelineValue._sum.value || 0), Number(prevPipelineValue._sum.value || 0)),
    winRateDelta: 0, // computed below after winRate
  };

  const pipelineByName = pipelinesWithValues.map((pipeline: any) => ({
    name: pipeline.name,
    value: pipeline.opportunities.reduce((sum: number, opportunity: any) => sum + Number(opportunity.value || 0), 0),
  }));

  const upcomingFollowUps = upcomingFollowUpsRaw.map((lead: any) => ({
    id: lead.id,
    title: lead.title,
    contactName: lead.contactName ?? null,
    followUpDate: lead.followUpDate as Date,
    followUpNote: lead.followUpNote ?? null,
    entityType: 'lead' as const,
  }));

  // B2: Enrich monthlyTrend with leadCount per month
  const leadCountsByMonth = await Promise.all(
    (monthlyTrend as { month: string; wonCount: number; wonValue: number }[]).map(async (_m, i) => {
      const start = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const end = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
      const result = await prisma.crmLead.count({
        where: { deletedAt: null, createdAt: { gte: start, lt: end }, ...ownerFilter },
      });
      return result;
    })
  );
  const monthlyTrendWithLeads = (monthlyTrend as { month: string; wonCount: number; wonValue: number }[]).map((m, i) => ({
    ...m,
    leadCount: leadCountsByMonth[i],
  }));

  const winRate = wonDeals._count + lostDeals._count > 0
    ? Math.round((wonDeals._count / (wonDeals._count + lostDeals._count)) * 100)
    : 0;

  // Compute winRateDelta from previous month
  const prevWinRate = (prevWonDeals._count as number) + (prevLostDeals._count as number) > 0
    ? Math.round(((prevWonDeals._count as number) / ((prevWonDeals._count as number) + (prevLostDeals._count as number))) * 100)
    : 0;
  delta.winRateDelta = prevWinRate > 0 ? winRate - prevWinRate : 0;

  // Avg velocity: average days from creation to won
  const avgVelocityDays: number | null = (() => {
    const valid = (wonOppsForVelocity as { createdAt: Date; wonAt: Date | null }[])
      .filter(o => o.wonAt !== null)
      .map(o => Math.round((o.wonAt!.getTime() - o.createdAt.getTime()) / 86400_000));
    if (valid.length === 0) return null;
    return Math.round(valid.reduce((sum, d) => sum + d, 0) / valid.length);
  })();

  // ---- Phase 3: Enrich opportunitiesByStage with stage metadata ----
  const stageIds = (opportunitiesByStageRaw as { stageId: string }[]).map((s: { stageId: string }) => s.stageId);
  const stages = stageIds.length > 0
    ? await prisma.crmPipelineStage.findMany({
        where: { id: { in: stageIds } },
        select: { id: true, name: true, displayOrder: true, probability: true, color: true, isWonStage: true, isLostStage: true },
      })
    : [];
  const stageMap = new Map(stages.map(s => [s.id, s]));
  const opportunitiesByStage = (opportunitiesByStageRaw as { stageId: string; _count: number; _sum: { value: bigint | null } }[]).map((s) => {
    const meta = stageMap.get(s.stageId);
    return {
      stageId: s.stageId,
      name: meta?.name ?? 'Unknown',
      displayOrder: meta?.displayOrder ?? 0,
      probability: meta?.probability ?? 0,
      color: meta?.color ?? '#0052cc',
      isWonStage: meta?.isWonStage ?? false,
      isLostStage: meta?.isLostStage ?? false,
      _count: s._count,
      _sum: { value: Number(s._sum.value || 0) },
    };
  });

  // ---- Phase 3: Build Sales Rep Dashboard data ----
  // Hot leads with score and tags (tags are polymorphic CrmTagAssignment)
  const hotLeadIds = (hotLeadsRaw as any[]).map((l: any) => l.id);
  const hotLeadTagAssignments = hotLeadIds.length > 0
    ? await prisma.crmTagAssignment.findMany({
        where: { entityType: 'LEAD', entityId: { in: hotLeadIds } },
        select: { entityId: true, tag: { select: { id: true, name: true } } },
      })
    : [];
  const hotLeadTagsMap = new Map<string, string[]>();
  for (const ta of hotLeadTagAssignments) {
    const names = hotLeadTagsMap.get(ta.entityId) ?? [];
    names.push(ta.tag.name);
    hotLeadTagsMap.set(ta.entityId, names);
  }
  const hotLeads = (hotLeadsRaw as any[]).map((lead: any) => ({
    id: lead.id,
    title: lead.title,
    contactName: lead.contactName ?? null,
    estimatedValue: lead.estimatedValue ? Number(lead.estimatedValue) : null,
    score: lead.ruleScore ?? lead.aiScore ?? 0,
    source: lead.source,
    tags: hotLeadTagsMap.get(lead.id) ?? [],
  }));

  // Meetings today
  const nextMeeting = nextMeetingRaw
    ? {
        id: (nextMeetingRaw as any).id,
        subject: (nextMeetingRaw as any).subject,
        scheduledAt: (nextMeetingRaw as any).scheduledAt,
        description: (nextMeetingRaw as any).description ?? null,
        accountName: (nextMeetingRaw as any).account?.name ?? null,
        contactName: ((nextMeetingRaw as any).contact?.firstName ?? '') + ' ' + ((nextMeetingRaw as any).contact?.lastName ?? '').trim(),
        opportunityName: (nextMeetingRaw as any).opportunity?.name ?? null,
      }
    : null;

  // Monthly conversions with quota percentage
  const quotaTarget = quotaTargetRaw ? Number((quotaTargetRaw as any).targetAmount || 0) : 0;
  const monthlyConversions = {
    count: monthlyConversionsCount as number,
    target: quotaTarget,
    percentage: quotaTarget > 0 ? Math.round((monthlyConversionsCount as number) / quotaTarget * 100) : 0,
  };

  // Tasks grouped
  const tasks = {
    overdue: (overdueTasksRaw as any[]).map((t: any) => ({
      id: t.id,
      subject: t.subject,
      description: t.description ?? null,
      scheduledAt: t.scheduledAt,
      leadTitle: t.lead?.title ?? null,
      opportunityName: t.opportunity?.name ?? null,
    })),
    inProgress: (inProgressTasksRaw as any[]).map((t: any) => ({
      id: t.id,
      subject: t.subject,
      description: t.description ?? null,
      scheduledAt: t.scheduledAt,
      leadTitle: t.lead?.title ?? null,
      opportunityName: t.opportunity?.name ?? null,
    })),
    overdueCount: (overdueTasksRaw as any[]).length,
    inProgressCount: (inProgressTasksRaw as any[]).length,
  };

  return {
    totalAccounts,
    totalContacts,
    totalLeads,
    totalOpportunities,
    pipelineValue: pipelineValue._sum.value || 0,
    wonDeals: { count: wonDeals._count, value: wonDeals._sum.value || 0 },
    lostDeals: { count: lostDeals._count, value: lostDeals._sum.value || 0 },
    winRate,
    recentActivities,
    leadsByStatus,
    opportunitiesByStage,
    // Phase 2: Priority stats
    followUpDueToday,
    staleLeads,
    overdueDeals,
    monthlyTrend: monthlyTrendWithLeads,
    pipelineByName,
    upcomingFollowUps,
    delta,
    avgVelocityDays,
    // Phase 3: Sales Rep Dashboard additions
    totalActiveLeads,
    totalOpenOpps,
    meetingsToday: { count: meetingsTodayCount, nextMeeting },
    monthlyConversions,
    hotLeads,
    tasks,
  };
}

// ============================================================================
// DASHBOARD EXPORT
// ============================================================================

export async function exportDashboardCsv(
  scope: CrmDashboardScope,
  dateFrom?: Date,
  dateTo?: Date,
): Promise<string> {
  const stats = await getDashboardStats(scope, dateFrom, dateTo);

  const kpiRows = [
    ['Metric', 'Value'],
    ['New Leads', stats.totalLeads],
    ['Open Opportunities', stats.totalOpportunities],
    ['Won Deals (count)', stats.wonDeals.count],
    ['Won Deals (value MYR)', stats.wonDeals.value],
    ['Lost Deals (count)', stats.lostDeals.count],
    ['Pipeline Value MYR', stats.pipelineValue],
    ['Win Rate %', stats.winRate],
    ['Avg Velocity Days', stats.avgVelocityDays ?? '—'],
  ].map(row => row.join(',')).join('\n');

  const activityHeader = 'Date,Type,Subject,Description';
  const activityRows = stats.recentActivities
    .slice(0, 50)
    .map((a: any) =>
      [
        new Date(a.createdAt).toISOString().slice(0, 10),
        a.activityType ?? '',
        `"${(a.subject ?? '').replace(/"/g, '""')}"`,
        `"${(a.description ?? '').replace(/"/g, '""')}"`,
      ].join(',')
    )
    .join('\n');

  return `${kpiRows}\n\nRecent Activities\n${activityHeader}\n${activityRows}`;
}

// ============================================================================
// LEAD CONVERSION
// ============================================================================

export async function convertLead(
  leadId: string,
  data: {
    opportunityName: string;
    pipelineId: string;
    stageId: string;
    value?: number;
    expectedCloseDate?: string;
    createAccount?: boolean;
    accountName?: string;
  },
  userId: string,
  visibleOwnerIds: string[] | null = [userId]
) {
  return prisma.$transaction(async (tx) => {
    const lead = await tx.crmLead.findFirst({
      where: applyOwnerScope({ id: leadId, deletedAt: null }, visibleOwnerIds),
      include: { account: true, contact: true },
    });
    if (!lead) throw new AppError('Lead not found', 404);

    if (lead.status === 'CONVERTED') {
      throw new Error('Lead is already converted');
    }

    // Create account if needed
    let accountId = lead.accountId;
    // Auto-create account when lead has none
    if (!accountId) {
      data.createAccount = true;
    }
    if (data.createAccount && !accountId) {
      const newAccount = await tx.crmAccount.create({
        data: {
          name: data.accountName || lead.companyName || lead.title,
          email: lead.contactEmail || undefined,
          phone: lead.contactPhone || undefined,
          ownerId: userId,
        },
      });
      accountId = newAccount.id;

      // Create contact from lead info if we have a name
      if (lead.contactName) {
        const nameParts = lead.contactName.split(' ');
        const newContact = await tx.crmContact.create({
          data: {
            accountId: newAccount.id,
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            email: lead.contactEmail || undefined,
            phone: lead.contactPhone || undefined,
            isPrimary: true,
          },
        });
        lead.contactId = newContact.id;
      }
    }

    if (!accountId) {
      throw new Error('Lead must have an account or createAccount must be true');
    }

    // Look up the stage to inherit its default probability
    const stage = await tx.crmPipelineStage.findUniqueOrThrow({
      where: { id: data.stageId },
    });

    // Determine contactId: prefer existing, then newly created during conversion
    const contactId = lead.contactId || lead.contact?.id || null;

    // Create the opportunity
    const opportunity = await tx.crmOpportunity.create({
      data: {
        name: data.opportunityName,
        accountId,
        contactId,
        pipelineId: data.pipelineId,
        stageId: data.stageId,
        ownerId: userId,
        value: data.value || lead.estimatedValue || 0,
        probability: stage.probability,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : undefined,
        description: lead.description,
      },
    });

    // Mark lead as converted
    await tx.crmLead.update({
      where: { id: leadId },
      data: {
        status: 'CONVERTED',
        convertedAt: new Date(),
        convertedToOppId: opportunity.id,
        accountId,
      },
    });

    // Log activity
    await tx.crmActivity.create({
      data: {
        activityType: 'NOTE',
        subject: `Lead converted to opportunity: ${data.opportunityName}`,
        description: `Lead "${lead.title}" was converted to opportunity "${data.opportunityName}"`,
        userId,
        accountId,
        opportunityId: opportunity.id,
        source: 'SYSTEM',
      },
    });

    return opportunity;
  });
}

// ============================================================================
// OPPORTUNITY STAGE CHANGE
// ============================================================================

import { validateStageTransition } from './crm-stage-gate.service';

export async function moveOpportunityStage(
  opportunityId: string,
  stageId: string,
  userId: string,
  lostReason?: string,
  visibleOwnerIds: string[] | null = [userId]
) {
  const result = await prisma.$transaction(async (tx) => {
    const opportunity = await tx.crmOpportunity.findFirst({
      where: applyOwnerScope({ id: opportunityId, deletedAt: null }, visibleOwnerIds),
      include: { stage: true },
    });
    if (!opportunity) throw new AppError('Opportunity not found', 404);

    const newStage = await tx.crmPipelineStage.findUniqueOrThrow({
      where: { id: stageId },
    });

    // Ensure same pipeline
    if (newStage.pipelineId !== opportunity.pipelineId) {
      throw new Error('Stage must belong to the same pipeline');
    }

    // Stage gate validation
    const gateResult = validateStageTransition(opportunity, opportunity.stage as any, newStage as any);
    if (!gateResult.ok) {
      const err: any = new Error(gateResult.reason);
      err.needsApproval = !!gateResult.needsApproval;
      err.gateFailed = true;
      throw err;
    }

    const updateData: Prisma.CrmOpportunityUpdateInput = {
      stage: { connect: { id: stageId } },
      probability: newStage.probability,
    };

    if (newStage.isWonStage) {
      updateData.wonAt = new Date();
      updateData.probability = 100;
    } else if (newStage.isLostStage) {
      updateData.lostAt = new Date();
      updateData.lostReason = lostReason;
      updateData.probability = 0;
    }

    const updated = await tx.crmOpportunity.update({
      where: { id: opportunityId },
      data: updateData,
      include: {
        stage: true,
        account: { select: { id: true, name: true } },
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Log activity
    await tx.crmActivity.create({
      data: {
        activityType: 'NOTE',
        subject: `Deal moved to ${newStage.name}`,
        description: `Opportunity "${opportunity.name}" moved from "${opportunity.stage.name}" to "${newStage.name}"`,
        userId,
        accountId: opportunity.accountId,
        opportunityId,
        source: 'SYSTEM',
      },
    });

    // Record stage history
    await tx.crmOpportunityStageHistory.create({
      data: {
        opportunityId,
        fromStageName: opportunity.stage.name,
        toStageName: newStage.name,
        movedByUserId: userId,
      },
    });

    return { updated, newStage };
  });

  // Fire-and-forget AI debrief when deal closes
  if (result.newStage.isWonStage || result.newStage.isLostStage) {
    setImmediate(() => {
      generateWinLossDebrief(opportunityId)
        .then(async (debrief) => {
          const content = `**AI Win/Loss Debrief**\n\n${debrief.summary}\n\n**Key Factors:**\n${debrief.keyFactors.map(f => `• ${f}`).join('\n')}\n\n**Lessons Learned:**\n${debrief.lessonsLearned.map(l => `• ${l}`).join('\n')}\n\n**Follow-On Actions:**\n${debrief.followOnActions.map(a => `• ${a}`).join('\n')}`;
          await prisma.crmNote.create({ data: { content, opportunityId, authorId: userId } });
        })
        .catch(err => logger.warn('[CRM] Win/loss debrief failed', { error: err }));
    });
  }

  return result.updated;
}

export const opportunityTimelineActivityInclude = {
  user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, jobTitle: true, department: true } },
  account: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  opportunity: { select: { id: true, name: true } },
} as const;

type OpportunityTimelineActivity = Prisma.CrmActivityGetPayload<{
  include: typeof opportunityTimelineActivityInclude;
}> & {
  sourceEntity: 'LEAD' | 'OPPORTUNITY';
};

export interface OpportunityTimelineResult {
  activities: OpportunityTimelineActivity[];
  total: number;
}

/**
 * Returns the chronological activity timeline for an Opportunity, including
 * activities retained on the Lead that was converted into it.
 */
export async function getOpportunityActivityTimeline(
  opportunityId: string,
  visibleOwnerIds: string[] | null,
  options: {
    where?: Prisma.CrmActivityWhereInput;
    skip?: number;
    take?: number;
  } = {},
): Promise<OpportunityTimelineResult> {
  const originatingLead = await prisma.crmLead.findFirst({
    where: {
      convertedToOppId: opportunityId,
      deletedAt: null,
      ...(visibleOwnerIds === null ? {} : { ownerId: { in: visibleOwnerIds } }),
    },
    select: { id: true },
  });
  const activityOriginWhere: Prisma.CrmActivityWhereInput = {
    OR: [
      { opportunityId },
      ...(originatingLead ? [{ leadId: originatingLead.id }] : []),
    ],
  };
  const where: Prisma.CrmActivityWhereInput = options.where
    ? { AND: [options.where, activityOriginWhere] }
    : activityOriginWhere;

  const [rows, total] = await Promise.all([
    prisma.crmActivity.findMany({
      where,
      skip: options.skip,
      take: options.take,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: opportunityTimelineActivityInclude,
    }),
    prisma.crmActivity.count({ where }),
  ]);

  return {
    activities: rows.map((activity) => ({
      ...activity,
      sourceEntity: activity.leadId ? 'LEAD' : 'OPPORTUNITY',
    })),
    total,
  };
}

// ============================================================================
// PIPELINE STATS
// ============================================================================

export async function getPipelineStats(pipelineId: string) {
  const stages = await prisma.crmPipelineStage.findMany({
    where: { pipelineId },
    orderBy: { displayOrder: 'asc' },
    include: {
      opportunities: {
        select: {
          id: true,
          name: true,
          value: true,
          probability: true,
          expectedCloseDate: true,
          owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          account: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
          createdAt: true,
          updatedAt: true,
        },
      },
      _count: { select: { opportunities: true } },
    },
  });

  const totalValue = stages.reduce((sum, stage) => {
    if (stage.isLostStage) return sum;
    return sum + stage.opportunities.reduce((s, o) => s + Number(o.value), 0);
  }, 0);

  return { stages, totalValue };
}

export default {
  getDashboardStats,
  exportDashboardCsv,
  convertLead,
  moveOpportunityStage,
  getPipelineStats,
};
