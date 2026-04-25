import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { listTemplates, createTemplate, updateTemplate, deleteTemplate } from '../controllers/onboardingTemplate.controller';

const router = Router();

router.use(authenticate);
router.use(requirePermission('admin:settings'));

router.get('/', listTemplates);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;
