import { Router } from 'express';
import { escalationRuleController } from '../controllers/escalationRule.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate, requirePermission('admin:access', 'admin:settings'));

router.get('/request-types/:requestTypeId/escalation-rules', escalationRuleController.listByRequestType);
router.get('/escalation-rules/overview', escalationRuleController.listOverview);
router.post('/escalation-rules', requirePermission('admin:settings'), escalationRuleController.create);
router.put('/escalation-rules/:id', requirePermission('admin:settings'), escalationRuleController.update);
router.delete('/escalation-rules/:id', requirePermission('admin:settings'), escalationRuleController.delete);

export default router;
