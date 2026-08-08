import { Router } from 'express';
import { scoreOverrideController } from '../controllers/scoreOverride.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { z } from 'zod';
import { creditScoreOverrideLimiter } from '../../middleware/rateLimit.middleware';

// ── Validators ─────────────────────────────────────────────────────────

const requestOverrideSchema = z.object({
  body: z.object({
    applicationId: z.string().uuid('applicationId must be a valid UUID'),
    // LOS-008 — originalRating is no longer accepted: it is derived from the
    // latest CreditScoreRun so the caller cannot choose the notch delta.
    overrideRating: z.string().min(1, 'overrideRating is required').max(50),
    justification: z.string().min(20, 'A justification of at least 20 characters is required'),
  }),
});

// ── Routes ────────────────────────────────────────────────────────────

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
  validate(requestOverrideSchema),
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