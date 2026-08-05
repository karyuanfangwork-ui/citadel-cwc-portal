import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import * as ctrl from '../controllers/retailIncome.controller';

const router = Router();

router.get('/:appId/retail-income', authenticate, requirePermission('credit:read'), ctrl.get);
router.put('/:appId/retail-income', authenticate, requirePermission('credit:write'), ctrl.upsert);
router.patch('/:appId/retail-income/verify', authenticate, requirePermission('credit:write'), ctrl.verify);

export default router;
