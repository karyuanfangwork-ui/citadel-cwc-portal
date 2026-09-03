/**
 * User Data Transfer Objects — P01 Task 3 (Finding #35)
 *
 * Sensitive fields (passwordHash, mfaSecret, mfaBackupCodes, resetToken,
 * resetTokenExpiry) must NEVER appear in API responses. These DTOs enforce
 * field whitelisting at the type level, and the sanitizeUser() function
 * strips sensitive fields from any Prisma user result.
 *
 * Usage:
 *   import { sanitizeUser, userSummarySelect } from '../dtos/user.dto';
 *
 *   // Option A: Use select clause (preferred — doesn't fetch sensitive columns)
 *   const user = await prisma.user.findUnique({ where: { id }, select: userSummarySelect });
 *
 *   // Option B: Sanitize after query (for include-based queries)
 *   const raw = await prisma.user.findUnique({ where: { id }, include: { roles: ... } });
 *   const user = sanitizeUser(raw);
 */

// ── Select clauses (use in Prisma queries to avoid fetching sensitive columns) ──

export const userSummarySelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    phone: true,
    avatarUrl: true,
    department: true,
    jobTitle: true,
    agentTeam: true,
    isActive: true,
    entityId: true,
    tenantId: true,
    createdAt: true,
    updatedAt: true,
    lastLoginAt: true,
    lastActiveAt: true,
    executiveRole: true,
    managerId: true,
} as const;

export const userProfileSelect = {
    ...userSummarySelect,
    isMfaEnabled: true,
    mustResetPassword: true,
    passwordChangedAt: true,
    lastPasswordChange: true,
} as const;

// ── DTO types ──

export type UserSummary = {
    [K in keyof typeof userSummarySelect]: any;
};

export type UserProfile = {
    [K in keyof typeof userProfileSelect]: any;
};

// ── Sensitive fields that must never be returned ──

const SENSITIVE_FIELDS: (keyof any)[] = [
    'passwordHash',
    'mfaSecret',
    'mfaBackupCodes',
    'resetToken',
    'resetTokenExpiry',
    'verificationToken',
    'lockoutUntil',
    'failedLoginAttempts',
];

/**
 * Strip sensitive fields from a Prisma user object (or any object).
 * Use this when you cannot use a `select` clause (e.g. include-based queries).
 *
 * Returns a new object — never mutates the input.
 */
export function sanitizeUser<T extends Record<string, any>>(user: T): Omit<T, typeof SENSITIVE_FIELDS[number]> {
    const sanitized = { ...user };
    for (const field of SENSITIVE_FIELDS) {
        delete (sanitized as any)[field];
    }
    return sanitized;
}

/**
 * Strip sensitive fields from an array of Prisma user objects.
 */
export function sanitizeUsers<T extends Record<string, any>>(users: T[]): Omit<T, typeof SENSITIVE_FIELDS[number]>[] {
    return users.map(sanitizeUser);
}