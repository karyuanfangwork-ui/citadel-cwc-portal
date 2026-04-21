import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { listTemplates, createTemplate, updateTemplate, deleteTemplate } from '../controllers/offboardingTemplate.controller';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', listTemplates);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;
