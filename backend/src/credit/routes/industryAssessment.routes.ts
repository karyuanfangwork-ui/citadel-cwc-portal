import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import * as ctrl from '../controllers/industryAssessment.controller';

const router = Router();

router.get('/:appId/industry-assessment', authenticate, requirePermission('credit:read'), ctrl.get);
router.put('/:appId/industry-assessment', authenticate, requirePermission('credit:write'), ctrl.upsert);

export default router;
