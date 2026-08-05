import { Router } from 'express';
import { scorecardController } from '../controllers/scorecard.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { executeScoreSchema } from '../validators/scorecard.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * POST /applications/:id/score
 * Execute credit scoring for an application
 * Requires: credit:write
 */
router.post(
  '/:id/score',
  requirePermission('credit:write'),
  validate(executeScoreSchema),
  scorecardController.executeScore,
);

/**
 * GET /applications/:id/scores
 * List all score runs for an application
 * Requires: credit:read
 */
router.get(
  '/:id/scores',
  requirePermission('credit:read'),
  scorecardController.getApplicationScores,
);

export default router;