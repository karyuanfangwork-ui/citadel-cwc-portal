import { Router } from 'express';
import { bannerConfigController } from '../controllers/bannerConfig.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/active', authenticate, bannerConfigController.getActive);
router.get('/', authenticate, authorize('ADMIN'), bannerConfigController.getAll);
router.post('/', authenticate, authorize('ADMIN'), bannerConfigController.create);
router.put('/:id', authenticate, authorize('ADMIN'), bannerConfigController.update);
router.delete('/:id', authenticate, authorize('ADMIN'), bannerConfigController.delete);

export default router;
