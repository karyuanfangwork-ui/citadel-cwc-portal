/**
 * Audit writer for authentication events.
 *
 * Authentication requests may not have req.user, so this helper accepts the
 * tenant explicitly and never lets an audit failure affect the auth response.
 */
import prisma from './prisma';
import { logger } from './logger';

export type AuthAuditAction = 'AUTH_LOGIN_SUCCESS' | 'AUTH_LOGIN_FAILED' | 'AUTH_LOGOUT';

export interface AuthAuditInput {
    action: AuthAuditAction;
    email: string;
    userId?: string | null;
    tenantId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    reason?: string;
}

export async function recordAuthEvent(input: AuthAuditInput): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                tenantId: input.tenantId ?? null,
                userId: input.userId ?? null,
                userEmail: input.email,
                action: input.action,
                resourceType: 'AUTH',
                resourceId: input.userId ?? null,
                ipAddress: input.ipAddress ?? null,
                userAgent: input.userAgent ?? null,
                newValues: {
                    email: input.email,
                    ...(input.reason ? { reason: input.reason } : {}),
                },
            },
        });
    } catch (error) {
        logger.error('[AuthAudit] Failed to write auth audit row', { action: input.action, error });
    }
}
