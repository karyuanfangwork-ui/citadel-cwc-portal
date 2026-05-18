import { Router } from 'express';
import { monitoringController } from '../controllers/monitoring.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createCovenantTestSchema,
  updatePaymentEventSchema,
  resolveSignalSchema,
} from '../validators/monitoring.validator';

const router = Router();

router.use(authenticate);

// Item-scoped routes (mounted at root /credit)
router.post('/covenants/:id/tests', requirePermission('credit:write'), validate(createCovenantTestSchema), monitoringController.createTest);
router.get('/covenants/:id/tests', requirePermission('credit:read'), monitoringController.listTests);
router.patch('/payments/:id', requirePermission('credit:write'), validate(updatePaymentEventSchema), monitoringController.updatePayment);
router.get('/signals', requirePermission('credit:read'), monitoringController.listActiveSignals);
router.post('/signals/:id/resolve', requirePermission('credit:write'), validate(resolveSignalSchema), monitoringController.resolveSignal);
router.get('/monitoring/reviews-due', requirePermission('credit:read'), monitoringController.listReviewsDue);

export default router;