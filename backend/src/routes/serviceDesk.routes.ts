import { Router } from 'express';
import { serviceDeskController } from '../controllers/serviceDesk.controller';
import { authenticate, optionalAuth, requirePermission } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
    createServiceDeskSchema,
    updateServiceDeskSchema,
    createCategorySchema,
    updateCategorySchema,
    createRequestTypeSchema,
    updateRequestTypeSchema,
} from '../validators/serviceDesk.validator';

const router = Router();

/**
 * @route   GET /api/v1/service-desks
 * @desc    Get all service desks
 * @access  Public
 */
router.get('/', optionalAuth, serviceDeskController.getAllServiceDesks);

/**
 * @route   GET /api/v1/service-desks/:id
 * @desc    Get service desk by ID
 * @access  Public
 */
router.get('/:id', optionalAuth, serviceDeskController.getServiceDeskById);

/**
 * @route   GET /api/v1/service-desks/:id/categories
 * @desc    Get categories for a service desk
 * @access  Public
 */
router.get('/:id/categories', optionalAuth, serviceDeskController.getCategories);

/**
 * @route   GET /api/v1/service-desks/:id/request-types
 * @desc    Get request types for a service desk
 * @access  Public
 */
router.get('/:id/request-types', optionalAuth, serviceDeskController.getRequestTypes);

// Admin routes — require authentication + admin:access (read) or admin:settings (write)
router.use(authenticate, requirePermission('admin:access', 'admin:settings'));

/**
 * @route   GET /api/v1/service-desks/:id/categories/all
 * @desc    Get ALL categories for a service desk (including inactive) — admin only
 * @access  Private — requirePermission enforces RBAC at the permission level
 */
router.get('/:id/categories/all', serviceDeskController.getAllCategoriesAdmin);

/**
 * @route   GET /api/v1/service-desks/:id/request-types/all
 * @desc    Get ALL request types for a service desk (including inactive) — admin only
 * @access  Private — requirePermission enforces RBAC at the permission level
 */
router.get('/:id/request-types/all', serviceDeskController.getAllRequestTypesAdmin);

/**
 * @route   POST /api/v1/service-desks
 * @desc    Create service desk
 * @access  Private — requirePermission enforces RBAC at the permission level
 */
router.post('/', requirePermission('admin:settings'), validate(createServiceDeskSchema), serviceDeskController.createServiceDesk);

/**
 * @route   PUT /api/v1/service-desks/:id
 * @desc    Update service desk
 * @access  Private — requirePermission enforces RBAC at the permission level
 */
router.put('/:id', requirePermission('admin:settings'), validate(updateServiceDeskSchema), serviceDeskController.updateServiceDesk);

/**
 * @route   GET /api/v1/service-desks/:id/agents
 * @desc    Get eligible agents for a service desk's auto-assign team
 * @access  Private — requirePermission enforces RBAC at the permission level
 */
router.get('/:id/agents', serviceDeskController.getTeamAgents);

/**
 * @route   DELETE /api/v1/service-desks/:id
 * @desc    Delete service desk
 * @access  Private — requirePermission enforces RBAC at the permission level
 */
router.delete('/:id', requirePermission('admin:settings'), serviceDeskController.deleteServiceDesk);

// --- Category Management Routes (Admin only) ---

/**
 * @route   POST /api/v1/service-desks/:id/categories
 * @desc    Create category
 * @access  Private — requirePermission enforces RBAC at the permission level
 */
router.post('/:id/categories', requirePermission('admin:settings'), validate(createCategorySchema), serviceDeskController.createCategory);

/**
 * @route   PUT /api/v1/service-desks/:id/categories/:categoryId
 * @desc    Update category
 * @access  Private — requirePermission enforces RBAC at the permission level
 */
router.put('/:id/categories/:categoryId', requirePermission('admin:settings'), validate(updateCategorySchema), serviceDeskController.updateCategory);

/**
 * @route   DELETE /api/v1/service-desks/:id/categories/:categoryId
 * @desc    Delete category
 * @access  Private — requirePermission enforces RBAC at the permission level
 */
router.delete('/:id/categories/:categoryId', requirePermission('admin:settings'), serviceDeskController.deleteCategory);

// --- Request Type Management Routes (Admin only) ---

/**
 * @route   POST /api/v1/service-desks/request-types
 * @desc    Create request type
 * @access  Private — requirePermission enforces RBAC at the permission level
 */
router.post('/request-types', requirePermission('admin:settings'), validate(createRequestTypeSchema), serviceDeskController.createRequestType);

/**
 * @route   PUT /api/v1/service-desks/request-types/:typeId
 * @desc    Update request type (including form configuration)
 * @access  Private — requirePermission enforces RBAC at the permission level
 */
router.put('/request-types/:typeId', requirePermission('admin:settings'), validate(updateRequestTypeSchema), serviceDeskController.updateRequestType);

/**
 * @route   DELETE /api/v1/service-desks/request-types/:typeId
 * @desc    Delete request type
 * @access  Private — requirePermission enforces RBAC at the permission level
 */
router.delete('/request-types/:typeId', requirePermission('admin:settings'), serviceDeskController.deleteRequestType);

export default router;