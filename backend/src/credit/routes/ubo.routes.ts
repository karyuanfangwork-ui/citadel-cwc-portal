import { Router } from 'express';
import { uboController } from '../controllers/ubo.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createUboSchema, updateUboSchema } from '../validators/ubo.validator';
import { assertBorrowerAccess } from '../middleware/assertBorrowerAccess.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /borrowers/:borrowerProfileId/ubos
 * List UBOs for a borrower profile
 * Requires: credit:read
 */
router.get(
  '/:borrowerProfileId/ubos',
  requirePermission('credit:read'),
  assertBorrowerAccess(),
  uboController.list,
);

/**
 * GET /ubos/:id
 * Get a single UBO
 * Requires: credit:read
 */
router.get(
  '/ubos/:id',
  requirePermission('credit:read'),
  uboController.getOne,
);

/**
 * POST /borrowers/:borrowerProfileId/ubos
 * Create a new UBO
 * Requires: credit:write
 */
router.post(
  '/:borrowerProfileId/ubos',
  requirePermission('credit:write'),
  assertBorrowerAccess(),
  validate(createUboSchema),
  uboController.create,
);

/**
 * GET /ubos/:id/nric-reveal
 * Reveal decrypted NRIC — PII-logged
 * Requires: credit:write
 */
router.get(
  '/ubos/:id/nric-reveal',
  requirePermission('credit:write'),
  uboController.revealNric,
);

/**
 * PATCH /ubos/:id
 * Update a UBO
 * Requires: credit:write
 */
router.patch(
  '/ubos/:id',
  requirePermission('credit:write'),
  validate(updateUboSchema),
  uboController.update,
);

/**
 * DELETE /ubos/:id
 * Delete a UBO
 * Requires: credit:admin
 */
router.delete(
  '/ubos/:id',
  requirePermission('credit:admin'),
  uboController.delete,
);

export default router;