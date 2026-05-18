import { Router } from 'express';
import { approvalController } from '../controllers/approval.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { enforceCreditSOD } from '../middleware/sod.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createApprovalMatrixSchema,
  updateApprovalMatrixSchema,
  submitApprovalActionSchema,
} from '../validators/approval.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// Approval Matrix CRUD
// ============================================================================

/**
 * GET /approval-matrices
 * List approval matrices with pagination
 * Requires: credit:read
 */
router.get(
  '/approval-matrices',
  requirePermission('credit:read'),
  approvalController.listMatrices,
);

/**
 * POST /approval-matrices/lookup
 * Look up approval authority by exposure and risk rating
 * Requires: credit:read
 */
router.post(
  '/approval-matrices/lookup',
  requirePermission('credit:read'),
  approvalController.lookupAuthority,
);

/**
 * GET /approval-matrices/:id
 * Get a single approval matrix
 * Requires: credit:read
 */
router.get(
  '/approval-matrices/:id',
  requirePermission('credit:read'),
  approvalController.getMatrix,
);

/**
 * POST /approval-matrices
 * Create a new approval matrix
 * Requires: credit:admin
 */
router.post(
  '/approval-matrices',
  requirePermission('credit:admin'),
  validate(createApprovalMatrixSchema),
  approvalController.createMatrix,
);

/**
 * PATCH /approval-matrices/:id
 * Update an approval matrix
 * Requires: credit:admin
 */
router.patch(
  '/approval-matrices/:id',
  requirePermission('credit:admin'),
  validate(updateApprovalMatrixSchema),
  approvalController.updateMatrix,
);

/**
 * DELETE /approval-matrices/:id
 * Delete an approval matrix
 * Requires: credit:admin
 */
router.delete(
  '/approval-matrices/:id',
  requirePermission('credit:admin'),
  approvalController.deleteMatrix,
);

// ============================================================================
// Approval Actions (on applications)
// ============================================================================

/**
 * POST /applications/:id/approvals
 * Submit an approval action (APPROVE, REJECT, RETURN, ESCALATE)
 * Requires: credit:approve + SOD enforcement
 */
router.post(
  '/applications/:id/approvals',
  requirePermission('credit:approve'),
  enforceCreditSOD(),
  validate(submitApprovalActionSchema),
  approvalController.submitApproval,
);

/**
 * GET /applications/:id/approvals
 * Get all approval decisions for an application
 * Requires: credit:read
 */
router.get(
  '/applications/:id/approvals',
  requirePermission('credit:read'),
  approvalController.getApplicationApprovals,
);

export default router;