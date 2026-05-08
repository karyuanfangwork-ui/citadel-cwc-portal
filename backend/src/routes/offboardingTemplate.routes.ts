import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { listTemplates, createTemplate, updateTemplate, deleteTemplate } from '../controllers/offboardingTemplate.controller';

const router = Router();

router.use(authenticate);
router.use(requirePermission('admin:access', 'admin:settings'));

router.get('/', listTemplates);
router.post('/', requirePermission('admin:settings'), createTemplate);
router.put('/:id', requirePermission('admin:settings'), updateTemplate);
router.delete('/:id', requirePermission('admin:settings'), deleteTemplate);

export default router;
