import { Router } from 'express';
import { escalationRuleController } from '../controllers/escalationRule.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate, requirePermission('admin:settings'));

router.get('/request-types/:requestTypeId/escalation-rules', escalationRuleController.listByRequestType);
router.post('/escalation-rules', escalationRuleController.create);
router.put('/escalation-rules/:id', escalationRuleController.update);
router.delete('/escalation-rules/:id', escalationRuleController.delete);

export default router;
