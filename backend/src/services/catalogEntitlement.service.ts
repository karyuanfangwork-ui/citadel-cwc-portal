/**
 * P5-02: Catalog Entitlement Service
 *
 * Manages which users can see which catalog items based on role, department, or entity.
 *
 * Entitlement logic:
 * - If a RequestType has NO entitlements → visible to everyone (open access)
 * - If a RequestType has entitlements → visible only to users matching at least one rule.
 * - targetType=ALL means visible to any authenticated user (no targetId needed).
 */

import prisma from '../utils/prisma';
import { AppError } from '../middleware/error.middleware';

export type EntitlementTarget = 'ROLE' | 'DEPARTMENT' | 'ENTITY' | 'ALL';

interface CreateEntitlementData {
    requestTypeId: string;
    targetType: EntitlementTarget;
    targetId?: string | null;
    isActive?: boolean;
}

interface UpdateEntitlementData {
    targetType?: EntitlementTarget;
    targetId?: string | null;
    isActive?: boolean;
}

class CatalogEntitlementService {
    /**
     * List entitlements for a request type.
     */
    async listByRequestType(requestTypeId: string) {
        return prisma.catalogEntitlement.findMany({
            where: { requestTypeId, isActive: true },
            orderBy: { targetType: 'asc' },
        });
    }

    /**
     * List all entitlements (admin view).
     */
    async listAll(requestTypeId?: string) {
        const where: any = {};
        if (requestTypeId) where.requestTypeId = requestTypeId;
        return prisma.catalogEntitlement.findMany({
            where,
            include: { requestType: { select: { id: true, name: true } } },
            orderBy: [{ targetType: 'asc' }, { createdAt: 'desc' }],
        });
    }

    /**
     * Create an entitlement rule.
     */
    async create(data: CreateEntitlementData) {
        // Verify request type exists
        const rt = await prisma.requestType.findUnique({ where: { id: data.requestTypeId } });
        if (!rt) throw new AppError('Request type not found', 404);

        // Validate targetId based on targetType
        if (data.targetType === 'ALL') {
            // ALL doesn't need a targetId
            data.targetId = null;
        } else if (!data.targetId) {
            throw new AppError(`targetId is required for targetType=${data.targetType}`, 400);
        }

        // Check for duplicates
        const existing = await prisma.catalogEntitlement.findFirst({
            where: {
                requestTypeId: data.requestTypeId,
                targetType: data.targetType as any,
                targetId: data.targetId || null,
                isActive: true,
            },
        });
        if (existing) {
            throw new AppError('Entitlement rule already exists for this target', 409);
        }

        return prisma.catalogEntitlement.create({
            data: {
                requestTypeId: data.requestTypeId,
                targetType: data.targetType as any,
                targetId: data.targetId || null,
                isActive: data.isActive ?? true,
            },
        });
    }

    /**
     * Update an entitlement rule.
     */
    async update(id: string, data: UpdateEntitlementData) {
        const entitlement = await prisma.catalogEntitlement.findUnique({ where: { id } });
        if (!entitlement) throw new AppError('Entitlement not found', 404);

        return prisma.catalogEntitlement.update({
            where: { id },
            data: {
                ...(data.targetType && { targetType: data.targetType as any }),
                ...(data.targetId !== undefined && { targetId: data.targetId || null }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
            },
        });
    }

    /**
     * Delete (deactivate) an entitlement rule.
     */
    async delete(id: string) {
        const entitlement = await prisma.catalogEntitlement.findUnique({ where: { id } });
        if (!entitlement) throw new AppError('Entitlement not found', 404);

        return prisma.catalogEntitlement.delete({ where: { id } });
    }

    /**
     * Check if a user is entitled to a specific request type.
     *
     * Returns true if:
     * - The request type has no entitlements (open access), OR
     * - The user matches at least one active entitlement rule.
     */
    async isUserEntitled(requestTypeId: string, user: { id: string; roles: string[]; agentTeam?: string | null; departmentIds?: string[]; entityId?: string | null }): Promise<boolean> {
        const entitlements = await prisma.catalogEntitlement.findMany({
            where: { requestTypeId, isActive: true },
        });

        // No entitlements = open access
        if (entitlements.length === 0) return true;

        for (const ent of entitlements) {
            switch (ent.targetType) {
                case 'ALL':
                    return true; // Any authenticated user
                case 'ROLE':
                    if (user.roles.includes(ent.targetId!)) return true;
                    break;
                case 'DEPARTMENT':
                    if (user.departmentIds?.includes(ent.targetId!) || user.agentTeam === ent.targetId) return true;
                    break;
                case 'ENTITY':
                    if (user.entityId === ent.targetId) return true;
                    break;
            }
        }

        return false;
    }

    /**
     * Filter a list of request types to only those the user is entitled to see.
     */
    async filterEntitledRequestTypes(
        requestTypeIds: string[],
        user: { id: string; roles: string[]; agentTeam?: string | null; departmentIds?: string[]; entityId?: string | null },
    ): Promise<string[]> {
        const entitlements = await prisma.catalogEntitlement.findMany({
            where: { requestTypeId: { in: requestTypeIds }, isActive: true },
        });

        // Group entitlements by requestTypeId
        const byType = new Map<string, Set<typeof entitlements[0]>>();
        for (const ent of entitlements) {
            if (!byType.has(ent.requestTypeId)) byType.set(ent.requestTypeId, new Set());
            byType.get(ent.requestTypeId)!.add(ent);
        }

        const result: string[] = [];
        for (const typeId of requestTypeIds) {
            const typeEntitlements = byType.get(typeId);
            // No entitlements = open access
            if (!typeEntitlements || typeEntitlements.size === 0) {
                result.push(typeId);
                continue;
            }

            for (const ent of typeEntitlements) {
                switch (ent.targetType) {
                    case 'ALL':
                        result.push(typeId);
                        break;
                    case 'ROLE':
                        if (user.roles.includes(ent.targetId!)) { result.push(typeId); break; }
                        continue;
                    case 'DEPARTMENT':
                        if (user.departmentIds?.includes(ent.targetId!) || user.agentTeam === ent.targetId) { result.push(typeId); break; }
                        continue;
                    case 'ENTITY':
                        if (user.entityId === ent.targetId) { result.push(typeId); break; }
                        continue;
                }
            }
        }

        return [...new Set(result)]; // dedupe
    }
}

export default new CatalogEntitlementService();