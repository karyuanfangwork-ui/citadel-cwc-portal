import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasPermission, hasAnyPermission } from '../utils/permissions';

interface ProtectedRouteProps {
    children: ReactNode;
    requireAdmin?: boolean;
    /** Require one or more permissions (OR logic — user needs ANY of the listed permissions) */
    requirePermission?: string | string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    requireAdmin = false,
    requirePermission,
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

    // Fine-grained permission check
    if (requirePermission) {
        const perms = Array.isArray(requirePermission) ? requirePermission : [requirePermission];
        if (!hasAnyPermission(user, perms)) {
            console.warn(`Unauthorized access attempt: User lacks permission(s): ${perms.join(', ')}`);
            return <Navigate to="/" replace />;
        }
    }

    return <>{children}</>;
};