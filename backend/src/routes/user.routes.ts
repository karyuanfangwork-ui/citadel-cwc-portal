import { Router } from 'express';
import multer from 'multer';
import { userController } from '../controllers/user.controller';
import { authenticate, authorize, requirePermission } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { updateProfileSchema } from '../validators/user.validator';

const router = Router();

// Multer config for staff import (in-memory, .xlsx only, 5MB max)
const importUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ext = file.originalname.toLowerCase();
        if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
            cb(null, true);
        } else {
            cb(new Error('Only .xlsx or .xls files are allowed'));
        }
    },
});

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/users/import
 * @desc    Bulk import staff from Excel file
 * @access  Private (user:manage permission required)
 */
router.post(
    '/import',
    requirePermission('user:manage'),
    importUpload.single('file'),
    userController.importUsers,
);

/**
 * @route   GET /api/v1/users/agents
 * @desc    Get all agents (AGENT or ADMIN roles)
 * @access  Private (Admin, Agent)
 */
router.get('/agents', authorize('ADMIN', 'AGENT'), userController.getAgents);

/**
 * @route   GET /api/v1/users/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', userController.getMe);

/**
 * @route   PUT /api/v1/users/me
 * @desc    Update current user profile
 * @access  Private
 */
router.put('/me', validate(updateProfileSchema), userController.updateMe);

/**
 * @route   POST /api/v1/users/:id/roles
 * @desc    Replace a user's roles (force-revokes active tokens)
 * @access  Private (Admin only)
 */
router.post('/:id/roles', authorize('ADMIN'), userController.assignRoles);

/**
 * @route   GET /api/v1/users/roles/all
 * @desc    List all available roles
 * @access  Private (Admin only)
 */
router.get('/roles/all', authorize('ADMIN'), userController.listRoles);

/**
 * @route   GET /api/v1/users/permissions/all
 * @desc    List all permissions with role assignments
 * @access  Private — requirePermission enforces RBAC at the permission level
 */
router.get('/permissions/all', requirePermission('admin:access'), userController.listPermissions);

/**
 * @route   PUT /api/v1/users/roles/:roleId/permissions
 * @desc    Replace a role's permissions atomically
 * @access  Private — requirePermission enforces RBAC at the permission level
 */
router.put('/roles/:roleId/permissions', requirePermission('admin:settings'), userController.updateRolePermissions);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get user by ID
 * @access  Private (Admin only)
 */
router.get('/:id', authorize('ADMIN'), userController.getUserById);

/**
 * @route   GET /api/v1/users
 * @desc    Get all users (with pagination and filters)
 * @access  Private (Admin, Agent — agents need this to look up approvers e.g. CEO for IT workflow)
 */
router.get('/', authorize('ADMIN', 'AGENT'), userController.getAllUsers);
router.post('/', authorize('ADMIN'), userController.createUser);

/**
 * @route   PUT /api/v1/users/:id
 * @desc    Update user by ID
 * @access  Private (Admin only)
 */
router.put('/:id', authorize('ADMIN'), userController.updateUser);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Delete user by ID
 * @access  Private (Admin only)
 */
router.delete('/:id', authorize('ADMIN'), userController.deleteUser);

/**
 * @route   POST /api/v1/users/:id/reset-password
 * @desc    Reset a user's password (generates temp password, revokes sessions)
 * @access  Private (Admin only)
 */
router.post('/:id/reset-password', authorize('ADMIN'), userController.resetUserPassword);

export default router;