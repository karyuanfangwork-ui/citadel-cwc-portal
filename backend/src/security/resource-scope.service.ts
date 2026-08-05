/**
 * Resource Scope Service — P02 Task 8 (Findings #8–#12, #16, #55, #78)
 *
 * Builds the resource descriptor from database queries, to be used with
 * the policy service's `authorize()` function. This replaces the direct
 * Prisma queries that were scattered across controllers.
 */

import prisma from '../utils/prisma';
import { ResourceDescriptor } from './policy.types';
import { PolicyPrincipal } from './policy.types';
import { getExecutionScope } from '../lib/execution-scope';
import { resolveRequestId } from '../utils/resolve';

// ── Scope Loaders ──────────────────────────────────────────────────────

/**
 * Load a request's descriptor from the database.
 * Accepts either a UUID or a reference number (e.g. "IT-00015").
 * Uses the execution scope's tenantId for tenant filtering.
 */
export async function loadRequestScope(requestIdOrRef: string, principal: PolicyPrincipal): Promise<ResourceDescriptor> {
    const scope = getExecutionScope();
    const tenantId = scope?.kind === 'tenant' ? scope.tenantId : principal.tenantId;

    // Resolve reference number to UUID if needed
    const requestId = await resolveRequestId(requestIdOrRef);
    if (!requestId) {
        return { type: 'request', id: requestIdOrRef };
    }

    const request = await prisma.request.findFirst({
        where: {
            id: requestId,
            ...(tenantId ? { tenantId } : {}),
            deletedAt: null,
        },
        select: {
            id: true,
            tenantId: true,
            departmentId: true,
            requesterId: true,
            assignedToId: true,
            isConfidential: true,
            status: true,
            assignedTeam: true,
            serviceDesk: { select: { code: true } },
            approvals: { select: { approverId: true } },
            participants: { select: { userId: true } },
        },
    });

    if (!request) {
        return { type: 'request', id: requestId };
    }

    return {
        type: 'request',
        id: request.id,
        ownerId: request.requesterId ?? undefined,
        tenantId: request.tenantId ?? undefined,
        departmentId: request.departmentId ?? undefined,
        assignedToId: request.assignedToId ?? undefined,
        isConfidential: request.isConfidential,
        serviceDeskCode: (request as any).serviceDesk?.code ?? undefined,
        assignedTeam: request.assignedTeam ?? undefined,
        status: request.status ?? undefined,
        approverIds: request.approvals?.map((a: any) => a.approverId) ?? [],
        participantIds: request.participants?.map((p: any) => p.userId) ?? [],
    };
}

/**
 * Load a notification's descriptor.
 */
export async function loadNotificationScope(notificationId: string, principal: PolicyPrincipal): Promise<ResourceDescriptor> {
    const scope = getExecutionScope();
    const tenantId = scope?.kind === 'tenant' ? scope.tenantId : principal.tenantId;

    const notification = await prisma.notification.findFirst({
        where: {
            id: notificationId,
            ...(tenantId ? { tenantId } : {}),
        },
        select: { id: true, tenantId: true, userId: true },
    });

    if (!notification) {
        return { type: 'notification', id: notificationId };
    }

    return {
        type: 'notification',
        id: notification.id,
        ownerId: notification.userId ?? undefined,
        tenantId: notification.tenantId ?? undefined,
    };
}

/**
 * Build a principal descriptor from an AuthRequest user object.
 */
export function principalFromAuth(user: {
    id: string;
    tenantId?: string;
    roles: string[];
    permissions: string[];
    agentTeam?: string | null;
    departmentIds?: string[];
    entityId?: string | null;
}): PolicyPrincipal {
    return {
        userId: user.id,
        tenantId: user.tenantId,
        roles: user.roles,
        permissions: user.permissions,
        agentTeam: user.agentTeam,
        departmentIds: user.departmentIds,
        entityId: user.entityId,
    };
}