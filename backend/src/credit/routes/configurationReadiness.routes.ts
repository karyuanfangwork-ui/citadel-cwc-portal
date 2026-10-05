import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { getCreditConfigurationReadiness } from '../controllers/configHealth.controller';

const router = Router();
router.use(authenticate);
router.get('/', requirePermission('credit:admin'), getCreditConfigurationReadiness);

export default router;
