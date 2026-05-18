import { Router } from 'express';
import { borrowerProfileController } from '../controllers/borrowerProfile.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createBorrowerProfileSchema, updateBorrowerProfileSchema } from '../validators/borrowerProfile.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /borrowers
 * List borrower profiles with pagination & filters
 * Requires: credit:read
 */
router.get(
  '/',
  requirePermission('credit:read'),
  borrowerProfileController.list,
);

/**
 * GET /borrowers/:id
 * Get a single borrower profile
 * Requires: credit:read
 */
router.get(
  '/:id',
  requirePermission('credit:read'),
  borrowerProfileController.getOne,
);

/**
 * POST /borrowers
 * Create a new borrower profile
 * Requires: credit:write
 */
router.post(
  '/',
  requirePermission('credit:write'),
  validate(createBorrowerProfileSchema),
  borrowerProfileController.create,
);

/**
 * PATCH /borrowers/:id
 * Update a borrower profile
 * Requires: credit:write
 */
router.patch(
  '/:id',
  requirePermission('credit:write'),
  validate(updateBorrowerProfileSchema),
  borrowerProfileController.update,
);

/**
 * DELETE /borrowers/:id
 * Soft-delete a borrower profile
 * Requires: credit:admin
 */
router.delete(
  '/:id',
  requirePermission('credit:admin'),
  borrowerProfileController.delete,
);

export default router;