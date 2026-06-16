
import prisma from '../utils/prisma';

// ============================================================================
// TERRITORY SERVICE
// ============================================================================

export async function listTerritories(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [territories, total] = await Promise.all([
    prisma.crmTerritory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      skip,
      take: limit,
      include: {
        members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { leads: true } },
      },
    }),
    prisma.crmTerritory.count({ where: { isActive: true } }),
  ]);
  return { territories, total };
}

export async function getTerritory(id: string) {
  const territory = await prisma.crmTerritory.findUnique({
    where: { id },
    include: {
      members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      quotas: { orderBy: { period: 'desc' } },
      _count: { select: { leads: true } },
    },
  });
  if (!territory) throw new Error('Territory not found');
  return territory;
}

export async function createTerritory(data: { name: string; description?: string; regions: any }, userId: string) {
  return prisma.crmTerritory.create({
    data: {
      name: data.name,
      description: data.description || null,
      regions: data.regions || {},
      createdBy: userId,
    },
    include: {
      members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
    },
  });
}

export async function updateTerritory(id: string, data: { name?: string; description?: string; regions?: any; isActive?: boolean }) {
  const territory = await prisma.crmTerritory.findUnique({ where: { id } });
  if (!territory) throw new Error('Territory not found');
  return prisma.crmTerritory.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.regions !== undefined && { regions: data.regions }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}

export async function deleteTerritory(id: string) {
  const territory = await prisma.crmTerritory.findUnique({ where: { id } });
  if (!territory) throw new Error('Territory not found');
  return prisma.crmTerritory.update({ where: { id }, data: { isActive: false } });
}

// ── Territory Members ──────────────────────────────────────────────

export async function addTerritoryMember(territoryId: string, userId: string, role: string) {
  return prisma.crmTerritoryMember.create({
    data: { territoryId, userId, role: role || 'MEMBER' },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
}

export async function removeTerritoryMember(territoryId: string, userId: string) {
  return prisma.crmTerritoryMember.deleteMany({ where: { territoryId, userId } });
}

export async function updateTerritoryMember(territoryId: string, userId: string, role: string) {
  return prisma.crmTerritoryMember.updateMany({
    where: { territoryId, userId },
    data: { role },
  });
}

// ── Territory Lookup ────────────────────────────────────────────────

export async function lookupTerritory(state?: string, country?: string) {
  if (!state && !country) return [];
  const territories = await prisma.crmTerritory.findMany({
    where: { isActive: true },
    include: { members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } } },
  });

  return territories.filter(t => {
    const regions = t.regions as { states?: string[]; countries?: string[] } | null;
    if (!regions) return false;
    const stateMatch = !state || !regions.states || regions.states.length === 0 || regions.states.includes(state);
    const countryMatch = !country || !regions.countries || regions.countries.length === 0 || regions.countries.includes(country);
    return stateMatch && countryMatch;
  });
}

// ============================================================================
// QUOTA SERVICE
// ============================================================================

export async function listQuotas(filters?: { period?: string; userId?: string; territoryId?: string }, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const where: any = {};
  if (filters?.period) where.period = filters.period;
  if (filters?.userId) where.userId = filters.userId;
  if (filters?.territoryId) where.territoryId = filters.territoryId;

  const [quotas, total] = await Promise.all([
    prisma.crmQuota.findMany({
      where,
      orderBy: { period: 'desc' },
      skip,
      take: limit,
      include: {
        territory: { select: { id: true, name: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.crmQuota.count({ where }),
  ]);
  return { quotas, total };
}

export async function getQuota(id: string) {
  const quota = await prisma.crmQuota.findUnique({
    where: { id },
    include: {
      territory: { select: { id: true, name: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  if (!quota) throw new Error('Quota not found');
  return quota;
}

export async function createQuota(data: { territoryId?: string; userId?: string; period: string; periodType: string; targetAmount: number; currency?: string }) {
  return prisma.crmQuota.create({
    data: {
      territoryId: data.territoryId || null,
      userId: data.userId || null,
      period: data.period,
      periodType: data.periodType || 'MONTHLY',
      targetAmount: data.targetAmount,
      currency: data.currency || 'MYR',
    },
    include: {
      territory: { select: { id: true, name: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
}

export async function updateQuota(id: string, data: { period?: string; periodType?: string; targetAmount?: number; currency?: string }) {
  const quota = await prisma.crmQuota.findUnique({ where: { id } });
  if (!quota) throw new Error('Quota not found');
  return prisma.crmQuota.update({
    where: { id },
    data: {
      ...(data.period !== undefined && { period: data.period }),
      ...(data.periodType !== undefined && { periodType: data.periodType }),
      ...(data.targetAmount !== undefined && { targetAmount: data.targetAmount }),
      ...(data.currency !== undefined && { currency: data.currency }),
    },
  });
}

export async function deleteQuota(id: string) {
  const quota = await prisma.crmQuota.findUnique({ where: { id } });
  if (!quota) throw new Error('Quota not found');
  return prisma.crmQuota.delete({ where: { id } });
}

// ── Quota Attainment ────────────────────────────────────────────────

export async function getQuotaAttainment(period: string, userId?: string, territoryId?: string) {
  // Find matching quotas
  const quotaWhere: any = { period };
  if (userId) quotaWhere.userId = userId;
  if (territoryId) quotaWhere.territoryId = territoryId;

  const quotas = await prisma.crmQuota.findMany({
    where: quotaWhere,
    include: {
      territory: { select: { id: true, name: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  // Calculate attainment from closed-won opportunities
  const periodStart = new Date(period.includes('-Q') ? period.replace(/-Q(\d)/, (_, q) => `-0${(parseInt(q) - 1) * 3 + 1}`) : period + '-01');
  const periodEnd = new Date(periodStart);
  if (period.includes('-Q')) {
    periodEnd.setMonth(periodEnd.getMonth() + 3);
  } else if (period.length === 4) {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  const attainment = await Promise.all(quotas.map(async (quota) => {
    const ownerFilter = quota.userId ? { ownerId: quota.userId } : {};
    const territoryMembers = quota.territoryId
      ? (await prisma.crmTerritoryMember.findMany({ where: { territoryId: quota.territoryId } })).map(m => m.userId)
      : null;

    const wonOpps = await prisma.crmOpportunity.findMany({
      where: {
        ...ownerFilter,
        ...(territoryMembers && territoryMembers.length > 0 ? { ownerId: { in: territoryMembers } } : {}),
        stage: { name: 'Closed Won' },
        wonAt: { gte: periodStart, lt: periodEnd },
        deletedAt: null,
      },
      select: { value: true, currency: true },
    });

    const closedWonValue = wonOpps.reduce((sum, opp) => sum + Number(opp.value), 0);
    const attainmentPct = Number(quota.targetAmount) > 0 ? (closedWonValue / Number(quota.targetAmount)) * 100 : 0;

    return {
      quotaId: quota.id,
      period: quota.period,
      periodType: quota.periodType,
      targetAmount: Number(quota.targetAmount),
      closedWonValue,
      attainmentPct: Math.round(attainmentPct * 100) / 100,
      currency: quota.currency,
      territory: quota.territory,
      user: quota.user,
    };
  }));

  return attainment;
}

// ── Quota Dashboard ─────────────────────────────────────────────────

export async function getQuotaDashboard(period: string) {
  const quotas = await prisma.crmQuota.findMany({
    where: { period },
    include: {
      territory: { select: { id: true, name: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  const totalTarget = quotas.reduce((sum, q) => sum + Number(q.targetAmount), 0);

  // Get all unique user IDs from quotas
  const userIds = [...new Set(quotas.filter(q => q.userId).map(q => q.userId!))];
  const territoryIds = [...new Set(quotas.filter(q => q.territoryId).map(q => q.territoryId!))];

  const periodStart = new Date(period.includes('-Q') ? period.replace(/-Q(\d)/, (_, q) => `-0${(parseInt(q) - 1) * 3 + 1}`) : period + '-01');
  const periodEnd = new Date(periodStart);
  if (period.includes('-Q')) {
    periodEnd.setMonth(periodEnd.getMonth() + 3);
  } else if (period.length === 4) {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  const wonOpps = await prisma.crmOpportunity.findMany({
    where: {
      ...(userIds.length > 0 ? { ownerId: { in: userIds } } : {}),
      stage: { name: 'Closed Won' },
      wonAt: { gte: periodStart, lt: periodEnd },
      deletedAt: null,
    },
    select: { value: true, ownerId: true },
  });

  const totalClosedWon = wonOpps.reduce((sum, opp) => sum + Number(opp.value), 0);

  // Per-rep breakdown
  const byRep = userIds.map(uid => {
    const repQuotas = quotas.filter(q => q.userId === uid);
    const repTarget = repQuotas.reduce((sum, q) => sum + Number(q.targetAmount), 0);
    const repWon = wonOpps.filter(o => o.ownerId === uid).reduce((sum, o) => sum + Number(o.value), 0);
    const repInfo = repQuotas[0]?.user;
    return {
      userId: uid,
      name: repInfo ? `${repInfo.firstName} ${repInfo.lastName}` : 'Unknown',
      email: repInfo?.email,
      target: repTarget,
      closedWon: repWon,
      attainmentPct: repTarget > 0 ? Math.round((repWon / repTarget) * 10000) / 100 : 0,
    };
  });

  // Per-territory breakdown
  const byTerritory: Array<{ territoryId: string; name: string; target: number; closedWon: number; attainmentPct: number }> = [];
  for (const tid of territoryIds) {
    const territoryQuotas = quotas.filter(q => q.territoryId === tid);
    const territoryTarget = territoryQuotas.reduce((sum, q) => sum + Number(q.targetAmount), 0);
    const territoryInfo = territoryQuotas[0]?.territory;
    const members = await prisma.crmTerritoryMember.findMany({
      where: { territoryId: tid },
      select: { userId: true },
    });
    const memberIds = members.map(m => m.userId);
    const territoryWon = wonOpps.filter(o => memberIds.includes(o.ownerId)).reduce((sum, o) => sum + Number(o.value), 0);
    byTerritory.push({
      territoryId: tid,
      name: territoryInfo?.name || 'Unknown',
      target: territoryTarget,
      closedWon: territoryWon,
      attainmentPct: territoryTarget > 0 ? Math.round((territoryWon / territoryTarget) * 10000) / 100 : 0,
    });
  }

  return {
    period,
    totalTarget,
    totalClosedWon,
    totalAttainmentPct: totalTarget > 0 ? Math.round((totalClosedWon / totalTarget) * 10000) / 100 : 0,
    byRep,
    byTerritory,
  };
}

// ── Lead Routing ────────────────────────────────────────────────────

export async function routeLeadToTerritory(state?: string, country?: string): Promise<string | null> {
  const territories = await lookupTerritory(state, country);
  if (territories.length === 0) return null;
  // Pick first matching territory; assign to first MEMBER
  const territory = territories[0];
  const members = (territory as any).members as Array<{ userId: string; role: string }>;
  const member = members.find((m: any) => m.role === 'MEMBER') || members[0];
  return member?.userId || null;
}

export default {
  listTerritories, getTerritory, createTerritory, updateTerritory, deleteTerritory,
  addTerritoryMember, removeTerritoryMember, updateTerritoryMember,
  lookupTerritory,
  listQuotas, getQuota, createQuota, updateQuota, deleteQuota,
  getQuotaAttainment, getQuotaDashboard,
  routeLeadToTerritory,
};