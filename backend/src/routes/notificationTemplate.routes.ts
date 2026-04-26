import { Router } from 'express';
import { notificationTemplateController } from '../controllers/notificationTemplate.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Read-only routes — any admin with workflow:manage can view
router.get('/event-types', notificationTemplateController.getEventTypes);
router.get('/', notificationTemplateController.getAll);
router.get('/:id', notificationTemplateController.getOne);

// Write routes — require workflow:manage permission
router.post('/', requirePermission('workflow:manage'), notificationTemplateController.create);
router.put('/:id', requirePermission('workflow:manage'), notificationTemplateController.update);
router.delete('/:id', requirePermission('workflow:manage'), notificationTemplateController.delete);
router.post('/:id/test', requirePermission('workflow:manage'), notificationTemplateController.sendTestEmail);

export default router;
