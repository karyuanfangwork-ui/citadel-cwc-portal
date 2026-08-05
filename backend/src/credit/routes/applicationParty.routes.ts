import { Router } from 'express';
import { applicationPartyController } from '../controllers/applicationParty.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createApplicationPartySchema, updateApplicationPartySchema } from '../validators/applicationParty.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /applications/:applicationId/parties
 * List parties for a credit application
 * Requires: credit:read
 */
router.get(
  '/:applicationId/parties',
  requirePermission('credit:read'),
  applicationPartyController.list,
);

/**
 * GET /parties/:id
 * Get a single party
 * Requires: credit:read
 */
router.get(
  '/parties/:id',
  requirePermission('credit:read'),
  applicationPartyController.getOne,
);

/**
 * POST /applications/:applicationId/parties
 * Create a new party
 * Requires: credit:write
 */
router.post(
  '/:applicationId/parties',
  requirePermission('credit:write'),
  validate(createApplicationPartySchema),
  applicationPartyController.create,
);

/**
 * PATCH /parties/:id
 * Update a party
 * Requires: credit:write
 */
router.patch(
  '/parties/:id',
  requirePermission('credit:write'),
  validate(updateApplicationPartySchema),
  applicationPartyController.update,
);

/**
 * DELETE /parties/:id
 * Delete a party
 * Requires: credit:admin
 */
router.delete(
  '/parties/:id',
  requirePermission('credit:admin'),
  applicationPartyController.delete,
);

export default router;