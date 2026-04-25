/**
 * Permission utilities for frontend RBAC.
 *
 * Usage:
 *   import { hasPermission, hasAnyPermission, hasRole } from '@/utils/permissions';
 *   const canManageKB = hasPermission(user, 'kb:manage');
 *   const canViewReports = hasPermission(user, 'report:read');
 *   const canAssignOrManage = hasAnyPermission(user, ['request:assign', 'admin:access']);
 */

import type { User } from '../context/AuthContext';

/**
 * Check if a user has a specific permission.
 * Returns true if the user has the exact permission string in their permissions array.
 * Admin role users always return true (they have all permissions).
 */
export function hasPermission(user: User | null, permission: string): boolean {
    if (!user) return false;
    // ADMIN role has unconditional access
    if (user.roles?.some(r => r === 'ADMIN')) return true;
    return user.permissions?.includes(permission) ?? false;
}

/**
 * Check if a user has ANY of the specified permissions (OR logic).
 * Returns true if the user has at least one of the listed permissions.
 * Admin role users always return true.
 */
export function hasAnyPermission(user: User | null, permissions: string[]): boolean {
    if (!user) return false;
    if (user.roles?.some(r => r === 'ADMIN')) return true;
    return permissions.some(p => user.permissions?.includes(p) ?? false);
}

/**
 * Check if a user has ALL of the specified permissions (AND logic).
 * Admin role users always return true.
 */
export function hasAllPermissions(user: User | null, permissions: string[]): boolean {
    if (!user) return false;
    if (user.roles?.some(r => r === 'ADMIN')) return true;
    return permissions.every(p => user.permissions?.includes(p) ?? false);
}

/**
 * Check if a user has a specific role.
 */
export function hasRole(user: User | null, role: string): boolean {
    if (!user) return false;
    return user.roles?.includes(role) ?? false;
}

/**
 * Check if a user has ANY of the specified roles (OR logic).
 */
export function hasAnyRole(user: User | null, roles: string[]): boolean {
    if (!user) return false;
    return user.roles?.some(r => roles.includes(r)) ?? false;
}