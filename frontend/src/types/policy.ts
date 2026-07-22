/**
 * Task 14: Policy types for frontend route/action consumption.
 *
 * These types mirror the backend auth middleware's request user shape
 * and define the contract for server-authoritative policy decisions.
 */

/**
 * Department membership returned from /users/me.
 * Provides the department ID and code for department-aware routing.
 */
export interface DepartmentInfo {
    id: string;
    code: string;
    name: string;
}

/**
 * Allowed action for a resource type, returned by the policy endpoint.
 * Frontend uses this to render/hide action buttons.
 */
export interface AllowedAction {
    resource: string;   // e.g. 'request', 'asset', 'creditApplication'
    action: string;     // e.g. 'create', 'approve', 'delete', 'export'
    scope: 'own' | 'department' | 'tenant' | 'all';
}

/**
 * Policy decision returned by /users/me/policy.
 * Consumed by ProtectedRoute, navConfig, and action-gated components.
 */
export interface PolicyDecision {
    /** Flat list of permission strings from role + direct grants */
    permissions: string[];
    /** Departments the user is a current member of */
    departments: DepartmentInfo[];
    /** Actions the user is authorised to perform, scoped by resource/scope */
    allowedActions: AllowedAction[];
}

/**
 * Check if the policy allows a specific action on a resource.
 * Usage: isAllowed(policy, 'request', 'approve')
 */
export function isAllowed(
    policy: PolicyDecision | null,
    resource: string,
    action: string,
): boolean {
    if (!policy) return false;
    return policy.allowedActions.some(
        (a) => a.resource === resource && a.action === action,
    );
}

/**
 * Check if the policy allows a specific action on a resource with minimum scope.
 * Usage: isAllowedWithScope(policy, 'request', 'export', 'department')
 */
export function isAllowedWithScope(
    policy: PolicyDecision | null,
    resource: string,
    action: string,
    minimumScope: 'own' | 'department' | 'tenant' | 'all',
): boolean {
    if (!policy) return false;
    const scopeOrder = ['own', 'department', 'tenant', 'all'] as const;
    const minIdx = scopeOrder.indexOf(minimumScope);
    return policy.allowedActions.some((a) => {
        if (a.resource !== resource || a.action !== action) return false;
        return scopeOrder.indexOf(a.scope) >= minIdx;
    });
}