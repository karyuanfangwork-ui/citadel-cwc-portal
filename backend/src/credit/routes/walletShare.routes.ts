import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import * as ctrl from '../controllers/walletShare.controller';

const router = Router();

router.get('/:appId/wallet-shares', authenticate, requirePermission('credit:read'), ctrl.list);
router.put('/:appId/wallet-shares', authenticate, requirePermission('credit:write'), ctrl.bulkUpsert);
router.delete('/:appId/wallet-shares/:shareId', authenticate, requirePermission('credit:write'), ctrl.remove);

export default router;
