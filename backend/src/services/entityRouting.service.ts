import prisma from '../utils/prisma';
import { ApprovalStatus } from '@prisma/client';

interface RoutingContext {
    requestId: string;
    requestTypeId: string;
    requesterId: string;
    customFields: Record<string, any>;
}

/**
 * Resolves entities to approvers and creates parallel RequestApproval records
 * based on the routing rules configured for the given request type.
 *
 * - REQUESTER_ENTITY mode: looks up the requester's entityId, then resolves the entity.
 * - CUSTOM_FIELD mode: reads an entity code from customFields[rule.customFieldKey],
 *   then looks up the entity by code.
 *
 * Deduplicates entities, skips inactive ones, and avoids duplicate approval records
 * for the same request+entity pair.
 */
export async function applyEntityRouting(ctx: RoutingContext): Promise<void> {
    const { requestId, requestTypeId, requesterId, customFields } = ctx;

    // Fetch all active routing rules for this request type
    const rules = await prisma.requestTypeEntityRouting.findMany({
        where: { requestTypeId, isActive: true },
    });

    if (rules.length === 0) return;

    // Collect entity codes/ids to look up
    const entityCodesToResolve: string[] = [];

    for (const rule of rules) {
        if (rule.routingMode === 'REQUESTER_ENTITY') {
            // Look up which entity the requester belongs to
            const requester = await prisma.user.findUnique({
                where: { id: requesterId },
                select: { entityId: true },
            });
            if (!requester?.entityId) {
                console.warn(`[EntityRouting] Requester ${requesterId} has no entityId assigned — skipping REQUESTER_ENTITY rule`);
                continue;
            }
            // Store the entityId directly (we'll resolve by id below)
            entityCodesToResolve.push(`__id:${requester.entityId}`);
        } else if (rule.routingMode === 'CUSTOM_FIELD' && rule.customFieldKey) {
            const code = customFields?.[rule.customFieldKey];
            if (!code) {
                console.warn(`[EntityRouting] customField key "${rule.customFieldKey}" missing or empty — skipping rule`);
                continue;
            }
            entityCodesToResolve.push(String(code).trim().toUpperCase());
        }
    }

    if (entityCodesToResolve.length === 0) return;

    // Deduplicate
    const unique = Array.from(new Set(entityCodesToResolve));

    // Resolve entities
    const entities = await Promise.all(
        unique.map((codeOrId) => {
            if (codeOrId.startsWith('__id:')) {
                const entityId = codeOrId.replace('__id:', '');
                return prisma.entity.findUnique({
                    where: { id: entityId },
                    select: { id: true, approverId: true, isActive: true },
                });
            }
            return prisma.entity.findUnique({
                where: { code: codeOrId },
                select: { id: true, approverId: true, isActive: true },
            });
        })
    );

    // Create approval records for each resolved entity in parallel
    await Promise.all(
        entities.map(async (entity) => {
            if (!entity) return;

            if (!entity.isActive) {
                console.warn(`[EntityRouting] Entity ${entity.id} is inactive — skipping`);
                return;
            }

            // Avoid duplicate approval records for same entity+request
            const existing = await prisma.requestApproval.findFirst({
                where: { requestId, entityId: entity.id },
            });
            if (existing) return;

            await prisma.requestApproval.create({
                data: {
                    requestId,
                    approverType: 'ENTITY',
                    approverId: entity.approverId,
                    entityId: entity.id,
                    status: ApprovalStatus.PENDING,
                },
            });
        })
    );
}

/**
 * Returns true only when ALL entity approval records for a request are APPROVED.
 * Returns false if any are PENDING or REJECTED.
 */
export async function allEntityApprovalsResolved(requestId: string): Promise<{ allApproved: boolean; anyRejected: boolean }> {
    const approvals = await prisma.requestApproval.findMany({
        where: { requestId, approverType: 'ENTITY' },
        select: { status: true },
    });

    if (approvals.length === 0) return { allApproved: true, anyRejected: false };

    const anyRejected = approvals.some((a) => a.status === ApprovalStatus.REJECTED);
    const allApproved = approvals.every((a) => a.status === ApprovalStatus.APPROVED);

    return { allApproved, anyRejected };
}