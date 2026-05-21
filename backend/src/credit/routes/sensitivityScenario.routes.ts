import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { sensitivityScenarioController } from '../controllers/sensitivityScenario.controller';

const router = Router();
router.use(authenticate);

router.get('/:applicationId/sensitivity-scenarios', requirePermission('credit:read'), sensitivityScenarioController.list);
router.put('/:applicationId/sensitivity-scenarios/:scenario', requirePermission('credit:write'), sensitivityScenarioController.upsert);

export default router;
