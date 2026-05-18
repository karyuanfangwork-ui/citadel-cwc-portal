import { Router } from 'express';
import { creditApplicationController } from '../controllers/creditApplication.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createCreditApplicationSchema,
  updateCreditApplicationSchema,
  transitionApplicationSchema,
} from '../validators/creditApplication.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /applications
 * List credit applications with pagination & filters
 * Requires: credit:read
 */
router.get(
  '/',
  requirePermission('credit:read'),
  creditApplicationController.list,
);

/**
 * GET /applications/:id
 * Get a single credit application
 * Requires: credit:read
 */
router.get(
  '/:id',
  requirePermission('credit:read'),
  creditApplicationController.getOne,
);

/**
 * POST /applications
 * Create a new credit application
 * Requires: credit:write
 */
router.post(
  '/',
  requirePermission('credit:write'),
  validate(createCreditApplicationSchema),
  creditApplicationController.create,
);

/**
 * PATCH /applications/:id
 * Update a credit application (DRAFT only)
 * Requires: credit:write
 */
router.patch(
  '/:id',
  requirePermission('credit:write'),
  validate(updateCreditApplicationSchema),
  creditApplicationController.update,
);

/**
 * DELETE /applications/:id
 * Soft-delete a credit application (DRAFT only)
 * Requires: credit:admin
 */
router.delete(
  '/:id',
  requirePermission('credit:admin'),
  creditApplicationController.delete,
);

// ============================================================================
// State Machine — Transition routes
// ============================================================================

/**
 * POST /applications/:id/transition
 * Transition application state (action in body)
 * Requires: credit:write
 */
router.post(
  '/:id/transition',
  requirePermission('credit:write'),
  validate(transitionApplicationSchema),
  creditApplicationController.transition,
);

/**
 * GET /applications/:id/transitions
 * Get valid transitions for the application's current state
 * Requires: credit:read
 */
router.get(
  '/:id/transitions',
  requirePermission('credit:read'),
  creditApplicationController.getTransitions,
);

/**
 * GET /applications/:id/audit
 * Get audit trail for an application
 * Requires: credit:read
 */
router.get(
  '/:id/audit',
  requirePermission('credit:read'),
  creditApplicationController.getAuditTrail,
);

export default router;