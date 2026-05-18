import { Router } from 'express';
import { scorecardController } from '../controllers/scorecard.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { overrideScoreSchema } from '../validators/scorecard.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * POST /score-runs/:id/override
 * Override a score run's risk rating
 * Requires: credit:admin
 */
router.post(
  '/:id/override',
  requirePermission('credit:admin'),
  validate(overrideScoreSchema),
  scorecardController.overrideScore,
);

export default router;