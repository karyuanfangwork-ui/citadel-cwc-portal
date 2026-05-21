import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import * as ctrl from '../controllers/riskAssessment.controller';

const router = Router();

router.get('/:appId/risk-assessments', authenticate, requirePermission('credit:read'), ctrl.list);
router.put('/:appId/risk-assessments', authenticate, requirePermission('credit:write'), ctrl.bulkUpsert);

export default router;
