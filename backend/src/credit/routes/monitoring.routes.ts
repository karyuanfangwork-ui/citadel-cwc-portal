import { Router } from 'express';
import { monitoringController } from '../controllers/monitoring.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createFacilityHealthSchema,
  updateFacilityHealthSchema,
  createCovenantSchema,
  createPaymentEventSchema,
} from '../validators/monitoring.validator';

const router = Router();

router.use(authenticate);

// App-scoped routes (mounted under /applications)
router.get('/:applicationId/health', requirePermission('credit:read'), monitoringController.getHealth);
router.post('/:applicationId/health', requirePermission('credit:write'), validate(createFacilityHealthSchema), monitoringController.createHealth);
router.patch('/:applicationId/health', requirePermission('credit:write'), validate(updateFacilityHealthSchema), monitoringController.updateHealth);
router.get('/:applicationId/covenants', requirePermission('credit:read'), monitoringController.listCovenants);
router.post('/:applicationId/covenants', requirePermission('credit:write'), validate(createCovenantSchema), monitoringController.createCovenant);
router.get('/:applicationId/payments', requirePermission('credit:read'), monitoringController.listPayments);
router.post('/:applicationId/payments', requirePermission('credit:write'), validate(createPaymentEventSchema), monitoringController.createPayment);
router.get('/:applicationId/signals', requirePermission('credit:read'), monitoringController.listSignals);

export default router;