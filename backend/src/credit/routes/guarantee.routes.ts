import { Router } from 'express';
import { guaranteeController } from '../controllers/guarantee.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createGuaranteeSchema,
  updateGuaranteeSchema,
  updateFinancialAssessmentSchema,
} from '../validators/guarantee.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /applications/:applicationId/guarantees
 * List guarantees for a credit application
 * Requires: credit:read
 */
router.get(
  '/:applicationId/guarantees',
  requirePermission('credit:read'),
  guaranteeController.list,
);

/**
 * POST /applications/:applicationId/guarantees
 * Create a guarantee
 * Requires: credit:write
 */
router.post(
  '/:applicationId/guarantees',
  requirePermission('credit:write'),
  validate(createGuaranteeSchema),
  guaranteeController.create,
);

/**
 * GET /guarantees/:id
 * Get a single guarantee
 * Requires: credit:read
 */
router.get(
  '/guarantees/:id',
  requirePermission('credit:read'),
  guaranteeController.getOne,
);

/**
 * PATCH /guarantees/:id
 * Update a guarantee
 * Requires: credit:write
 */
router.patch(
  '/guarantees/:id',
  requirePermission('credit:write'),
  validate(updateGuaranteeSchema),
  guaranteeController.update,
);

/**
 * PATCH /guarantees/:id/financial-assessment
 * S7.3 — Update guarantor financial assessment
 * Requires: credit:write
 */
router.patch(
  '/guarantees/:id/financial-assessment',
  requirePermission('credit:write'),
  validate(updateFinancialAssessmentSchema),
  guaranteeController.updateFinancialAssessment,
);

/**
 * DELETE /guarantees/:id
 * Delete a guarantee
 * Requires: credit:admin
 */
router.delete(
  '/guarantees/:id',
  requirePermission('credit:admin'),
  guaranteeController.delete,
);

export default router;