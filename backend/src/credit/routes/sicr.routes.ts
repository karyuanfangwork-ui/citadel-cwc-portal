import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import * as ctrl from '../controllers/sicr.controller';

const router = Router();

router.get('/:appId/sicr-assessments', authenticate, requirePermission('credit:read'), ctrl.list);
router.put('/:appId/sicr-assessments', authenticate, requirePermission('credit:write'), ctrl.bulkUpsert);

export default router;
