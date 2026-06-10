import { Router } from 'express';
import { financialController } from '../controllers/financial.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  updateStatementSchema,
  upsertLineItemsSchema,
  reviewStatementSchema,
  listRatiosQuerySchema,
} from '../validators/financial.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /financials/:id
 * Get a single financial statement
 * Requires: credit:read
 */
router.get(
  '/:id',
  requirePermission('credit:read'),
  financialController.getStatement,
);

/**
 * PATCH /financials/:id
 * Update a financial statement
 * Requires: credit:write
 */
router.patch(
  '/:id',
  requirePermission('credit:write'),
  validate(updateStatementSchema),
  financialController.updateStatement,
);

/**
 * DELETE /financials/:id
 * Soft-delete a financial statement (DRAFT only)
 * Requires: credit:admin
 */
router.delete(
  '/:id',
  requirePermission('credit:admin'),
  financialController.deleteStatement,
);

/**
 * GET /financials/:id/line-items
 * List line items for a statement
 * Requires: credit:read
 */
router.get(
  '/:id/line-items',
  requirePermission('credit:read'),
  financialController.listLineItems,
);

/**
 * POST /financials/:id/line-items
 * Batch upsert line items
 * Requires: credit:write
 */
router.post(
  '/:id/line-items',
  requirePermission('credit:write'),
  validate(upsertLineItemsSchema),
  financialController.upsertLineItems,
);

/**
 * POST /financials/:id/lines
 * Add a single line item to a statement (F4 — "Add Row" UI control)
 * Requires: credit:write
 */
router.post(
  '/:id/lines',
  requirePermission('credit:write'),
  financialController.addLine,
);

/**
 * POST /financials/:id/validate
 * Validate balance sheet balance
 * Requires: credit:read
 */
router.post(
  '/:id/validate',
  requirePermission('credit:read'),
  financialController.validateBalanceSheet,
);

/**
 * POST /financials/:id/submit
 * Submit a DRAFT statement for review
 * Requires: credit:write
 */
router.post(
  '/:id/submit',
  requirePermission('credit:write'),
  financialController.submitForReview,
);

/**
 * POST /financials/:id/review
 * Review (approve/reject) a statement
 * Requires: credit:approve
 */
router.post(
  '/:id/review',
  requirePermission('credit:approve'),
  validate(reviewStatementSchema),
  financialController.reviewStatement,
);

/**
 * POST /financials/:id/compute-ratios
 * Compute financial ratios from line items
 * Requires: credit:write
 */
router.post(
  '/:id/compute-ratios',
  requirePermission('credit:write'),
  financialController.computeRatios,
);

/**
 * GET /financials/:id/ratios
 * List computed ratios for a statement
 * Requires: credit:read
 */
router.get(
  '/:id/ratios',
  requirePermission('credit:read'),
  validate(listRatiosQuerySchema),
  financialController.listRatios,
);

export default router;