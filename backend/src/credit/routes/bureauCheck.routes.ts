import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import * as ctrl from '../controllers/bureauCheck.controller';

const router = Router();

router.get('/:appId/bureau-checks', authenticate, requirePermission('credit:read'), ctrl.list);
router.post('/:appId/bureau-checks', authenticate, requirePermission('credit:write'), ctrl.create);
router.patch('/:appId/bureau-checks/:id', authenticate, requirePermission('credit:write'), ctrl.update);
router.delete('/:appId/bureau-checks/:id', authenticate, requirePermission('credit:write'), ctrl.remove);

export default router;
