import { Router } from 'express';
import { requirePermission } from '../../middleware/auth.middleware';
import { validateUUID } from '../../middleware/uuidValidate.middleware';
import { getAssessmentResult } from '../controllers/assessmentResult.controller';

const router = Router();

router.get(
  '/:applicationId/assessment-result',
  validateUUID('applicationId'),
  requirePermission('credit:read'),
  getAssessmentResult,
);

export default router;
