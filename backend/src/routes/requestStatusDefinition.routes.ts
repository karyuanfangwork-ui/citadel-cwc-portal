import { Router } from 'express';
import { RequestStatusDefinitionController } from '../controllers/requestStatusDefinition.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const controller = new RequestStatusDefinitionController();

router.get('/active', authenticate, controller.getActive);
router.get('/', authenticate, authorize('ADMIN'), controller.getAll);
router.post('/', authenticate, authorize('ADMIN'), controller.create);
router.put('/:id', authenticate, authorize('ADMIN'), controller.update);
router.delete('/:id', authenticate, authorize('ADMIN'), controller.delete);

export default router;
