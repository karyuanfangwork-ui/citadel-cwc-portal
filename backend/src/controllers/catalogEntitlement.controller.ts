import { Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { auditLog } from '../utils/audit';
import catalogEntitlementService from '../services/catalogEntitlement.service';
import { EntitlementTarget } from '../services/catalogEntitlement.service';

class CatalogEntitlementController {
    /**
     * GET /api/v1/admin/catalog-entitlements?requestTypeId=...
     * List entitlements (optionally filtered by request type).
     */
    list = asyncHandler(async (req: AuthRequest, res: Response) => {
        const requestTypeId = req.query.requestTypeId as string | undefined;
        const entitlements = await catalogEntitlementService.listAll(requestTypeId);

        res.json({ status: 'success', data: { entitlements } });
    });

    /**
     * GET /api/v1/admin/catalog-entitlements/:id
     * Get a single entitlement by ID.
     */
    get = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = req.params.id as string;
        const entitlements = await catalogEntitlementService.listAll();
        const entitlement = entitlements.find((e: any) => e.id === id);

        if (!entitlement) {
            return res.status(404).json({ status: 'error', message: 'Entitlement not found' });
        }

        res.json({ status: 'success', data: { entitlement } });
    });

    /**
     * POST /api/v1/admin/catalog-entitlements
     * Create an entitlement rule.
     */
    create = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { requestTypeId, targetType, targetId, isActive } = req.body;

        const entitlement = await catalogEntitlementService.create({
            requestTypeId,
            targetType,
            targetId: targetId || null,
            isActive: isActive ?? true,
        });

        await auditLog(req, 'ADMIN_CREATE_CATALOG_ENTITLEMENT', 'CatalogEntitlement', entitlement.id, {
            requestTypeId,
            targetType,
            targetId,
        });

        res.status(201).json({ status: 'success', data: { entitlement } });
    });

    /**
     * PUT /api/v1/admin/catalog-entitlements/:id
     * Update an entitlement rule.
     */
    update = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = req.params.id as string;
        const { targetType, targetId, isActive } = req.body as {
            targetType?: string;
            targetId?: string;
            isActive?: boolean;
        };

        const entitlement = await catalogEntitlementService.update(id, {
            targetType: targetType as EntitlementTarget | undefined,
            targetId: targetId !== undefined ? (targetId || null) : undefined,
            isActive,
        });

        await auditLog(req, 'ADMIN_UPDATE_CATALOG_ENTITLEMENT', 'CatalogEntitlement', id, {
            targetType: entitlement.targetType,
            targetId: entitlement.targetId,
        });

        res.json({ status: 'success', data: { entitlement } });
    });

    /**
     * DELETE /api/v1/admin/catalog-entitlements/:id
     * Delete an entitlement rule.
     */
    delete = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = req.params.id as string;

        await catalogEntitlementService.delete(id);

        await auditLog(req, 'ADMIN_DELETE_CATALOG_ENTITLEMENT', 'CatalogEntitlement', id, {});

        res.json({ status: 'success', data: null });
    });

    /**
     * POST /api/v1/admin/catalog-entitlements/check
     * Check if the current user is entitled to a request type.
     */
    checkEntitlement = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { requestTypeId } = req.body;
        const user = req.user!;

        const entitled = await catalogEntitlementService.isUserEntitled(requestTypeId, {
            id: user.id,
            roles: user.roles,
            agentTeam: user.agentTeam ?? null,
            entityId: user.entityId ?? null,
        });

        res.json({ status: 'success', data: { entitled } });
    });
}

export default new CatalogEntitlementController();