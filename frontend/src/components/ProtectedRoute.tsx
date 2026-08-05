import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasPermission, hasAnyPermission, hasAllPermissions, hasDepartment } from '../utils/permissions';

interface ProtectedRouteProps {
    children: ReactNode;
    /** Legacy: require admin:access permission (shorthand) */
    requireAdmin?: boolean;
    /** Require one or more permissions (OR logic — user needs ANY of the listed permissions) */
    requirePermission?: string | string[];
    /** Require ALL listed permissions (AND logic — user needs EVERY listed permission) */
    requireAllPermissions?: string[];
    /** Require membership in one or more departments (OR logic — user must be in ANY listed department) */
    requireDepartment?: string | string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    requireAdmin = false,
    requirePermission,
    requireAllPermissions,
    requireDepartment,
}) => {
    const { isAuthenticated, user, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#0052cc]"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Legacy support: requireAdmin still works as shorthand for requirePermission='admin:access'
    if (requireAdmin && !hasPermission(user, 'admin:access')) {
        console.warn('Unauthorized access attempt: User lacks admin:access permission');
        return <Navigate to="/" replace />;
    }

    // Fine-grained permission check (OR logic)
    if (requirePermission) {
        const perms = Array.isArray(requirePermission) ? requirePermission : [requirePermission];
        if (!hasAnyPermission(user, perms)) {
            console.warn(`Unauthorized access attempt: User lacks permission(s): ${perms.join(', ')}`);
            return <Navigate to="/" replace />;
        }
    }

    // All-permissions check (AND logic) — Task 14: user must have EVERY listed permission
    if (requireAllPermissions && requireAllPermissions.length > 0) {
        if (!hasAllPermissions(user, requireAllPermissions)) {
            console.warn(`Unauthorized access attempt: User lacks all required permissions: ${requireAllPermissions.join(', ')}`);
            return <Navigate to="/" replace />;
        }
    }

    // Department membership check — Task 14: user must be a member of at least one listed department
    if (requireDepartment) {
        const depts = Array.isArray(requireDepartment) ? requireDepartment : [requireDepartment];
        if (!hasDepartment(user, depts)) {
            console.warn(`Unauthorized access attempt: User is not a member of department(s): ${depts.join(', ')}`);
            return <Navigate to="/" replace />;
        }
    }

    return <>{children}</>;
};