import { Router } from 'express';
import { deviationController } from '../controllers/deviation.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createDeviationSchema,
  updateDeviationSchema,
  approveDeviationSchema,
  rejectDeviationSchema,
  listDeviationsSchema,
} from '../validators/deviation.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// Deviation Register — CRUD + Approval Flow
// ============================================================================

/**
 * POST /deviations
 * Create a new deviation record (policy breach exception request)
 * Requires: credit:write
 */
router.post(
  '/',
  requirePermission('credit:write'),
  validate(createDeviationSchema),
  deviationController.createDeviation,
);

/**
 * GET /deviations
 * List deviations (register view) with filters and pagination
 * Requires: credit:admin
 */
router.get(
  '/',
  requirePermission('credit:admin'),
  validate(listDeviationsSchema),
  deviationController.listDeviations,
);

/**
 * GET /deviations/:id
 * Get a single deviation record
 * Requires: credit:read
 */
router.get(
  '/:id',
  requirePermission('credit:read'),
  deviationController.getDeviation,
);

/**
 * PATCH /deviations/:id
 * Update a pending deviation
 * Requires: credit:write
 */
router.patch(
  '/:id',
  requirePermission('credit:write'),
  validate(updateDeviationSchema),
  deviationController.updateDeviation,
);

/**
 * PATCH /deviations/:id/approve
 * Approve a pending deviation
 * Requires: credit:approve
 */
router.patch(
  '/:id/approve',
  requirePermission('credit:approve'),
  validate(approveDeviationSchema),
  deviationController.approveDeviation,
);

/**
 * PATCH /deviations/:id/reject
 * Reject a pending deviation
 * Requires: credit:approve
 */
router.patch(
  '/:id/reject',
  requirePermission('credit:approve'),
  validate(rejectDeviationSchema),
  deviationController.rejectDeviation,
);

/**
 * GET /deviations/application/:applicationId
 * List deviations for a specific application
 * Requires: credit:read
 */
router.get(
  '/application/:applicationId',
  requirePermission('credit:read'),
  deviationController.getApplicationDeviations,
);

/**
 * GET /deviations/application/:applicationId/check
 * Check if all deviations for an application are resolved
 * Requires: credit:read
 */
router.get(
  '/application/:applicationId/check',
  requirePermission('credit:read'),
  deviationController.checkApplicationDeviations,
);

export default router;