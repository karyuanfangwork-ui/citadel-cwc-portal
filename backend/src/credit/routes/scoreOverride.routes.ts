import { Router } from 'express';
import { scoreOverrideController } from '../controllers/scoreOverride.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// §1.6 — Score Override Approval (dual-approval for ≥2 notch delta)
// ============================================================================

/**
 * POST /score-overrides
 * Request a score override for an application.
 * If notchDelta < 2, auto-approved. If ≥ 2, requires second approval.
 * Requires: credit:approve
 */
router.post(
  '/',
  requirePermission('credit:approve'),
  scoreOverrideController.requestOverride,
);

/**
 * GET /score-overrides/application/:applicationId
 * Get all score overrides for an application.
 * Requires: credit:read
 */
router.get(
  '/application/:applicationId',
  requirePermission('credit:read'),
  scoreOverrideController.getByApplication,
);

/**
 * POST /score-overrides/:id/approve
 * Second approver approves a pending score override.
 * Requires: credit:approve (different user from first approver — SOD enforced in service)
 */
router.post(
  '/:id/approve',
  requirePermission('credit:approve'),
  scoreOverrideController.approveOverride,
);

/**
 * POST /score-overrides/:id/reject
 * Second approver rejects a pending score override.
 * Requires: credit:approve
 */
router.post(
  '/:id/reject',
  requirePermission('credit:approve'),
  scoreOverrideController.rejectOverride,
);

export default router;