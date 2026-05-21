import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import * as ctrl from '../controllers/profitability.controller';

const router = Router();

router.get('/:appId/profitability', authenticate, requirePermission('credit:read'), ctrl.getByApplication);
router.put('/:appId/profitability', authenticate, requirePermission('credit:write'), ctrl.upsert);

export default router;
