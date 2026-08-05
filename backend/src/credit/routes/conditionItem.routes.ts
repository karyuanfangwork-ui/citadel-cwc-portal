import { Router } from 'express';
import { conditionController } from '../controllers/condition.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { updateConditionSchema, completeConditionSchema, waiveConditionSchema } from '../validators/condition.validator';

const router = Router();

router.use(authenticate);

// Single item CRUD
router.get('/:id', requirePermission('credit:read'), conditionController.getOne);
router.patch('/:id', requirePermission('credit:write'), validate(updateConditionSchema), conditionController.update);
router.post('/:id/complete', requirePermission('credit:write'), validate(completeConditionSchema), conditionController.complete);
router.post('/:id/waive', requirePermission('credit:admin'), validate(waiveConditionSchema), conditionController.waive);

export default router;