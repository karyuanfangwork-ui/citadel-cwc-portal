import { Router } from 'express';
import { bannerConfigController } from '../controllers/bannerConfig.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';

const router = Router();

router.get('/active', authenticate, bannerConfigController.getActive);
router.get('/', authenticate, requirePermission('banner:manage'), bannerConfigController.getAll);
router.post('/', authenticate, requirePermission('banner:manage'), bannerConfigController.create);
router.put('/:id', authenticate, requirePermission('banner:manage'), bannerConfigController.update);
router.delete('/:id', authenticate, requirePermission('banner:manage'), bannerConfigController.delete);

export default router;