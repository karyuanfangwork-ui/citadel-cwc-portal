import { Router } from 'express';
import { requestController } from '../controllers/request.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { uploadLimiter } from '../middleware/rateLimit.middleware';
import {
    createRequestSchema,
    updateRequestSchema,
    addActivitySchema,
} from '../validators/request.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/requests
 * @desc    Get all requests (with filters and pagination)
 * @access  Private
 */
router.get('/', requestController.getAllRequests);

/**
 * @route   POST /api/v1/requests
 * @desc    Create a new request
 * @access  Private
 */
router.post('/', validate(createRequestSchema), requestController.createRequest);

/**
 * @route   GET /api/v1/requests/:id
 * @desc    Get request by ID
 * @access  Private
 */
router.get('/:id', requestController.getRequestById);

/**
 * @route   PUT /api/v1/requests/:id
 * @desc    Update request
 * @access  Private
 */
router.put('/:id', validate(updateRequestSchema), requestController.updateRequest);

/**
 * @route   DELETE /api/v1/requests/:id
 * @desc    Delete request (soft delete)
 * @access  Private
 */
router.delete('/:id', requestController.deleteRequest);

/**
 * @route   GET /api/v1/requests/:id/activities
 * @desc    Get request activities/timeline
 * @access  Private
 */
router.get('/:id/activities', requestController.getRequestActivities);

/**
 * @route   POST /api/v1/requests/:id/activities
 * @desc    Add activity/comment to request
 * @access  Private
 */
router.post(
    '/:id/activities',
    validate(addActivitySchema),
    requestController.addActivity
);

/**
 * @route   POST /api/v1/requests/:id/attachments
 * @desc    Upload attachment to request
 * @access  Private
 */
router.post(
    '/:id/attachments',
    uploadLimiter,
    requestController.uploadAttachment
);

/**
 * @route   GET /api/v1/requests/:id/attachments/:attachmentId
 * @desc    Download attachment
 * @access  Private
 */
router.get('/:id/attachments/:attachmentId', requestController.downloadAttachment);

/**
 * @route   DELETE /api/v1/requests/:id/attachments/:attachmentId
 * @desc    Delete attachment
 * @access  Private
 */
router.delete('/:id/attachments/:attachmentId', requestController.deleteAttachment);

/**
 * @route   PUT /api/v1/requests/:id/assign
 * @desc    Assign request to agent
 * @access  Private (Agent/Admin only)
 */
router.put('/:id/assign', authorize('AGENT', 'ADMIN'), requestController.assignRequest);

/**
 * @route   PUT /api/v1/requests/:id/status
 * @desc    Update request status
 * @access  Private (Agent/Admin only)
 */
router.put('/:id/status', authorize('AGENT', 'ADMIN'), requestController.updateStatus);

export default router;
