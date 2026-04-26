import { Router } from 'express';
import { entityController } from '../controllers/entity.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';

const router = Router();

// Public: list active entities (for dropdown population in request forms)
router.get('/active', authenticate, entityController.listActiveEntities);

// Entity CRUD — admin only
router.get('/', authenticate, requirePermission('admin:settings'), entityController.listEntities);
router.post('/', authenticate, requirePermission('admin:settings'), entityController.createEntity);
router.put('/:id', authenticate, requirePermission('admin:settings'), entityController.updateEntity);

// Routing rules — nested under request types
router.get('/routing-rules/:requestTypeId', authenticate, requirePermission('admin:settings'), entityController.listRoutingRules);
router.post('/routing-rules/:requestTypeId', authenticate, requirePermission('admin:settings'), entityController.createRoutingRule);
router.delete('/routing-rules/:requestTypeId/:ruleId', authenticate, requirePermission('admin:settings'), entityController.deleteRoutingRule);

export default router;