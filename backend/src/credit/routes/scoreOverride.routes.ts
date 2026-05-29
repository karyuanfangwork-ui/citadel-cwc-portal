import { Router } from 'express';
import { scoreOverrideController } from '../controllers/scoreOverride.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { creditScoreOverrideLimiter } from '../../middleware/rateLimit.middleware';

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
 * Rate-limited: 5/min/user (creditScoreOverrideLimiter)
 */
router.post(
  '/',
  creditScoreOverrideLimiter,
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
 * Rate-limited: 5/min/user (creditScoreOverrideLimiter)
 */
router.post(
  '/:id/approve',
  creditScoreOverrideLimiter,
  requirePermission('credit:approve'),
  scoreOverrideController.approveOverride,
);

/**
 * POST /score-overrides/:id/reject
 * Second approver rejects a pending score override.
 * Requires: credit:approve
 * Rate-limited: 5/min/user (creditScoreOverrideLimiter)
 */
router.post(
  '/:id/reject',
  creditScoreOverrideLimiter,
  requirePermission('credit:approve'),
  scoreOverrideController.rejectOverride,
);

export default router;