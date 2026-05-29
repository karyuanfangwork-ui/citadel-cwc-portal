import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { delegationController } from '../controllers/delegation.controller';
import { validate } from '../../middleware/validate.middleware';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// §2.6 — Delegation routes
// ---------------------------------------------------------------------------

const delegatedApprovalSchema = z.object({
  applicationId: z.string().uuid(),
  delegatorId: z.string().uuid(),
  decision: z.enum(['APPROVE', 'REJECT', 'RETURN', 'ESCALATE']),
  comment: z.string().optional(),
});

const router = Router();

// All delegation routes require authentication
router.use(authenticate);

/**
 * GET /delegation/pending-approvals
 * List pending approval items including delegated ones
 * Requires: credit:read
 */
router.get(
  '/pending-approvals',
  requirePermission('credit:read'),
  delegationController.listPendingApprovals,
);

/**
 * POST /delegation/approve-on-behalf
 * Submit an approval action on behalf of a delegator
 * Requires: credit:approve (same permission as direct approval)
 */
router.post(
  '/approve-on-behalf',
  requirePermission('credit:approve'),
  validate(delegatedApprovalSchema),
  delegationController.approveOnBehalf,
);

/**
 * GET /delegation/status
 * Get current user's delegation status
 * Requires: credit:read
 */
router.get(
  '/status',
  requirePermission('credit:read'),
  delegationController.getDelegationStatus,
);

export default router;