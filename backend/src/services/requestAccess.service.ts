import { AuthRequest, hasRole } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import prisma from '../utils/prisma';
import { UUID_RE } from '../utils/resolve';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Core access-check function
// ---------------------------------------------------------------------------

/**
 * Verify that the authenticated user can access the given request.
 *
 * Mirrors the logic in RequestController.getRequestById (lines 1554-1565)
 * but extracted so it can be reused by attachment, activity, and other
 * sub-resource endpoints.
 *
 * Returns the request row (with the fields needed for access decisions) if
 * access is granted; throws AppError 403/404 if not.
 *
 * @param user       - The authenticated user from req.user
 * @param requestId  - The request UUID (must already be resolved from ref)
 * @param options    - `requireConfidential` — if true, also checks the
 *                     confidentiality gate (default: true for reads)
 */
export async function assertRequestAccess(
    user: AuthRequest['user'],
    requestId: string,
    options: { requireConfidential?: boolean } = {},
): Promise<any> {
    if (!user) throw new AppError('Authentication required', 401);

    const request = await prisma.request.findFirst({
        where: { id: requestId, deletedAt: null },
        select: {
            id: true,
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

    // ── Access gate ──────────────────────────────────────────────────────
    // 1. Requester always has access
    // 2. ADMIN always has access
    // 3. AGENT scoped to their team (serviceDesk.code or assignedTeam matches agentTeam)
    // 4. CEO/CTO/CFO/GROUP_DCEO with status-based approver access
    // 5. Participant in the request
    // 6. Designated approver on the request

    const isParticipant = request.participants?.some((p: any) => p.userId === user.id) ?? false;
    const isDesignatedApprover = request.approvals?.some((a: any) => a.approverId === user.id);

    const ceoHiringStatuses = [
        'PENDING_CEO_APPROVAL', 'CEO_APPROVED', 'CEO_REJECTED',
        'JOB_POSTED', 'PENDING_MANAGER_REVIEW', 'MANAGER_APPROVED',
    ];
    const isCEOApprover = hasRole({ user } as AuthRequest, 'CEO') && (
        ceoHiringStatuses.includes(request.status) ||
        request.status === 'PENDING_CEO_APPROVAL_IT' ||
        isDesignatedApprover
    );
    const isCTOApprover = hasRole({ user } as AuthRequest, 'CTO') && (
        request.status === 'PENDING_CTO_APPROVAL_IT' ||
        isDesignatedApprover
    );
    const isCFOApprover = hasRole({ user } as AuthRequest, 'CFO') && (
        request.status === 'PENDING_CFO_APPROVAL_IT' ||
        request.status === 'PENDING_CFO_APPROVAL_FIN' ||
        isDesignatedApprover
    );

    const chargebackStatuses = [
        'PENDING_FROM_ENTITY_APPROVAL', 'FROM_ENTITY_REJECTED',
        'PENDING_TO_ENTITY_APPROVAL', 'TO_ENTITY_REJECTED',
        'CHARGEBACK_FINANCE_REVIEW',
        'AWAITING_CHARGEBACK_CONFIRMATION', 'CHARGEBACK_COMPLETED',
    ];
    const isGroupDceoApprover = hasRole({ user } as AuthRequest, 'GROUP_DCEO') && (
        request.status === 'PENDING_GROUP_DCEO_APPROVAL' ||
        chargebackStatuses.includes(request.status) ||
        isDesignatedApprover ||
        request.assignedToId === user.id
    );

    const agentTeam = (user as any)?.agentTeam;
    const isAgentWithTeamScope = hasRole({ user } as AuthRequest, 'AGENT') &&
        !hasRole({ user } as AuthRequest, 'ADMIN') && agentTeam;
    const isWithinAgentTeamScope = isAgentWithTeamScope && (
        (request as any).serviceDesk?.code === agentTeam ||
        request.assignedTeam === agentTeam
    );

    const canAccess =
        request.requesterId === user.id ||
        hasRole({ user } as AuthRequest, 'ADMIN') ||
        isWithinAgentTeamScope ||
        isCEOApprover ||
        isCTOApprover ||
        isCFOApprover ||
        isGroupDceoApprover ||
        isParticipant;

    if (!canAccess) {
        throw new AppError('You do not have permission to access this request', 403);
    }

    // ── Confidentiality gate ─────────────────────────────────────────────
    if (options.requireConfidential !== false && request.isConfidential) {
        if (
            request.requesterId !== user.id &&
            request.assignedToId !== user.id &&
            !hasRole({ user } as AuthRequest, 'ADMIN') &&
            !(user.permissions?.includes('request:confidential')) &&
            !isDesignatedApprover &&
            !isCEOApprover &&
            !isCTOApprover &&
            !isCFOApprover &&
            !isGroupDceoApprover &&
            !isParticipant
        ) {
            throw new AppError('This request is confidential and cannot be accessed', 403);
        }
    }

    return request;
}

/**
 * Convenience: resolve an id-or-reference param to a UUID and assert access.
 */
export async function resolveAndAssertAccess(
    user: AuthRequest['user'],
    idOrRef: string,
    options?: { requireConfidential?: boolean },
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