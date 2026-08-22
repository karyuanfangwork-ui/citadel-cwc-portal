import { Router } from 'express';
import { RequestStatusDefinitionController } from '../controllers/requestStatusDefinition.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';

const router = Router();
const controller = new RequestStatusDefinitionController();

router.get('/active', authenticate, controller.getActive);
router.get('/', authenticate, requirePermission('admin:settings'), controller.getAll);
router.post('/', authenticate, requirePermission('admin:settings'), controller.create);
router.put('/:id', authenticate, requirePermission('admin:settings'), controller.update);
router.get('/:id/usage', authenticate, requirePermission('admin:settings'), controller.getUsage);
router.post('/:id/retire', authenticate, requirePermission('admin:settings'), controller.retire);
router.delete('/:id', authenticate, requirePermission('admin:settings'), controller.delete);

export default router;
