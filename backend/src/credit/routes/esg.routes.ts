import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import * as ctrl from '../controllers/esg.controller';

const router = Router();

router.get('/:appId/esg-assessment', authenticate, requirePermission('credit:read'), ctrl.get);
router.put('/:appId/esg-assessment', authenticate, requirePermission('credit:write'), ctrl.upsert);

export default router;
