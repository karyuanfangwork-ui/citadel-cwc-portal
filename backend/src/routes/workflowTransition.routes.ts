import { Router } from 'express';
import { WorkflowTransitionController } from '../controllers/workflowTransition.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const controller = new WorkflowTransitionController();

router.get('/statuses', authenticate, controller.getStatuses);
router.get('/', authenticate, authorize('ADMIN'), controller.getAll);
router.post('/', authenticate, authorize('ADMIN'), controller.create);
router.put('/:id', authenticate, authorize('ADMIN'), controller.update);
router.delete('/:id', authenticate, authorize('ADMIN'), controller.delete);

export default router;
