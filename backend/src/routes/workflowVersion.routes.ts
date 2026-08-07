import { Router } from 'express';

import { WorkflowVersionController } from '../controllers/workflowVersion.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';

const router = Router();
const controller = new WorkflowVersionController();
const manage = requirePermission('workflow:manage');

router.get('/', authenticate, controller.list);
router.get('/:workflowTypeId/versions', authenticate, controller.listVersions);
router.post('/:workflowTypeId/versions', authenticate, manage, controller.createDraft);

router.get('/versions/:versionId', authenticate, controller.getVersion);
router.patch('/versions/:versionId/nodes', authenticate, manage, controller.updateNodes);
router.patch('/versions/:versionId/edges', authenticate, manage, controller.updateEdges);
router.patch('/versions/:versionId/graph', authenticate, manage, controller.replaceGraph);
router.post('/versions/:versionId/validate', authenticate, controller.validate);
router.post('/versions/:versionId/publish', authenticate, manage, controller.publish);
router.post('/versions/:versionId/rollback', authenticate, manage, controller.rollback);
router.delete('/versions/:versionId', authenticate, manage, controller.discard);

export default router;