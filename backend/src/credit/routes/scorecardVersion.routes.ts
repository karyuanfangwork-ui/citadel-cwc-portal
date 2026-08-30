import { Router } from 'express';
import { scorecardController } from '../controllers/scorecard.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validateUUID } from '../../middleware/uuidValidate.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.post(
  '/:id/approve',
  requirePermission('credit:admin'),
  validateUUID('id'),
  scorecardController.approveVersion,
);

/**
 * POST /scorecard-versions/:id/activate
 * Activate a specific scorecard version
 * Requires: credit:admin
 */
router.post(
  '/:id/activate',
  requirePermission('credit:admin'),
  validateUUID('id'),
  scorecardController.activateVersion,
);

export default router;