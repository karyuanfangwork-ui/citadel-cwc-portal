import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { updateProfileSchema } from '../validators/user.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

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
 * @route   GET /api/v1/users/:id
 * @desc    Get user by ID
 * @access  Private (Admin only)
 */
router.get('/:id', authorize('ADMIN'), userController.getUserById);

/**
 * @route   GET /api/v1/users
 * @desc    Get all users (with pagination and filters)
 * @access  Private (Admin only)
 */
router.get('/', authorize('ADMIN'), userController.getAllUsers);

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

export default router;
