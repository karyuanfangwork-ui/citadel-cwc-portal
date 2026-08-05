import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { z } from 'zod';
import catalogEntitlementController from '../controllers/catalogEntitlement.controller';

const router = Router();

// Validation schemas
const createEntitlementSchema = z.object({
    body: z.object({
        requestTypeId: z.string().uuid('Invalid request type ID'),
        targetType: z.enum(['ROLE', 'DEPARTMENT', 'ENTITY', 'ALL']),
        targetId: z.string().max(100).optional(),
        isActive: z.boolean().default(true),
    }),
});

const updateEntitlementSchema = z.object({
    body: z.object({
        targetType: z.enum(['ROLE', 'DEPARTMENT', 'ENTITY', 'ALL']).optional(),
        targetId: z.string().max(100).optional(),
        isActive: z.boolean().optional(),
    }),
});

const checkEntitlementSchema = z.object({
    body: z.object({
        requestTypeId: z.string().uuid('Invalid request type ID'),
    }),
});

/**
 * @route   GET /api/v1/catalog-entitlements
 * @desc    List entitlements (optionally filter by requestTypeId)
 * @access  Admin — requirePermission enforces RBAC
 */
router.get('/', authenticate, requirePermission('admin:access'), catalogEntitlementController.list);

/**
 * @route   GET /api/v1/catalog-entitlements/:id
 * @desc    Get a single entitlement
 * @access  Admin
 */
router.get('/:id', authenticate, requirePermission('admin:access'), catalogEntitlementController.get);

/**
 * @route   POST /api/v1/catalog-entitlements
 * @desc    Create an entitlement rule
 * @access  Admin — requirePermission enforces RBAC at the permission level
 */
router.post('/', authenticate, requirePermission('admin:settings'), validate(createEntitlementSchema), catalogEntitlementController.create);

/**
 * @route   PUT /api/v1/catalog-entitlements/:id
 * @desc    Update an entitlement rule
 * @access  Admin
 */
router.put('/:id', authenticate, requirePermission('admin:settings'), validate(updateEntitlementSchema), catalogEntitlementController.update);

/**
 * @route   DELETE /api/v1/catalog-entitlements/:id
 * @desc    Delete an entitlement rule
 * @access  Admin
 */
router.delete('/:id', authenticate, requirePermission('admin:settings'), catalogEntitlementController.delete);

/**
 * @route   POST /api/v1/catalog-entitlements/check
 * @desc    Check if current user is entitled to a request type
 * @access  Authenticated users
 */
router.post('/check', authenticate, validate(checkEntitlementSchema), catalogEntitlementController.checkEntitlement);

export default router;