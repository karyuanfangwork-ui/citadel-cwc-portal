import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import * as ctrl from '../controllers/rmdIssue.controller';

const router = Router();

router.get('/:appId/rmd-issues', authenticate, requirePermission('credit:read'), ctrl.list);
router.post('/:appId/rmd-issues', authenticate, requirePermission('credit:write'), ctrl.create);
router.patch('/:appId/rmd-issues/:id', authenticate, requirePermission('credit:write'), ctrl.update);
router.delete('/:appId/rmd-issues/:id', authenticate, requirePermission('credit:write'), ctrl.remove);

export default router;
