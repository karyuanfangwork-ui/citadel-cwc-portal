import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import * as ctrl from '../controllers/signoff.controller';

const router = Router();

router.get('/:appId/signoffs', authenticate, requirePermission('credit:read'), ctrl.list);
router.post('/:appId/signoffs', authenticate, requirePermission('credit:write'), ctrl.create);
router.delete('/:appId/signoffs/:role', authenticate, requirePermission('credit:write'), ctrl.revoke);

export default router;
