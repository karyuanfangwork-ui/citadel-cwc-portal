import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { uploadMultipleFiles } from '../middleware/upload.middleware';
import {
    acknowledge,
    routeToCfo,
    setFinalizedAmountAndRouteCfo,
    ceoDecision,
    cfoDecision,
    groupDceoDecision,
    reassignGroupDceoApprover,
    reassignCeoApprover,
    markPaymentComplete,
    closeTicket,
    updateAndCloseBudget,
    managerApproveExpense,
    managerRejectExpense,
    financeHeadApproveExpense,
    financeHeadRejectExpense,
    markExpensePaymentComplete,
} from '../controllers/finance-workflow.controller';

const router = Router();
router.use(authenticate);

// Purchase Requisition Workflow
router.post('/requests/:id/acknowledge', authorize('ADMIN', 'AGENT'), acknowledge);
router.post('/requests/:id/route-to-cfo', authorize('ADMIN', 'AGENT'), routeToCfo);
router.post(
    '/requests/:id/set-finalized-amount-and-route-cfo',
    authorize('ADMIN', 'AGENT'),
    uploadMultipleFiles('invoices', 5),
    setFinalizedAmountAndRouteCfo,
);
router.post('/requests/:id/ceo-decision', authorize('CEO'), ceoDecision);
router.post('/requests/:id/cfo-decision', authorize('CFO'), cfoDecision);
router.post('/requests/:id/group-dceo-decision', authorize('GROUP_DCEO'), groupDceoDecision);
router.post('/requests/:id/reassign-group-dceo-approver', authorize('ADMIN', 'AGENT'), reassignGroupDceoApprover);
router.post('/requests/:id/reassign-ceo-approver', authorize('ADMIN', 'AGENT'), reassignCeoApprover);
router.post('/requests/:id/mark-payment-complete', authorize('ADMIN', 'AGENT'), markPaymentComplete);
router.post('/requests/:id/close', authorize('ADMIN', 'AGENT'), closeTicket);
router.post('/requests/:id/update-and-close-budget', authorize('ADMIN', 'AGENT'), updateAndCloseBudget);

// Expense Reimbursement Workflow
router.post('/requests/:id/manager-approve-expense', authorize('ADMIN', 'AGENT'), managerApproveExpense);
router.post('/requests/:id/manager-reject-expense', authorize('ADMIN', 'AGENT'), managerRejectExpense);
router.post('/requests/:id/finance-head-approve-expense', authorize('ADMIN', 'AGENT'), financeHeadApproveExpense);
router.post('/requests/:id/finance-head-reject-expense', authorize('ADMIN', 'AGENT'), financeHeadRejectExpense);
router.post('/requests/:id/mark-expense-payment-complete', authorize('ADMIN', 'AGENT'), markExpensePaymentComplete);

export default router;