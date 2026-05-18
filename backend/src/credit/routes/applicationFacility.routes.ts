import { Router } from 'express';
import { applicationFacilityController } from '../controllers/applicationFacility.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createApplicationFacilitySchema, updateApplicationFacilitySchema } from '../validators/applicationFacility.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /applications/:applicationId/facilities
 * List facilities for a credit application
 * Requires: credit:read
 */
router.get(
  '/:applicationId/facilities',
  requirePermission('credit:read'),
  applicationFacilityController.list,
);

/**
 * GET /facilities/:id
 * Get a single facility
 * Requires: credit:read
 */
router.get(
  '/facilities/:id',
  requirePermission('credit:read'),
  applicationFacilityController.getOne,
);

/**
 * POST /applications/:applicationId/facilities
 * Create a new facility
 * Requires: credit:write
 */
router.post(
  '/:applicationId/facilities',
  requirePermission('credit:write'),
  validate(createApplicationFacilitySchema),
  applicationFacilityController.create,
);

/**
 * PATCH /facilities/:id
 * Update a facility
 * Requires: credit:write
 */
router.patch(
  '/facilities/:id',
  requirePermission('credit:write'),
  validate(updateApplicationFacilitySchema),
  applicationFacilityController.update,
);

/**
 * DELETE /facilities/:id
 * Delete a facility
 * Requires: credit:admin
 */
router.delete(
  '/facilities/:id',
  requirePermission('credit:admin'),
  applicationFacilityController.delete,
);

export default router;