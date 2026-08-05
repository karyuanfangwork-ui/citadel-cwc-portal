/**
 * Permission utilities for frontend RBAC.
 *
 * Task 14: ADMIN bypass has been REMOVED. All permission checks now
 * use the server-authoritative permission list. ADMIN role grants are
 * handled by the backend permission service which includes all permissions
 * for admin users in the permissions array — no client-side bypass needed.
 *
 * Usage:
 *   import { hasPermission, hasAnyPermission, hasAllPermissions, hasDepartment } from '@/utils/permissions';
 *   const canManageKB = hasPermission(user, 'kb:manage');
 *   const canViewReports = hasPermission(user, 'report:read');
 *   const canAssignOrManage = hasAnyPermission(user, ['request:assign', 'admin:access']);
 */

import type { User } from '../context/AuthContext';

/** Check if a user has a specific permission. */
export function hasPermission(user: User | null, permission: string): boolean {
    if (!user) return false;
    return user.permissions?.includes(permission) ?? false;
}

/** Check if a user has ANY of the specified permissions (OR logic). */
export function hasAnyPermission(user: User | null, permissions: string[]): boolean {
    if (!user) return false;
    return permissions.some(p => user.permissions?.includes(p) ?? false);
}

/** Check if a user has ALL of the specified permissions (AND logic). */
export function hasAllPermissions(user: User | null, permissions: string[]): boolean {
    if (!user) return false;
    return permissions.every(p => user.permissions?.includes(p) ?? false);
}

/** Check if a user has a specific role. */
export function hasRole(user: User | null, role: string): boolean {
    if (!user) return false;
    return user.roles?.includes(role) ?? false;
}

/** Check if a user has ANY of the specified roles (OR logic). */
export function hasAnyRole(user: User | null, roles: string[]): boolean {
    if (!user) return false;
    return user.roles?.some(r => roles.includes(r)) ?? false;
}

/**
 * Check if a user is a member of at least one of the given departments.
 * Uses departmentIds (from auth context / /users/me) for fast O(n) checks
 * without requiring department code lookups.
 *
 * Task 14: Department membership is server-authoritative. The user's
 * departmentIds come from /users/me and are populated by auth middleware.
 */
export function hasDepartment(user: User | null, departmentIds: string[]): boolean {
    if (!user) return false;
    if (!user.departmentIds || user.departmentIds.length === 0) return false;
    return departmentIds.some(id => user.departmentIds!.includes(id));
}