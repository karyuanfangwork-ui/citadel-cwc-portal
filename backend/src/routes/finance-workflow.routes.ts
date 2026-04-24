import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
    acknowledge,
    setFinalizedAmountAndRouteCfo,
    cfoDecision,
    groupCeoDecision,
    markPaymentComplete,
    closeTicket,
} from '../controllers/finance-workflow.controller';

const router = Router();
router.use(authenticate);

// Purchase Requisition Workflow
router.post('/requests/:id/acknowledge', authorize('ADMIN', 'AGENT'), acknowledge);
router.post('/requests/:id/set-finalized-amount-and-route-ceo', authorize('ADMIN', 'AGENT'), setFinalizedAmountAndRouteCfo);
router.post('/requests/:id/cfo-decision', authorize('CFO'), cfoDecision);
router.post('/requests/:id/group-ceo-decision', authorize('GROUP_CEO'), groupCeoDecision);
router.post('/requests/:id/mark-payment-complete', authorize('ADMIN', 'AGENT'), markPaymentComplete);
router.post('/requests/:id/close', authorize('ADMIN', 'AGENT'), closeTicket);

export default router;