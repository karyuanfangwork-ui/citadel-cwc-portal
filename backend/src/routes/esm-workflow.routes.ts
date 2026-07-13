import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
    submitForCeoApproval,
    reassignCeoApprover,
    ceoDecision,
    groupDceoDecision,
    confirmBooking,
    closeTicket,
} from '../controllers/esm-workflow.controller';

const router = Router();
router.use(authenticate);

// ESM Travel Request Workflow
router.post('/requests/:id/submit-for-ceo', authenticate, submitForCeoApproval);
router.post('/requests/:id/reassign-ceo-approver', authenticate, reassignCeoApprover);
router.post('/requests/:id/ceo-decision', authenticate, authorize('CEO', 'GROUP_DCEO'), ceoDecision);
router.post('/requests/:id/group-dceo-decision', authenticate, authorize('GROUP_DCEO'), groupDceoDecision);
router.post('/requests/:id/confirm-booking', authenticate, confirmBooking);
router.post('/requests/:id/close', authenticate, authorize('ADMIN', 'AGENT'), closeTicket);

export default router;