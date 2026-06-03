import { PrismaClient } from '@prisma/client';
import { createRedisClient } from '../utils/redis';
import { logger } from '../utils/logger';

const redis = createRedisClient();
const prisma = new PrismaClient();

const CACHE_PREFIX = 'rbac:perms:';
const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Resolves the set of permission names for a user by looking up all their roles
 * and the permissions attached to those roles via the RolePermission join table.
 *
 * Results are cached in Redis for CACHE_TTL_SECONDS to avoid DB hits on every request.
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
    // 1. Try Redis cache first
    const cacheKey = `${CACHE_PREFIX}${userId}`;
    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached) as string[];
        }
    } catch (err) {
        logger.warn(`RBAC cache read failed for user ${userId}`, { err });
        // Fall through to DB query
    }

    // 2. Query DB: user → roles → role_permissions → permissions
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            roles: {
                include: {
                    role: {
                        include: {
                            permissions: {
                                include: {
                                    permission: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!user) return [];

    // Collect unique permission names across all roles
    const permissionNames = new Set<string>();
    for (const userRole of user.roles) {
        for (const rolePerm of userRole.role.permissions) {
            permissionNames.add(rolePerm.permission.name);
        }
    }

    const result = Array.from(permissionNames);

    // 3. Cache the result
    try {
        await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(result));
    } catch (err) {
        logger.warn(`RBAC cache write failed for user ${userId}`, { err });
    }

    return result;
}

/**
 * Check if a user has a specific permission (by name).
 * Permission names follow the format: `resource:action` (e.g. `request:create`, `admin:access`).
 */
export async function hasPermission(userId: string, permissionName: string): Promise<boolean> {
    const permissions = await getUserPermissions(userId);
    return permissions.includes(permissionName);
}

/**
 * Check if a user has a specific permission for a resource+action pair.
 * Resolves to the permission name `resource:action` internally.
 */
export async function checkPermission(userId: string, resource: string, action: string): Promise<boolean> {
    return hasPermission(userId, `${resource}:${action}`);
}

/**
 * Invalidate cached permissions for a user.
 * Call this after role or permission changes so the next request fetches fresh data.
 */
export async function invalidateUserPermissionsCache(userId: string): Promise<void> {
    try {
        await redis.del(`${CACHE_PREFIX}${userId}`);
    } catch (err) {
        logger.warn(`RBAC cache invalidation failed for user ${userId}`, { err });
    }
}

/**
 * Invalidate ALL cached permissions. Use after bulk permission or role-permission changes.
 */
export async function invalidateAllPermissionsCache(): Promise<void> {
    try {
        // Scan for all keys with the RBAC prefix and delete them
        let cursor = '0';
        do {
            const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${CACHE_PREFIX}*`, 'COUNT', 100);
            if (keys.length > 0) {
                await redis.del(...keys);
            }
            cursor = nextCursor;
        } while (cursor !== '0');
    } catch (err) {
        logger.warn('RBAC full cache invalidation failed', { err });
    }
}

export const permissionService = {
    getUserPermissions,
    hasPermission,
    checkPermission,
    invalidateUserPermissionsCache,
    invalidateAllPermissionsCache,
};