import prisma from '../utils/prisma';

export interface ScopeUser {
  id: string;
  roles: string[];
  permissions: string[];
}

export interface ScopeDeps {
  getReportIds: (rootId: string) => Promise<string[]>;
  getTerritoryPeerIds: (userId: string) => Promise<string[]>;
}

/**
 * Recursively collect all reports under a manager (direct + indirect).
 */
async function defaultGetReportIds(rootId: string): Promise<string[]> {
  const collected = new Set<string>();
  let frontier = [rootId];
  while (frontier.length) {
    const reports = await prisma.user.findMany({
      where: { managerId: { in: frontier } },
      select: { id: true },
    });
    const next = reports.map((r) => r.id).filter((id) => !collected.has(id));
    next.forEach((id) => collected.add(id));
    frontier = next;
  }
  return [...collected];
}

/**
 * Find all peer user IDs across this user's territories.
 */
async function defaultGetTerritoryPeerIds(userId: string): Promise<string[]> {
  const myTerritories = await prisma.crmTerritoryMember.findMany({
    where: { userId },
    select: { territoryId: true },
  });
  if (!myTerritories.length) return [];
  const peers = await prisma.crmTerritoryMember.findMany({
    where: { territoryId: { in: myTerritories.map((t) => t.territoryId) } },
    select: { userId: true },
  });
  return peers.map((p) => p.userId);
}

/**
 * Returns the list of owner IDs a user may see, or `null` for unrestricted (admin).
 */
export async function resolveVisibleOwnerIds(
  user: ScopeUser,
  deps: ScopeDeps = {
    getReportIds: defaultGetReportIds,
    getTerritoryPeerIds: defaultGetTerritoryPeerIds,
  },
): Promise<string[] | null> {
  if (user.roles.includes('ADMIN') || user.permissions.includes('crm:admin')) {
    return null;
  }
  const ids = new Set<string>([user.id]);
  if (user.permissions.includes('crm:read:team')) {
    (await deps.getReportIds(user.id)).forEach((id) => ids.add(id));
    (await deps.getTerritoryPeerIds(user.id)).forEach((id) => ids.add(id));
  }
  return [...ids];
}

/**
 * Applies owner scoping to a Prisma `where` clause.
 * When `visibleOwnerIds` is null (admin), the where clause is returned unchanged.
 * When it's a list, `{ ownerId: { in: [...] } }` is merged in.
 * Note: ownerId is non-nullable in the schema, so null-owner records cannot exist.
 */
export function applyOwnerScope<T extends Record<string, any>>(
  where: T,
  visibleOwnerIds: string[] | null,
): T {
  if (visibleOwnerIds === null) return where;
  return { ...where, ownerId: { in: visibleOwnerIds } };
}

/**
 * Applies the same visibility scope to user lookups used by CRM owner pickers.
 * Admins remain unrestricted; other users only receive permitted owner IDs.
 */
export function applyUserScope<T extends Record<string, any>>(
  where: T,
  visibleOwnerIds: string[] | null,
): T {
  if (visibleOwnerIds === null) return where;
  return { ...where, id: { in: visibleOwnerIds } };
}
