import { Router } from 'express';
import { WorkflowTransitionController } from '../controllers/workflowTransition.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';

const router = Router();
const controller = new WorkflowTransitionController();

router.get('/statuses', authenticate, controller.getStatuses);
router.get('/', authenticate, controller.getAll);
router.post('/', authenticate, requirePermission('workflow:manage'), controller.create);
router.put('/:id', authenticate, requirePermission('workflow:manage'), controller.update);
router.delete('/:id', authenticate, requirePermission('workflow:manage'), controller.delete);

export default router;