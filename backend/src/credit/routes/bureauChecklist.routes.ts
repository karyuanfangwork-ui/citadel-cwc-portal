import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import * as ctrl from '../controllers/bureauChecklist.controller';

const router = Router();

router.get('/:appId/bureau-checklist', authenticate, requirePermission('credit:read'), ctrl.getChecklist);
router.put('/:appId/bureau-checklist', authenticate, requirePermission('credit:write'), ctrl.upsertChecklist);
router.post('/:appId/bureau-checklist/verify', authenticate, requirePermission('credit:approve'), ctrl.verifyBureauChecklist);
router.patch('/:appId/bureau-checks/:checkId/structured', authenticate, requirePermission('credit:write'), ctrl.updateBureauCheckStructured);

export default router;