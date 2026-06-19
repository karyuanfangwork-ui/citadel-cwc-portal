import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { validateUUID } from '../../middleware/uuidValidate.middleware';
import { creditRuleConfigController } from '../controllers/creditRuleConfig.controller';
import { createRuleConfigSchema, updateRuleConfigSchema } from '../validators/creditRuleConfig.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/rule-configs',
  requirePermission('credit:admin'),
  creditRuleConfigController.list,
);

router.post(
  '/rule-configs',
  requirePermission('credit:admin'),
  validate(createRuleConfigSchema),
  creditRuleConfigController.create,
);

router.patch(
  '/rule-configs/:id',
  requirePermission('credit:admin'),
  validateUUID('id'),
  validate(updateRuleConfigSchema),
  creditRuleConfigController.update,
);

router.delete(
  '/rule-configs/:id',
  requirePermission('credit:admin'),
  validateUUID('id'),
  creditRuleConfigController.remove,
);

router.get(
  '/applications/:applicationId/resolved-rules',
  requirePermission('credit:read'),
  validateUUID('applicationId'),
  creditRuleConfigController.resolvedForApplication,
);

export default router;
