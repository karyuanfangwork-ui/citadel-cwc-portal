import { Router } from 'express';
import { directorController } from '../controllers/director.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createDirectorSchema, updateDirectorSchema } from '../validators/director.validator';
import { assertBorrowerAccess } from '../middleware/assertBorrowerAccess.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /borrowers/:borrowerProfileId/directors
 * List directors for a borrower profile
 * Requires: credit:read
 */
router.get(
  '/:borrowerProfileId/directors',
  requirePermission('credit:read'),
  assertBorrowerAccess(),
  directorController.list,
);

/**
 * GET /directors/:id
 * Get a single director
 * Requires: credit:read
 */
router.get(
  '/directors/:id',
  requirePermission('credit:read'),
  directorController.getOne,
);

/**
 * POST /borrowers/:borrowerProfileId/directors
 * Create a new director
 * Requires: credit:write
 */
router.post(
  '/:borrowerProfileId/directors',
  requirePermission('credit:write'),
  assertBorrowerAccess(),
  validate(createDirectorSchema),
  directorController.create,
);

/**
 * PATCH /directors/:id
 * Update a director
 * Requires: credit:write
 */
router.patch(
  '/directors/:id',
  requirePermission('credit:write'),
  validate(updateDirectorSchema),
  directorController.update,
);

/**
 * DELETE /directors/:id
 * Delete a director
 * Requires: credit:admin
 */
router.delete(
  '/directors/:id',
  requirePermission('credit:admin'),
  directorController.delete,
);

export default router;