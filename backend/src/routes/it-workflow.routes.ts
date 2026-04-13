import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  submitForApproval,
  managerDecision,
  markProcurement,
  markFulfilled,
  markHardwareOrdered,
  markHardwareReceived,
  markSoftwareProvisioned,
  vpDecision,
  resubmitRequest,
  getSuggestedManager,
} from '../controllers/it-workflow.controller';

const router = Router();

router.use(authenticate);

router.post('/requests/:id/submit-for-approval', authorize('ADMIN', 'AGENT'), submitForApproval);
router.post('/requests/:id/manager-decision', managerDecision);
router.post('/requests/:id/mark-procurement', authorize('ADMIN', 'AGENT'), markProcurement);
router.post('/requests/:id/mark-hardware-ordered', authorize('ADMIN', 'AGENT'), markHardwareOrdered);
router.post('/requests/:id/mark-hardware-received', authorize('ADMIN', 'AGENT'), markHardwareReceived);
router.post('/requests/:id/mark-software-provisioned', authorize('ADMIN', 'AGENT'), markSoftwareProvisioned);
router.post('/requests/:id/mark-fulfilled', authorize('ADMIN', 'AGENT'), markFulfilled);
router.post('/requests/:id/vp-decision', authorize('ADMIN'), vpDecision);
router.post('/requests/:id/resubmit', resubmitRequest);
router.get('/requests/:id/suggested-manager', getSuggestedManager);

export default router;
