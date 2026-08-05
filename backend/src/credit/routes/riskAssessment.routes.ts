import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import * as ctrl from '../controllers/riskAssessment.controller';
import { bulkUpsertRiskAssessmentSchema } from '../validators/riskAssessment.validator';

const router = Router();

router.get('/:appId/risk-assessments', authenticate, requirePermission('credit:read'), ctrl.list);
router.put('/:appId/risk-assessments', authenticate, requirePermission('credit:write'), validate(bulkUpsertRiskAssessmentSchema), ctrl.bulkUpsert);

export default router;