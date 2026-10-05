import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { validateUUID } from '../../middleware/uuidValidate.middleware';
import {
  approveRequiredFieldRuleSet,
  activateRequiredFieldRuleSet,
  createRequiredFieldRuleSet,
  getRequiredFieldRuleSet,
  listRequiredFieldRuleSets,
  submitRequiredFieldRuleSet,
  creditRuleConfigController,
} from '../controllers/creditRuleConfig.controller';
import {
  activateRequiredFieldRuleSetSchema,
  createRequiredFieldRuleSetSchema,
  createRuleConfigSchema,
  updateRuleConfigSchema,
} from '../validators/creditRuleConfig.validator';

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

router.get('/rule-config-sets', requirePermission('credit:admin'), listRequiredFieldRuleSets);
router.get('/rule-config-sets/:id', requirePermission('credit:admin'), validateUUID('id'), getRequiredFieldRuleSet);
router.post(
  '/rule-config-sets',
  requirePermission('credit:admin'),
  validate(createRequiredFieldRuleSetSchema),
  createRequiredFieldRuleSet,
);
router.post('/rule-config-sets/:id/submit', requirePermission('credit:admin'), validateUUID('id'), submitRequiredFieldRuleSet);
router.post('/rule-config-sets/:id/approve', requirePermission('credit:admin'), validateUUID('id'), approveRequiredFieldRuleSet);
router.post(
  '/rule-config-sets/:id/activate',
  requirePermission('credit:admin'),
  validateUUID('id'),
  validate(activateRequiredFieldRuleSetSchema),
  activateRequiredFieldRuleSet,
);

router.get(
  '/applications/:applicationId/resolved-rules',
  requirePermission('credit:read'),
  validateUUID('applicationId'),
  creditRuleConfigController.resolvedForApplication,
);

export default router;
