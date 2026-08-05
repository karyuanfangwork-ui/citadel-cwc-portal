/**
 * Request Access Service — P02 Task 9 (Findings #8, #10–#12, #16, #42, #55)
 *
 * Replaces the previous hardcoded ADMIN/AGENT bypass logic with the central
 * policy service. All access checks now flow through `policyService.authorize()`,
 * which enforces tenant boundary, team scope, department grant, ownership,
 * designated approver, participant, and executive role rules — without any
 * generic ADMIN or AGENT bypass that crosses desk boundaries.
 *
 * Key changes from the old implementation:
 * - ADMIN bypass is now tenant-scoped (cross-tenant ADMIN is denied)
 * - AGENT team scope is enforced via policy, not ad-hoc hasRole checks
 * - Department membership grants are evaluated by the policy service
 * - Confidentiality gate uses policy decisions instead of inline checks
 * - `getAuthorizedRequest()` is the new recommended entry point for controllers
 */

import { AuthRequest } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { policyService } from '../security/policy.service';
import { PolicyPrincipal, PolicyAction, ResourceDescriptor } from '../security/policy.types';
import { principalFromAuth } from '../security/resource-scope.service';
import prisma from '../utils/prisma';
import { UUID_RE } from '../utils/resolve';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthorizedRequestResult {
    request: any;
    decision: { allowed: true; reason: string; allowedFields?: string[] };
}

// ---------------------------------------------------------------------------
// Core access-check function
// ---------------------------------------------------------------------------

/**
 * Verify that the authenticated user can access the given request.
 *
 * Uses the central policy service for authorization decisions, replacing
 * the previous hardcoded ADMIN/AGENT bypass pattern.
 *
 * Returns the request row (with access-relevant fields) if access is granted;
 * throws AppError 404 if not found or not authorized (404 for both, to avoid
 * leaking resource existence).
 *
 * @param user       - The authenticated user from req.user
 * @param requestId  - The request UUID (must already be resolved from ref)
 * @param options    - `action` — the policy action (default: 'read')
 *                     `requireConfidential` — if true, also checks confidentiality (default: true for reads)
 */
export async function assertRequestAccess(
    user: AuthRequest['user'],
    requestId: string,
    options: { action?: PolicyAction; requireConfidential?: boolean } = {},
): Promise<any> {
    if (!user) throw new AppError('Authentication required', 401);

    const action: PolicyAction = options.action ?? 'read';

    // Load the request with all fields needed for policy evaluation
    const request = await prisma.request.findFirst({
        where: { id: requestId, deletedAt: null },
        select: {
            id: true,
            tenantId: true,
            departmentId: true,
            referenceNumber: true,
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

    if (!request) throw new AppError('Request not found', 404);

    // Build the resource descriptor for policy evaluation
    const resource: ResourceDescriptor = {
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

    // Build the principal descriptor from the user
    const principal: PolicyPrincipal = principalFromAuth(user);

    // Evaluate the policy decision
    const decision = policyService.authorize(principal, action, resource);

    if (!decision.allowed) {
        // Return 404 rather than 403 to avoid leaking resource existence
        throw new AppError('Request not found', 404);
    }

    // ── Confidentiality gate ─────────────────────────────────────────────
    // For read actions on confidential requests, check if the principal has
    // explicit confidential access. The policy service already handles this
    // in the `authorize()` flow, but we add an explicit gate here for
    // backward compatibility with controllers that pass `requireConfidential`.
    if (options.requireConfidential !== false && request.isConfidential) {
        // The policy service's `authorize()` already denies cross-desk
        // confidential access. If we reached here, the policy allowed access.
        // But we still need to check the `confidential_read` action for
        // principals who have team scope but lack the confidential permission.
        if (action === 'read' && principal.roles.includes('AGENT') && !principal.permissions.includes('request:confidential')) {
            // Re-evaluate with the stricter confidential_read action
            const confDecision = policyService.authorize(principal, 'confidential_read', resource);
            if (!confDecision.allowed) {
                throw new AppError('This request is confidential and cannot be accessed', 403);
            }
        }
    }

    return request;
}

/**
 * Get an authorized request, returning both the request data and the policy
 * decision. This is the recommended entry point for controllers that need
 * both the data and the authorization context.
 */
export async function getAuthorizedRequest(
    user: AuthRequest['user'],
    requestId: string,
    options: { action?: PolicyAction; requireConfidential?: boolean } = {},
): Promise<AuthorizedRequestResult> {
    if (!user) throw new AppError('Authentication required', 401);

    const action: PolicyAction = options.action ?? 'read';

    const request = await prisma.request.findFirst({
        where: { id: requestId, deletedAt: null },
        select: {
            id: true,
            tenantId: true,
            departmentId: true,
            referenceNumber: true,
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

    if (!request) throw new AppError('Request not found', 404);

    const resource: ResourceDescriptor = {
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

    const principal = principalFromAuth(user);
    const decision = policyService.authorize(principal, action, resource);

    if (!decision.allowed) {
        throw new AppError('Request not found', 404);
    }

    // Confidentiality gate for agents without confidential permission
    if (options.requireConfidential !== false && request.isConfidential) {
        if (action === 'read' && principal.roles.includes('AGENT') && !principal.permissions.includes('request:confidential')) {
            const confDecision = policyService.authorize(principal, 'confidential_read', resource);
            if (!confDecision.allowed) {
                throw new AppError('This request is confidential and cannot be accessed', 403);
            }
        }
    }

    return {
        request,
        decision: decision as AuthorizedRequestResult['decision'],
    };
}

/**
 * Convenience: resolve an id-or-reference param to a UUID and assert access.
 */
export async function resolveAndAssertAccess(
    user: AuthRequest['user'],
    idOrRef: string,
    options?: { action?: PolicyAction; requireConfidential?: boolean },
): Promise<any> {
    const requestId = UUID_RE.test(idOrRef)
        ? idOrRef
        : (await prisma.request.findFirst({
            // Normalize old-format reference numbers (e.g. "IT-1" → "IT-00001")
            where: { referenceNumber: idOrRef.replace(/^([A-Z]+)-(\d+)$/, (_, prefix, num) =>
                `${prefix}-${num.padStart(5, '0')}`,
            ), deletedAt: null },
            select: { id: true },
          }))?.id;

    if (!requestId) throw new AppError('Request not found', 404);
    return assertRequestAccess(user, requestId, options);
}