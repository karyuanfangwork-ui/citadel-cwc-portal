import { Router } from 'express';
import multer from 'multer';
import { userController } from '../controllers/user.controller';
import { authenticate, authorize, requirePermission } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { updateProfileSchema, changePasswordSchema } from '../validators/user.validator';

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
 * @route   PUT /api/v1/users/me/password
 * @desc    Change current user's password (verify current, set new, revoke sessions)
 * @access  Private (any authenticated user)
 */
router.put('/me/password', validate(changePasswordSchema), userController.changeMyPassword);

/**
 * @route   PUT /api/v1/users/me/out-of-office
 * @desc    Toggle out-of-office status for current user
 * @access  Private
 */
router.put('/me/out-of-office', userController.updateOutOfOffice);

/**
 * @route   PUT /api/v1/users/me/delegation
 * @desc    Update delegation settings for current user
 * @access  Private
 */
router.put('/me/delegation', userController.updateDelegation);

/**
 * @route   GET /api/v1/users/me/delegation/search
 * @desc    Search users for delegation (typeahead)
 * @access  Private
 */
router.get('/me/delegation/search', userController.searchDelegates);

/**
 * @route   GET /api/v1/users/me/delegation/incoming
 * @desc    Get users who have delegated to current user
 * @access  Private
 */
router.get('/me/delegation/incoming', userController.getIncomingDelegations);

/**
 * @route   POST /api/v1/users/roles
 * @desc    Create a new role
 * @access  Private (admin:settings)
 */
router.post('/roles', requirePermission('admin:settings'), userController.createRole);

/**
 * @route   PUT /api/v1/users/roles/:roleId
 * @desc    Update role name/description
 * @access  Private (admin:settings)
 */
router.put('/roles/:roleId', requirePermission('admin:settings'), userController.updateRole);

/**
 * @route   DELETE /api/v1/users/roles/:roleId
 * @desc    Delete a role (fails if users assigned)
 * @access  Private (admin:settings)
 */
router.delete('/roles/:roleId', requirePermission('admin:settings'), userController.deleteRole);

/**
 * @route   GET /api/v1/users/roles/all
 * @desc    List all available roles
 * @access  Private (Admin only)
 */
router.get('/roles/all', authorize('ADMIN'), userController.listRoles);

/**
 * @route   PUT /api/v1/users/roles/:roleId/permissions
 * @desc    Replace a role's permissions atomically
 * @access  Private (admin:settings)
 */
router.put('/roles/:roleId/permissions', requirePermission('admin:settings'), userController.updateRolePermissions);

/**
 * @route   GET /api/v1/users/permissions/all
 * @desc    List all permissions with role assignments
 * @access  Private (admin:access)
 */
router.get('/permissions/all', requirePermission('admin:access'), userController.listPermissions);

/**
 * @route   POST /api/v1/users/permissions
 * @desc    Create a new permission
 * @access  Private (admin:settings)
 */
router.post('/permissions', requirePermission('admin:settings'), userController.createPermission);

/**
 * @route   DELETE /api/v1/users/permissions/:permissionId
 * @desc    Delete a permission
 * @access  Private (admin:settings)
 */
router.delete('/permissions/:permissionId', requirePermission('admin:settings'), userController.deletePermission);

/**
 * @route   POST /api/v1/users/:id/roles
 * @desc    Replace a user's roles (force-revokes active tokens)
 * @access  Private (Admin only)
 */
router.post('/:id/roles', authorize('ADMIN'), userController.assignRoles);

/**
 * @route   GET /api/v1/users/search
 * @desc    Search users by name/email (minimal fields) — used by participant typeahead
 * @access  Private (any authenticated user — needed so requesters can add participants)
 */
router.get('/search', authenticate, userController.searchUsers);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get user by ID
 * @access  Private (Admin only)
 */
router.get('/:id', authorize('ADMIN'), userController.getUserById);

/**
 * @route   GET /api/v1/users
 * @desc    Get all users (with pagination and filters)
 * @access  Private (Admin, Agent, CEO, CTO, CFO, GROUP_CEO — agents & executives need this to look up approvers during workflow)
 */
router.get('/', authorize('ADMIN', 'AGENT', 'CEO', 'CTO', 'CFO', 'GROUP_CEO', 'CREDIT_RM', 'CREDIT_ANALYST', 'CREDIT_MANAGER'), userController.getAllUsers);
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