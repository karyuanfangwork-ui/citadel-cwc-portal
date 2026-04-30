import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  markProcurement,
  markFulfilled,
  markHardwareOrdered,
  markHardwareReceived,
  markSoftwareProvisioned,
  acknowledgeRequest,
  ceoDecision,
  ctoDecision,
  routeToCfoApproval,
  cfoDecision,
  markPaymentDone,
  completeDelivery,
  uploadInvoice,
} from '../controllers/it-workflow.controller';

const router = Router();

router.use(authenticate);

router.post('/requests/:id/mark-procurement', authorize('ADMIN', 'AGENT'), markProcurement);
router.post('/requests/:id/mark-hardware-ordered', authorize('ADMIN', 'AGENT'), markHardwareOrdered);
router.post('/requests/:id/mark-hardware-received', authorize('ADMIN', 'AGENT'), markHardwareReceived);
router.post('/requests/:id/mark-software-provisioned', authorize('ADMIN', 'AGENT'), markSoftwareProvisioned);
router.post('/requests/:id/mark-fulfilled', authorize('ADMIN', 'AGENT'), markFulfilled);

// IT Hardware Executive Approval Chain
router.post('/requests/:id/acknowledge', authorize('ADMIN', 'AGENT'), acknowledgeRequest);
router.post('/requests/:id/ceo-decision', authorize('CEO'), ceoDecision);
router.post('/requests/:id/cto-decision', authorize('CTO'), ctoDecision);
router.post(
  '/requests/:id/route-to-cfo',
  authorize('ADMIN', 'AGENT'),
  uploadInvoice.single('invoice'),
  routeToCfoApproval
);
router.post('/requests/:id/cfo-decision', authorize('CFO'), cfoDecision);
router.post('/requests/:id/payment-done', authorize('ADMIN', 'AGENT'), markPaymentDone);
router.post('/requests/:id/complete-delivery', authorize('ADMIN', 'AGENT'), completeDelivery);

export default router;