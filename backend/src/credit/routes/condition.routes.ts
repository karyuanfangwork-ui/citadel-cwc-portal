import { Router } from 'express';
import { conditionController } from '../controllers/condition.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createConditionSchema } from '../validators/condition.validator';

const router = Router();

router.use(authenticate);

// Application-scoped: list, create, cp-completion
router.get('/:applicationId/conditions', requirePermission('credit:read'), conditionController.list);
router.post('/:applicationId/conditions', requirePermission('credit:write'), validate(createConditionSchema), conditionController.create);
router.get('/:applicationId/cp-completion', requirePermission('credit:read'), conditionController.cpCompletion);

export default router;