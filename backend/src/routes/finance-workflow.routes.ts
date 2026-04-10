import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { submitForManager, managerDecision, submitForFinanceHead, financeHeadDecision, markPayment } from '../controllers/finance-workflow.controller';

const router = Router();

router.use(authenticate);

router.post('/requests/:id/submit-for-manager', authorize('ADMIN', 'AGENT'), submitForManager);
router.post('/requests/:id/manager-decision', managerDecision);
router.post('/requests/:id/submit-for-finance-head', authorize('ADMIN', 'AGENT'), submitForFinanceHead);
router.post('/requests/:id/finance-head-decision', financeHeadDecision);
router.post('/requests/:id/mark-payment', authorize('ADMIN', 'AGENT'), markPayment);

export default router;
