import { ExecutiveRole, User } from '@prisma/client';

/**
 * Executive approval hierarchy for high-value requests.
 * Order matters: CEO > CTO > CFO > COO > CHRO
 */
export const EXECUTIVE_HIERARCHY: ExecutiveRole[] = [
    'CEO',
    'CTO',
    'CFO',
    'COO',
    'CHRO',
];

/**
 * Check if a user has any executive role
 */
export function isExecutive(user: Pick<User, 'executiveRole'>): boolean {
    return user.executiveRole !== null && user.executiveRole !== undefined;
}

/**
 * Check if user has a specific executive role
 */
export function hasExecutiveRole(user: Pick<User, 'executiveRole'>, role: ExecutiveRole): boolean {
    return user.executiveRole === role;
}

/**
 * Get the hierarchy level of an executive role (0 = highest, 4 = lowest)
 */
export function getExecutiveLevel(role: ExecutiveRole | null | undefined): number {
    if (!role) return -1;
    const index = EXECUTIVE_HIERARCHY.indexOf(role);
    return index === -1 ? -1 : index;
}

/**
 * Check if a user can approve requests requiring a specific executive level
 * A higher-ranking executive can approve lower-level requests
 */
export function canApproveExecutiveRequest(
    approver: Pick<User, 'executiveRole'>,
    requiredRole: ExecutiveRole
): boolean {
    const approverLevel = getExecutiveLevel(approver.executiveRole);
    const requiredLevel = getExecutiveLevel(requiredRole);

    if (approverLevel === -1 || requiredLevel === -1) return false;

    // Lower index = higher rank (CEO=0 can approve anything)
    return approverLevel <= requiredLevel;
}

/**
 * Get the appropriate executive approver based on request type
 */
export function getRequiredExecutiveRole(requestType: string, amount?: number): ExecutiveRole | null {
    // IT Hardware requests over threshold
    if (requestType.includes('Hardware') && amount && amount >= 50000) {
        return 'CFO';
    }

    // Company-wide policy changes
    if (requestType.includes('Policy') && requestType.includes('Company')) {
        return 'CEO';
    }

    // Department-level changes
    if (requestType.includes('Department')) {
        return 'COO';
    }

    // HR policy or hiring at executive level
    if (requestType.includes('HR') || requestType.includes('Hiring')) {
        return 'CHRO';
    }

    // Technology infrastructure over threshold
    if (requestType.includes('Technology') || requestType.includes('Infrastructure')) {
        return 'CTO';
    }

    return null;
}

/**
 * Validate that a user can be assigned an executive role
 * Admins can assign any executive role without restrictions
 */
export function validateExecutiveRoleAssignment(
    _user: Pick<User, 'department' | 'jobTitle'>,
    _role: ExecutiveRole
): { valid: boolean; reason?: string } {
    // No validation - admins can assign executive roles freely
    return { valid: true };
}
