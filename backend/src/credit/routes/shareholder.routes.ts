import { Router } from 'express';
import { shareholderController } from '../controllers/shareholder.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createShareholderSchema, updateShareholderSchema } from '../validators/shareholder.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /borrowers/:borrowerProfileId/shareholders
 * List shareholders for a borrower profile
 * Requires: credit:read
 */
router.get(
  '/:borrowerProfileId/shareholders',
  requirePermission('credit:read'),
  shareholderController.list,
);

/**
 * GET /shareholders/:id
 * Get a single shareholder
 * Requires: credit:read
 */
router.get(
  '/shareholders/:id',
  requirePermission('credit:read'),
  shareholderController.getOne,
);

/**
 * POST /borrowers/:borrowerProfileId/shareholders
 * Create a new shareholder
 * Requires: credit:write
 */
router.post(
  '/:borrowerProfileId/shareholders',
  requirePermission('credit:write'),
  validate(createShareholderSchema),
  shareholderController.create,
);

/**
 * PATCH /shareholders/:id
 * Update a shareholder
 * Requires: credit:write
 */
router.patch(
  '/shareholders/:id',
  requirePermission('credit:write'),
  validate(updateShareholderSchema),
  shareholderController.update,
);

/**
 * DELETE /shareholders/:id
 * Delete a shareholder
 * Requires: credit:admin
 */
router.delete(
  '/shareholders/:id',
  requirePermission('credit:admin'),
  shareholderController.delete,
);

export default router;