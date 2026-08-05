import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import * as ctrl from '../controllers/accountUtilisation.controller';

const router = Router();

router.get('/:appId/account-utilisation', authenticate, requirePermission('credit:read'), ctrl.list);
router.put('/:appId/account-utilisation', authenticate, requirePermission('credit:write'), ctrl.upsertOne);
router.delete('/:appId/account-utilisation/:id', authenticate, requirePermission('credit:write'), ctrl.remove);

export default router;
