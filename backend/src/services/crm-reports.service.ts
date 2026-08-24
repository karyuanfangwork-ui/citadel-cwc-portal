import prisma from '../utils/prisma';

type VisibleOwnerIds = string[] | null;

function scopedOwnerFilter(ownerId: string | undefined, visibleOwnerIds: VisibleOwnerIds) {
  if (visibleOwnerIds === null) return ownerId ? { ownerId } : {};
  const ownerIds = ownerId ? visibleOwnerIds.filter((id) => id === ownerId) : visibleOwnerIds;
  return { ownerId: { in: ownerIds } };
}

function ownerScope(visibleOwnerIds: VisibleOwnerIds) {
  return visibleOwnerIds === null ? {} : { ownerId: { in: visibleOwnerIds } };
}

function contactAccountScope(visibleOwnerIds: VisibleOwnerIds) {
  return visibleOwnerIds === null ? {} : { contact: { account: { ownerId: { in: visibleOwnerIds } } } };
}

// ============================================================================
// REPORT TYPES
// ============================================================================

export interface LeadConversionReport {
  bySource: Array<{
    source: string;
    total: number;
    converted: number;
    lost: number;
    conversionRate: number;
  }>;
  byStatus: Array<{
    status: string;
    count: number;
  }>;
  overallConversionRate: number;
  period: { from: Date; to: Date };
}

export interface SalesPerformanceReport {
  byOwner: Array<{
    ownerId: string;
    ownerName: string;
    totalDeals: number;
    wonDeals: number;
    lostDeals: number;
    winRate: number;
    totalWonValue: number;
    totalLostValue: number;
    avgDealSize: number;
  }>;
  overallWinRate: number;
  totalRevenue: number;
  period: { from: Date; to: Date };
}

export interface PipelineForecastReport {
  stages: Array<{
    stageId: string;
    stageName: string;
    probability: number;
    dealCount: number;
    totalValue: number;
    weightedValue: number;
  }>;
  totalPipelineValue: number;
  weightedPipelineValue: number;
  overdueDeals: number;
  overdueValue: number;
}

export interface ActivitySummaryReport {
  byType: Array<{
    activityType: string;
    count: number;
  }>;
  byUser: Array<{
    userId: string;
    userName: string;
    count: number;
    breakdown: Record<string, number>;
  }>;
  totalActivities: number;
  period: { from: Date; to: Date };
}

export interface LeadAgingReport {
  byStatus: Array<{
    status: string;
    count: number;
    avgAgeDays: number;
    maxAgeDays: number;
    leadsOver30Days: number;
    leadsOver60Days: number;
    leadsOver90Days: number;
  }>;
  staleLeads: number;
  averageAgeAllLeads: number;
}

// ============================================================================
// 1. LEAD CONVERSION REPORT
// ============================================================================

export async function getLeadConversionReport(
  from: Date,
  to: Date,
  ownerId?: string,
  visibleOwnerIds: VisibleOwnerIds = null
): Promise<LeadConversionReport> {
  const ownerFilter = scopedOwnerFilter(ownerId, visibleOwnerIds);
  const dateFilter = {
    createdAt: { gte: from, lte: to },
  };

  // Leads grouped by source
  const leadsBySource = await prisma.crmLead.groupBy({
    by: ['source'],
    _count: true,
    where: {
      ...ownerFilter,
      ...dateFilter,
      deletedAt: null,
    },
  });

  // Converted leads by source
  const convertedBySource = await prisma.crmLead.groupBy({
    by: ['source'],
    _count: true,
    where: {
      ...ownerFilter,
      ...dateFilter,
      status: 'CONVERTED',
      deletedAt: null,
    },
  });

  // Lost leads by source
  const lostBySource = await prisma.crmLead.groupBy({
    by: ['source'],
    _count: true,
    where: {
      ...ownerFilter,
      ...dateFilter,
      status: 'LOST',
      deletedAt: null,
    },
  });

  // Build source map
  const convertedMap = new Map(convertedBySource.map((r) => [r.source, r._count]));
  const lostMap = new Map(lostBySource.map((r) => [r.source, r._count]));

  const bySource = leadsBySource.map((row) => {
    const total = row._count;
    const converted = convertedMap.get(row.source) || 0;
    const lost = lostMap.get(row.source) || 0;
    return {
      source: row.source,
      total,
      converted,
      lost,
      conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
    };
  });

  // Leads grouped by status
  const leadsByStatus = await prisma.crmLead.groupBy({
    by: ['status'],
    _count: true,
    where: {
      ...ownerFilter,
      ...dateFilter,
      deletedAt: null,
    },
  });

  const byStatus = leadsByStatus.map((row) => ({
    status: row.status,
    count: row._count,
  }));

  // Overall conversion rate
  const totalLeads = bySource.reduce((sum, r) => sum + r.total, 0);
  const totalConverted = bySource.reduce((sum, r) => sum + r.converted, 0);

  return {
    bySource,
    byStatus,
    overallConversionRate: totalLeads > 0 ? Math.round((totalConverted / totalLeads) * 100) : 0,
    period: { from, to },
  };
}

// ============================================================================
// 2. SALES PERFORMANCE REPORT
// ============================================================================

export async function getSalesPerformanceReport(
  from: Date,
  to: Date,
  pipelineId?: string,
  visibleOwnerIds: VisibleOwnerIds = null
): Promise<SalesPerformanceReport> {
  const baseFilter: Record<string, unknown> = {
    deletedAt: null,
    createdAt: { gte: from, lte: to },
    ...ownerScope(visibleOwnerIds),
  };
  if (pipelineId) {
    baseFilter.pipelineId = pipelineId;
  }

  // All opportunities in period
  const opportunities = await prisma.crmOpportunity.findMany({
    where: baseFilter,
    select: {
      id: true,
      value: true,
      ownerId: true,
      wonAt: true,
      lostAt: true,
      stage: { select: { isWonStage: true, isLostStage: true } },
      owner: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Group by owner
  const ownerMap = new Map<
    string,
    {
      ownerId: string;
      ownerName: string;
      totalDeals: number;
      wonDeals: number;
      lostDeals: number;
      totalWonValue: number;
      totalLostValue: number;
    }
  >();

  for (const opp of opportunities) {
    const ownerId = opp.ownerId;
    const ownerName = `${opp.owner.firstName} ${opp.owner.lastName}`;
    if (!ownerMap.has(ownerId)) {
      ownerMap.set(ownerId, {
        ownerId,
        ownerName,
        totalDeals: 0,
        wonDeals: 0,
        lostDeals: 0,
        totalWonValue: 0,
        totalLostValue: 0,
      });
    }
    const entry = ownerMap.get(ownerId)!;
    entry.totalDeals++;

    if (opp.stage.isWonStage) {
      entry.wonDeals++;
      entry.totalWonValue += Number(opp.value);
    } else if (opp.stage.isLostStage) {
      entry.lostDeals++;
      entry.totalLostValue += Number(opp.value);
    }
  }

  const byOwner = Array.from(ownerMap.values()).map((entry) => ({
    ...entry,
    winRate: entry.totalDeals > 0 ? Math.round((entry.wonDeals / entry.totalDeals) * 100) : 0,
    avgDealSize: entry.wonDeals > 0 ? Math.round(entry.totalWonValue / entry.wonDeals) : 0,
  }));

  const totalWon = byOwner.reduce((sum, r) => sum + r.wonDeals, 0);
  const totalLost = byOwner.reduce((sum, r) => sum + r.lostDeals, 0);
  const totalRevenue = byOwner.reduce((sum, r) => sum + r.totalWonValue, 0);

  return {
    byOwner,
    overallWinRate: totalWon + totalLost > 0 ? Math.round((totalWon / (totalWon + totalLost)) * 100) : 0,
    totalRevenue,
    period: { from, to },
  };
}

// ============================================================================
// 3. PIPELINE FORECAST REPORT
// ============================================================================

export async function getPipelineForecastReport(
  pipelineId: string,
  visibleOwnerIds: VisibleOwnerIds = null
): Promise<PipelineForecastReport> {
  const scopedOpportunityWhere = { deletedAt: null, ...ownerScope(visibleOwnerIds) };
  const stages = await prisma.crmPipelineStage.findMany({
    where: { pipelineId },
    orderBy: { displayOrder: 'asc' },
    include: {
      opportunities: {
        where: scopedOpportunityWhere,
        select: {
          id: true,
          value: true,
          currency: true,
          fxRateToBase: true,
          probability: true,
          expectedCloseDate: true,
          wonAt: true,
          lostAt: true,
        },
      },
    },
  });

  const now = new Date();

  const stageReports = stages.map((stage) => {
    const deals = stage.opportunities;
    const totalValue = deals.reduce((sum, o) => {
      const rate = o.fxRateToBase ? Number(o.fxRateToBase) : 1;
      return sum + Number(o.value) * rate;
    }, 0);
    const probabilityPct = stage.probability || 0;
    const weightedValue = (totalValue * probabilityPct) / 100;

    return {
      stageId: stage.id,
      stageName: stage.name,
      probability: probabilityPct,
      dealCount: deals.length,
      totalValue,
      weightedValue: Math.round(weightedValue),
    };
  });

  // Overdue deals: past expected close date, not won/lost
  const overdueOpps = await prisma.crmOpportunity.findMany({
    where: {
      pipelineId,
      ...ownerScope(visibleOwnerIds),
      expectedCloseDate: { lt: now },
      wonAt: null,
      lostAt: null,
      deletedAt: null,
      stage: { isWonStage: false, isLostStage: false },
    },
    select: { id: true, value: true },
  });

  const totalPipelineValue = stageReports.reduce((sum, s) => sum + s.totalValue, 0);
  const weightedPipelineValue = stageReports.reduce((sum, s) => sum + s.weightedValue, 0);
  const overdueValue = overdueOpps.reduce((sum, o) => sum + Number(o.value), 0);

  return {
    stages: stageReports,
    totalPipelineValue,
    weightedPipelineValue,
    overdueDeals: overdueOpps.length,
    overdueValue,
  };
}

// ============================================================================
// 4. ACTIVITY SUMMARY REPORT
// ============================================================================

export async function getActivitySummaryReport(
  from: Date,
  to: Date,
  userId?: string,
  visibleOwnerIds: VisibleOwnerIds = null
): Promise<ActivitySummaryReport> {
  const userFilter = visibleOwnerIds === null
    ? (userId ? { userId } : {})
    : { userId: { in: userId ? visibleOwnerIds.filter((id) => id === userId) : visibleOwnerIds } };
  const dateFilter = { createdAt: { gte: from, lte: to } };
  const activeEntityFilter = {
    OR: [
      { accountId: null, contactId: null, leadId: null, opportunityId: null },
      { account: { deletedAt: null } },
      { contact: { deletedAt: null } },
      { lead: { deletedAt: null } },
      { opportunity: { deletedAt: null } },
    ],
  };
  const visibilityFilter = visibleOwnerIds === null
    ? {}
    : {
        OR: [
          { account: { ownerId: { in: visibleOwnerIds }, deletedAt: null } },
          { contact: { account: { ownerId: { in: visibleOwnerIds }, deletedAt: null } } },
          { lead: { ownerId: { in: visibleOwnerIds }, deletedAt: null } },
          { opportunity: { ownerId: { in: visibleOwnerIds }, deletedAt: null } },
          {
            accountId: null,
            contactId: null,
            leadId: null,
            opportunityId: null,
            userId: { in: visibleOwnerIds },
          },
        ],
      };
  const activityWhere = { AND: [userFilter, dateFilter, activeEntityFilter, visibilityFilter] };

  // Activity counts by type
  const byTypeRaw = await prisma.crmActivity.groupBy({
    by: ['activityType'],
    _count: true,
    where: activityWhere,
  });

  const byType = byTypeRaw.map((row) => ({
    activityType: row.activityType,
    count: row._count,
  }));

  // Activity counts by user with type breakdown
  const byUserRaw = await prisma.crmActivity.groupBy({
    by: ['userId', 'activityType'],
    _count: true,
    where: activityWhere,
  });

  // Fetch user names for the user IDs in the results
  const userIds = Array.from(new Set(byUserRaw.map((r) => r.userId)));
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const userNameMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  // Aggregate per user
  const userActivityMap = new Map<
    string,
    { userId: string; userName: string; count: number; breakdown: Record<string, number> }
  >();

  for (const row of byUserRaw) {
    if (!userActivityMap.has(row.userId)) {
      userActivityMap.set(row.userId, {
        userId: row.userId,
        userName: userNameMap.get(row.userId) || 'Unknown',
        count: 0,
        breakdown: {},
      });
    }
    const entry = userActivityMap.get(row.userId)!;
    entry.count += row._count;
    entry.breakdown[row.activityType] = (entry.breakdown[row.activityType] || 0) + row._count;
  }

  const byUser = Array.from(userActivityMap.values());
  const totalActivities = byType.reduce((sum, r) => sum + r.count, 0);

  return {
    byType,
    byUser,
    totalActivities,
    period: { from, to },
  };
}

// ============================================================================
// 5. LEAD AGING REPORT
// ============================================================================

export async function getLeadAgingReport(
  ownerId?: string,
  visibleOwnerIds: VisibleOwnerIds = null
): Promise<LeadAgingReport> {
  const ownerFilter = scopedOwnerFilter(ownerId, visibleOwnerIds);
  const now = new Date();

  // Active leads (not converted/lost, not deleted)
  const activeLeads = await prisma.crmLead.findMany({
    where: {
      ...ownerFilter,
      status: { notIn: ['CONVERTED', 'LOST'] },
      deletedAt: null,
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
    },
  });

  // Group by status
  const statusMap = new Map<
    string,
    {
      status: string;
      count: number;
      ages: number[];
      leadsOver30Days: number;
      leadsOver60Days: number;
      leadsOver90Days: number;
    }
  >();

  for (const lead of activeLeads) {
    const ageDays = Math.floor((now.getTime() - lead.createdAt.getTime()) / (1000 * 60 * 60 * 24));

    if (!statusMap.has(lead.status)) {
      statusMap.set(lead.status, {
        status: lead.status,
        count: 0,
        ages: [],
        leadsOver30Days: 0,
        leadsOver60Days: 0,
        leadsOver90Days: 0,
      });
    }

    const entry = statusMap.get(lead.status)!;
    entry.count++;
    entry.ages.push(ageDays);
    if (ageDays > 90) entry.leadsOver90Days++;
    else if (ageDays > 60) entry.leadsOver60Days++;
    else if (ageDays > 30) entry.leadsOver30Days++;
  }

  const byStatus = Array.from(statusMap.values()).map((entry) => {
    const sorted = [...entry.ages].sort((a, b) => a - b);
    const avgAge = sorted.length > 0 ? Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length) : 0;
    const maxAge = sorted.length > 0 ? sorted[sorted.length - 1] : 0;

    return {
      status: entry.status,
      count: entry.count,
      avgAgeDays: avgAge,
      maxAgeDays: maxAge,
      leadsOver30Days: entry.leadsOver30Days,
      leadsOver60Days: entry.leadsOver60Days,
      leadsOver90Days: entry.leadsOver90Days,
    };
  });

  // Stale leads (no activity in 7 days)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const staleLeads = await prisma.crmLead.count({
    where: {
      ...ownerFilter,
      status: { notIn: ['CONVERTED', 'LOST'] },
      deletedAt: null,
      activities: { none: { createdAt: { gte: sevenDaysAgo } } },
    },
  });

  // Overall average age
  const allAges = activeLeads.map((l) =>
    Math.floor((now.getTime() - l.createdAt.getTime()) / (1000 * 60 * 60 * 24))
  );
  const averageAgeAllLeads = allAges.length > 0
    ? Math.round(allAges.reduce((s, v) => s + v, 0) / allAges.length)
    : 0;

  return {
    byStatus,
    staleLeads,
    averageAgeAllLeads,
  };
}

// ============================================================================
// 6. WIN/LOSS ANALYSIS REPORT
// ============================================================================

export interface WinLossReport {
  byReason: Array<{
    lostReason: string;
    count: number;
    totalValue: number;
  }>;
  totalWon: { count: number; value: number };
  /** Converted CRM leads are tracked separately from won opportunities/deals. */
  totalConvertedLeads: number;
  convertedLeads: Array<{
    id: string;
    title: string;
    companyName: string | null;
    accountName: string | null;
    ownerName: string;
    convertedAt: Date;
  }>;
  totalLost: { count: number; value: number };
  /** Lost CRM leads are tracked separately from lost opportunities/deals. */
  totalLostLeads: number;
  lostLeads: Array<{
    id: string;
    title: string;
    companyName: string | null;
    accountName: string | null;
    ownerName: string;
    lostReason: string | null;
    updatedAt: Date;
  }>;
  winRate: number;
  period: { from: Date; to: Date };
}

export async function getWinLossReport(
  from: Date,
  to: Date,
  ownerId?: string,
  visibleOwnerIds: VisibleOwnerIds = null
): Promise<WinLossReport> {
  const ownerFilter = scopedOwnerFilter(ownerId, visibleOwnerIds);

  // Won deals
  const wonDeals = await prisma.crmOpportunity.findMany({
    where: {
      ...ownerFilter,
      wonAt: { not: null, gte: from, lte: to },
      deletedAt: null,
    },
    select: { id: true, value: true },
  });

  // Lost deals grouped by reason
  const lostDeals = await prisma.crmOpportunity.findMany({
    where: {
      ...ownerFilter,
      lostAt: { not: null, gte: from, lte: to },
      deletedAt: null,
    },
    select: { id: true, value: true, lostReason: true },
  });

  // Leads have their own lifecycle and do not create an opportunity when lost.
  // Use updatedAt as the status-transition timestamp because CrmLead has no
  // dedicated lostAt column; the lead status update is the authoritative event.
  const lostLeads = await prisma.crmLead.findMany({
    where: {
      ...ownerFilter,
      status: 'LOST',
      updatedAt: { gte: from, lte: to },
      deletedAt: null,
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      companyName: true,
      lostReason: true,
      updatedAt: true,
      account: { select: { name: true } },
      owner: { select: { firstName: true, lastName: true } },
    },
  });

  const lostLeadDetails = lostLeads.map((lead) => ({
    id: lead.id,
    title: lead.title,
    companyName: lead.companyName,
    accountName: lead.account?.name ?? null,
    ownerName: `${lead.owner.firstName} ${lead.owner.lastName}`.trim(),
    lostReason: lead.lostReason,
    updatedAt: lead.updatedAt,
  }));

  const convertedLeads = await prisma.crmLead.findMany({
    where: {
      ...ownerFilter,
      status: 'CONVERTED',
      convertedAt: { not: null, gte: from, lte: to },
      deletedAt: null,
    },
    orderBy: { convertedAt: 'desc' },
    select: {
      id: true,
      title: true,
      companyName: true,
      convertedAt: true,
      account: { select: { name: true } },
      owner: { select: { firstName: true, lastName: true } },
    },
  });

  const convertedLeadDetails = convertedLeads
    .filter((lead): lead is typeof lead & { convertedAt: Date } => lead.convertedAt !== null)
    .map((lead) => ({
      id: lead.id,
      title: lead.title,
      companyName: lead.companyName,
      accountName: lead.account?.name ?? null,
      ownerName: `${lead.owner.firstName} ${lead.owner.lastName}`.trim(),
      convertedAt: lead.convertedAt,
    }));

  // Aggregate by loss reason
  const reasonMap = new Map<string, { count: number; totalValue: number }>();
  for (const deal of lostDeals) {
    const reason = deal.lostReason || 'Not specified';
    const entry = reasonMap.get(reason) || { count: 0, totalValue: 0 };
    entry.count++;
    entry.totalValue += Number(deal.value || 0);
    reasonMap.set(reason, entry);
  }

  const byReason = Array.from(reasonMap.entries()).map(([lostReason, data]) => ({
    lostReason,
    ...data,
  }));

  const totalWonValue = wonDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const totalLostValue = lostDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const totalDeals = wonDeals.length + lostDeals.length;
  const winRate = totalDeals > 0 ? Math.round((wonDeals.length / totalDeals) * 100) : 0;

  return {
    byReason,
    totalWon: { count: wonDeals.length, value: totalWonValue },
    totalConvertedLeads: convertedLeadDetails.length,
    convertedLeads: convertedLeadDetails,
    totalLost: { count: lostDeals.length, value: totalLostValue },
    totalLostLeads: lostLeadDetails.length,
    lostLeads: lostLeadDetails,
    winRate,
    period: { from, to },
  };
}

// ============================================================================
// 7. KYC COMPLIANCE REPORT
// ============================================================================

export interface KycComplianceReport {
  byStatus: Array<{
    status: string;
    count: number;
  }>;
  expiringSoon: number; // KYC records expiring within 30 days
  pendingCount: number;
  approvedCount: number;
  expiredCount: number;
  pepFlagged: number; // contacts flagged as PEP
  totalContacts: number;
  complianceRate: number; // approved / total * 100
}

export async function getKycComplianceReport(visibleOwnerIds: VisibleOwnerIds = null): Promise<KycComplianceReport> {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const kycScope = contactAccountScope(visibleOwnerIds);
  const contactScope = visibleOwnerIds === null ? {} : { account: { ownerId: { in: visibleOwnerIds } } };

  const [byStatusRaw, expiringSoon, pepFlagged, totalContacts] = await Promise.all([
    prisma.crmKycRecord.groupBy({
      by: ['status'],
      _count: true,
      where: kycScope,
    }),
    prisma.crmKycRecord.count({
      where: {
        ...kycScope,
        expiresAt: { lte: thirtyDaysFromNow, gte: now },
        status: 'APPROVED',
      },
    }),
    prisma.crmKycRecord.count({
      where: { ...kycScope, isPep: true },
    }),
    prisma.crmContact.count({
      where: { deletedAt: null, ...contactScope },
    }),
  ]);

  const byStatus = byStatusRaw.map((r) => ({
    status: r.status,
    count: r._count,
  }));

  const pendingCount = byStatus.find((r) => r.status === 'PENDING')?.count || 0;
  const approvedCount = byStatus.find((r) => r.status === 'APPROVED')?.count || 0;
  const expiredCount = byStatus.find((r) => r.status === 'EXPIRED')?.count || 0;
  const complianceRate = totalContacts > 0 ? Math.round((approvedCount / totalContacts) * 100) : 0;

  return {
    byStatus,
    expiringSoon,
    pendingCount,
    approvedCount,
    expiredCount,
    pepFlagged,
    totalContacts,
    complianceRate,
  };
}

export default {
  getLeadConversionReport,
  getSalesPerformanceReport,
  getPipelineForecastReport,
  getActivitySummaryReport,
  getLeadAgingReport,
  getWinLossReport,
  getKycComplianceReport,
};
