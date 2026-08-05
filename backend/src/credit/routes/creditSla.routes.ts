import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { creditSlaController } from '../controllers/creditSla.controller';

// ---------------------------------------------------------------------------
// §2.2 — Credit SLA Policy & Breach Routes
// ---------------------------------------------------------------------------

const router = Router();

// All routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// Policy CRUD (admin only)
// ---------------------------------------------------------------------------

/**
 * POST /sla/policies
 * Create a new SLA policy
 * Requires: credit:admin
 */
router.post(
  '/policies',
  requirePermission('credit:admin'),
  creditSlaController.createPolicy,
);

/**
 * GET /sla/policies
 * List SLA policies (with optional filters)
 * Requires: credit:read
 */
router.get(
  '/policies',
  requirePermission('credit:read'),
  creditSlaController.listPolicies,
);

/**
 * GET /sla/policies/:id
 * Get a single SLA policy
 * Requires: credit:read
 */
router.get(
  '/policies/:id',
  requirePermission('credit:read'),
  creditSlaController.getPolicy,
);

/**
 * PATCH /sla/policies/:id
 * Update an SLA policy
 * Requires: credit:admin
 */
router.patch(
  '/policies/:id',
  requirePermission('credit:admin'),
  creditSlaController.updatePolicy,
);

/**
 * DELETE /sla/policies/:id
 * Soft-delete (deactivate) an SLA policy
 * Requires: credit:admin
 */
router.delete(
  '/policies/:id',
  requirePermission('credit:admin'),
  creditSlaController.deletePolicy,
);

// ---------------------------------------------------------------------------
// Breach Management
// ---------------------------------------------------------------------------

/**
 * GET /sla/breaches
 * Get all active SLA breaches (dashboard widget)
 * Requires: credit:read
 */
router.get(
  '/breaches',
  requirePermission('credit:read'),
  creditSlaController.getActiveBreaches,
);

/**
 * GET /sla/breaches/:applicationId
 * Get breaches for a specific application
 * Requires: credit:read
 */
router.get(
  '/breaches/:applicationId',
  requirePermission('credit:read'),
  creditSlaController.getApplicationBreaches,
);

/**
 * POST /sla/breaches/:id/acknowledge
 * Acknowledge a breach
 * Requires: credit:write
 */
router.post(
  '/breaches/:id/acknowledge',
  requirePermission('credit:write'),
  creditSlaController.acknowledgeBreach,
);

/**
 * POST /sla/breaches/:id/resolve
 * Resolve a breach
 * Requires: credit:approve
 */
router.post(
  '/breaches/:id/resolve',
  requirePermission('credit:approve'),
  creditSlaController.resolveBreach,
);

// ---------------------------------------------------------------------------
// Manual trigger (admin/testing)
// ---------------------------------------------------------------------------

/**
 * POST /sla/check
 * Manually trigger breach detection and escalation
 * Requires: credit:admin
 */
router.post(
  '/check',
  requirePermission('credit:admin'),
  creditSlaController.checkBreaches,
);

export default router;