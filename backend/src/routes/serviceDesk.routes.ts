import { Router } from 'express';
import { serviceDeskController } from '../controllers/serviceDesk.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

/**
 * @route   GET /api/v1/service-desks
 * @desc    Get all service desks
 * @access  Public
 */
router.get('/', serviceDeskController.getAllServiceDesks);

/**
 * @route   GET /api/v1/service-desks/:id
 * @desc    Get service desk by ID
 * @access  Public
 */
router.get('/:id', serviceDeskController.getServiceDeskById);

/**
 * @route   GET /api/v1/service-desks/:id/categories
 * @desc    Get categories for a service desk
 * @access  Public
 */
router.get('/:id/categories', serviceDeskController.getCategories);

/**
 * @route   GET /api/v1/service-desks/:id/request-types
 * @desc    Get request types for a service desk
 * @access  Public
 */
router.get('/:id/request-types', serviceDeskController.getRequestTypes);

// Admin routes
router.use(authenticate, authorize('ADMIN'));

/**
 * @route   POST /api/v1/service-desks
 * @desc    Create service desk
 * @access  Private (Admin only)
 */
router.post('/', serviceDeskController.createServiceDesk);

/**
 * @route   PUT /api/v1/service-desks/:id
 * @desc    Update service desk
 * @access  Private (Admin only)
 */
router.put('/:id', serviceDeskController.updateServiceDesk);

/**
 * @route   DELETE /api/v1/service-desks/:id
 * @desc    Delete service desk
 * @access  Private (Admin only)
 */
router.delete('/:id', serviceDeskController.deleteServiceDesk);

// --- Category Management Routes (Admin only) ---

/**
 * @route   POST /api/v1/service-desks/:id/categories
 * @desc    Create category
 * @access  Private (Admin only)
 */
router.post('/:id/categories', serviceDeskController.createCategory);

/**
 * @route   PUT /api/v1/service-desks/:id/categories/:categoryId
 * @desc    Update category
 * @access  Private (Admin only)
 */
router.put('/:id/categories/:categoryId', serviceDeskController.updateCategory);

/**
 * @route   DELETE /api/v1/service-desks/:id/categories/:categoryId
 * @desc    Delete category
 * @access  Private (Admin only)
 */
router.delete('/:id/categories/:categoryId', serviceDeskController.deleteCategory);

// --- Request Type Management Routes (Admin only) ---

/**
 * @route   POST /api/v1/service-desks/request-types
 * @desc    Create request type
 * @access  Private (Admin only)
 */
router.post('/request-types', serviceDeskController.createRequestType);

/**
 * @route   PUT /api/v1/service-desks/request-types/:typeId
 * @desc    Update request type (including form configuration)
 * @access  Private (Admin only)
 */
router.put('/request-types/:typeId', serviceDeskController.updateRequestType);

/**
 * @route   DELETE /api/v1/service-desks/request-types/:typeId
 * @desc    Delete request type
 * @access  Private (Admin only)
 */
router.delete('/request-types/:typeId', serviceDeskController.deleteRequestType);

export default router;
