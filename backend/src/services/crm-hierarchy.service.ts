import { Prisma } from '@prisma/client';
import { AppError } from '../middleware/error.middleware';
import prisma from '../utils/prisma';

export const CRM_SALES_ROLES = ['SALES_MANAGER', 'SALES_REP'] as const;
export type CrmSalesRole = typeof CRM_SALES_ROLES[number];

type DbClient = Prisma.TransactionClient;

type HierarchyUser = {
  id: string;
  tenantId: string | null;
  managerId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  department: string | null;
  isActive: boolean;
  roles: string[];
};

export interface HierarchyNodeUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  department: string | null;
  isActive: boolean;
  roles: string[];
  managerId: string | null;
  territories: Array<{ id: string; name: string }>;
  leadCount: number;
  opportunityCount: number;
}

export interface InvalidAssignment {
  representative: HierarchyNodeUser;
  managerId: string | null;
  reason: 'MISSING_MANAGER' | 'INACTIVE_MANAGER' | 'NON_SALES_MANAGER' | 'SELF_REFERENCE' | 'CYCLE';
  reasonLabel: string;
}

export interface SalesHierarchyResponse {
  managers: Array<HierarchyNodeUser & {
    directReports: HierarchyNodeUser[];
    indirectReportCount: number;
  }>;
  unassignedReps: HierarchyNodeUser[];
  invalidAssignments: InvalidAssignment[];
  managerOptions: Array<HierarchyNodeUser>;
  summary: {
    managerCount: number;
    activeManagerCount: number;
    inactiveManagerCount: number;
    salesRepCount: number;
    activeSalesRepCount: number;
    inactiveSalesRepCount: number;
    assignedRepCount: number;
    unassignedRepCount: number;
    invalidAssignmentCount: number;
  };
}

const userSelect = {
  id: true,
  tenantId: true,
  managerId: true,
  firstName: true,
  lastName: true,
  email: true,
  avatarUrl: true,
  jobTitle: true,
  department: true,
  isActive: true,
  roles: { select: { role: { select: { name: true } } } },
} as const;

function roleNames(user: { roles: Array<{ role: { name: string } }> }): string[] {
  return user.roles.map(({ role }) => role.name).sort();
}

function toSalesUser(user: Omit<HierarchyUser, 'roles'> & { roles: Array<{ role: { name: string } }> }): HierarchyUser {
  return { ...user, roles: roleNames(user) };
}

function displayName(user: HierarchyNodeUser): string {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
}

function assignmentReason(
  rep: HierarchyUser,
  usersById: Map<string, HierarchyUser>,
): InvalidAssignment['reason'] | null {
  if (!rep.managerId) return null;
  if (rep.managerId === rep.id) return 'SELF_REFERENCE';

  const manager = usersById.get(rep.managerId);
  if (!manager) return 'MISSING_MANAGER';
  if (!manager.roles.includes('SALES_MANAGER')) return 'NON_SALES_MANAGER';
  if (!manager.isActive) return 'INACTIVE_MANAGER';

  const visited = new Set<string>([rep.id]);
  let cursor: string | null = rep.managerId;
  while (cursor) {
    if (visited.has(cursor)) return 'CYCLE';
    visited.add(cursor);
    cursor = usersById.get(cursor)?.managerId ?? null;
  }
  return null;
}

const reasonLabels: Record<InvalidAssignment['reason'], string> = {
  MISSING_MANAGER: 'Manager user was not found in this tenant',
  INACTIVE_MANAGER: 'Assigned manager is inactive',
  NON_SALES_MANAGER: 'Assigned user is not a SALES_MANAGER',
  SELF_REFERENCE: 'Representative cannot manage themselves',
  CYCLE: 'Manager chain contains a circular relationship',
};

function addDescendantIds(rootId: string, childrenByManager: Map<string, string[]>): string[] {
  const descendants: string[] = [];
  const visited = new Set<string>();
  const queue = [...(childrenByManager.get(rootId) ?? [])];
  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    descendants.push(id);
    queue.push(...(childrenByManager.get(id) ?? []));
  }
  return descendants;
}

export async function getSalesHierarchy(tenantId: string | null): Promise<SalesHierarchyResponse> {
  const users = (await prisma.user.findMany({
    where: { tenantId },
    select: userSelect,
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { email: 'asc' }],
  })).map(toSalesUser);

  const userIds = users.map((user) => user.id);
  const [territoryMemberships, leadCounts, opportunityCounts] = await Promise.all([
    prisma.crmTerritoryMember.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, territory: { select: { id: true, name: true } } },
      orderBy: { territory: { name: 'asc' } },
    }),
    userIds.length ? prisma.crmLead.groupBy({ by: ['ownerId'], _count: true, where: { tenantId, ownerId: { in: userIds }, deletedAt: null } }) : Promise.resolve([]),
    userIds.length ? prisma.crmOpportunity.groupBy({ by: ['ownerId'], _count: true, where: { tenantId, ownerId: { in: userIds }, deletedAt: null } }) : Promise.resolve([]),
  ]);

  const territoriesByUser = new Map<string, Array<{ id: string; name: string }>>();
  territoryMemberships.forEach(({ userId, territory }) => {
    const existing = territoriesByUser.get(userId) ?? [];
    existing.push(territory);
    territoriesByUser.set(userId, existing);
  });
  const leadsByOwner = new Map(leadCounts.map((row) => [row.ownerId, row._count]));
  const opportunitiesByOwner = new Map(opportunityCounts.map((row) => [row.ownerId, row._count]));
  const usersById = new Map(users.map((user) => [user.id, user]));

  const toNode = (user: HierarchyUser): HierarchyNodeUser => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    jobTitle: user.jobTitle,
    department: user.department,
    isActive: user.isActive,
    roles: user.roles,
    managerId: user.managerId,
    territories: territoriesByUser.get(user.id) ?? [],
    leadCount: leadsByOwner.get(user.id) ?? 0,
    opportunityCount: opportunitiesByOwner.get(user.id) ?? 0,
  });

  const managers = users.filter((user) => user.roles.includes('SALES_MANAGER'));
  const reps = users.filter((user) => user.roles.includes('SALES_REP'));
  const childrenByManager = new Map<string, string[]>();
  reps.forEach((rep) => {
    if (!rep.managerId) return;
    const children = childrenByManager.get(rep.managerId) ?? [];
    children.push(rep.id);
    childrenByManager.set(rep.managerId, children);
  });

  const unassignedReps: HierarchyNodeUser[] = [];
  const invalidAssignments: InvalidAssignment[] = [];
  const assignedRepIds = new Set<string>();
  reps.forEach((rep) => {
    if (!rep.managerId) {
      unassignedReps.push(toNode(rep));
      return;
    }
    const reason = assignmentReason(rep, usersById);
    if (reason) {
      invalidAssignments.push({ representative: toNode(rep), managerId: rep.managerId, reason, reasonLabel: reasonLabels[reason] });
      return;
    }
    assignedRepIds.add(rep.id);
  });

  const managerNodes = managers.map((manager) => {
    const directReports = (childrenByManager.get(manager.id) ?? [])
      .map((id) => usersById.get(id)!)
      .filter((rep) => assignedRepIds.has(rep.id))
      .sort((a, b) => displayName(toNode(a)).localeCompare(displayName(toNode(b))))
      .map(toNode);
    const descendants = addDescendantIds(manager.id, childrenByManager)
      .filter((id) => id !== manager.id && assignedRepIds.has(id));
    return { ...toNode(manager), directReports, indirectReportCount: Math.max(0, descendants.length - directReports.length) };
  });

  const activeManagers = managers.filter((manager) => manager.isActive).map(toNode);
  return {
    managers: managerNodes,
    unassignedReps: unassignedReps.sort((a, b) => displayName(a).localeCompare(displayName(b))),
    invalidAssignments: invalidAssignments.sort((a, b) => displayName(a.representative).localeCompare(displayName(b.representative))),
    managerOptions: activeManagers,
    summary: {
      managerCount: managers.length,
      activeManagerCount: managers.filter((manager) => manager.isActive).length,
      inactiveManagerCount: managers.filter((manager) => !manager.isActive).length,
      salesRepCount: reps.length,
      activeSalesRepCount: reps.filter((rep) => rep.isActive).length,
      inactiveSalesRepCount: reps.filter((rep) => !rep.isActive).length,
      assignedRepCount: assignedRepIds.size,
      unassignedRepCount: unassignedReps.length,
      invalidAssignmentCount: invalidAssignments.length,
    },
  };
}

export async function validateManagerAssignment(
  representativeId: string,
  managerId: string | null,
  tenantId: string | null,
  db: DbClient = prisma as unknown as Prisma.TransactionClient,
): Promise<void> {
  const representative = await db.user.findFirst({
    where: { id: representativeId, tenantId },
    select: { id: true, managerId: true, roles: { select: { role: { select: { name: true } } } } },
  });
  if (!representative) throw new AppError('Sales representative not found', 404);
  if (!representative.roles.some(({ role }) => role.name === 'SALES_REP')) {
    throw new AppError('Target user must have the SALES_REP role', 422);
  }
  if (managerId === null) return;
  if (managerId === representativeId) throw new AppError('A representative cannot manage themselves', 422);

  const manager = await db.user.findFirst({
    where: { id: managerId, tenantId },
    select: { id: true, managerId: true, isActive: true, roles: { select: { role: { select: { name: true } } } } },
  });
  if (!manager) throw new AppError('Manager not found in this tenant', 404);
  if (!manager.isActive) throw new AppError('Manager must be active', 422);
  if (!manager.roles.some(({ role }) => role.name === 'SALES_MANAGER')) {
    throw new AppError('Target manager must have the SALES_MANAGER role', 422);
  }

  const chain = await db.user.findMany({ where: { tenantId }, select: { id: true, managerId: true } });
  const managerById = new Map<string, string | null>(chain.map((user: { id: string; managerId: string | null }) => [user.id, user.managerId]));
  const visited = new Set<string>([representativeId]);
  let cursor: string | null = managerId;
  while (cursor) {
    if (visited.has(cursor)) throw new AppError('Manager assignment would create a circular relationship', 422);
    visited.add(cursor);
    cursor = managerById.get(cursor) ?? null;
  }
}

export async function updateSalesRepManager(
  representativeId: string,
  managerId: string | null,
  actor: { id: string; email: string; tenantId: string | null },
): Promise<{ id: string; managerId: string | null }> {
  return prisma.$transaction(async (tx) => {
    await validateManagerAssignment(representativeId, managerId, actor.tenantId, tx as unknown as Prisma.TransactionClient);
    const existing = await tx.user.findFirst({ where: { id: representativeId, tenantId: actor.tenantId }, select: { id: true, managerId: true } });
    if (!existing) throw new AppError('Sales representative not found', 404);
    const updated = await tx.user.update({ where: { id: representativeId }, data: { managerId }, select: { id: true, managerId: true } });
    await tx.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        userId: actor.id,
        userEmail: actor.email,
        action: 'CRM_SALES_MANAGER_CHANGED',
        resourceType: 'User',
        resourceId: representativeId,
        oldValues: { managerId: existing.managerId },
        newValues: { managerId: updated.managerId },
      },
    });
    return updated;
  });
}
