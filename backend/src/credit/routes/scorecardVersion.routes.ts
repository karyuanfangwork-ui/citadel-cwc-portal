import { Router } from 'express';
import { scorecardController } from '../controllers/scorecard.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * POST /scorecard-versions/:id/activate
 * Activate a specific scorecard version
 * Requires: credit:admin
 */
router.post(
  '/:id/activate',
  requirePermission('credit:admin'),
  scorecardController.activateVersion,
);

export default router;