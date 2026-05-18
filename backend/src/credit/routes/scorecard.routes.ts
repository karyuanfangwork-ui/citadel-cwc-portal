import { Router } from 'express';
import { scorecardController } from '../controllers/scorecard.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createScorecardSchema,
  updateScorecardSchema,
  listScorecardsQuerySchema,
  createVersionSchema,
} from '../validators/scorecard.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// Scorecard CRUD  — mounted at /scorecards
// ============================================================================

/**
 * GET /scorecards
 * List all scorecards
 * Requires: credit:read
 */
router.get(
  '/',
  requirePermission('credit:read'),
  validate(listScorecardsQuerySchema),
  scorecardController.listScorecards,
);

/**
 * POST /scorecards
 * Create a new scorecard
 * Requires: credit:admin
 */
router.post(
  '/',
  requirePermission('credit:admin'),
  validate(createScorecardSchema),
  scorecardController.createScorecard,
);

/**
 * GET /scorecards/:id
 * Get a single scorecard
 * Requires: credit:read
 */
router.get(
  '/:id',
  requirePermission('credit:read'),
  scorecardController.getScorecard,
);

/**
 * PATCH /scorecards/:id
 * Update a scorecard
 * Requires: credit:admin
 */
router.patch(
  '/:id',
  requirePermission('credit:admin'),
  validate(updateScorecardSchema),
  scorecardController.updateScorecard,
);

/**
 * DELETE /scorecards/:id
 * Soft-delete a scorecard (sets isActive = false)
 * Requires: credit:admin
 */
router.delete(
  '/:id',
  requirePermission('credit:admin'),
  scorecardController.deleteScorecard,
);

/**
 * GET /scorecards/:id/versions
 * List all versions for a scorecard
 * Requires: credit:read
 */
router.get(
  '/:id/versions',
  requirePermission('credit:read'),
  scorecardController.listVersions,
);

/**
 * POST /scorecards/:id/versions
 * Create a new version of a scorecard
 * Requires: credit:admin
 */
router.post(
  '/:id/versions',
  requirePermission('credit:admin'),
  validate(createVersionSchema),
  scorecardController.createVersion,
);

export default router;