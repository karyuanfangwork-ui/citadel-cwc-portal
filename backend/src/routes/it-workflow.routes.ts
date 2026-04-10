import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { submitForApproval, managerDecision, markProcurement, markFulfilled } from '../controllers/it-workflow.controller';

const router = Router();

router.use(authenticate);

router.post('/requests/:id/submit-for-approval', authorize('ADMIN', 'AGENT'), submitForApproval);
router.post('/requests/:id/manager-decision', managerDecision);
router.post('/requests/:id/mark-procurement', authorize('ADMIN', 'AGENT'), markProcurement);
router.post('/requests/:id/mark-fulfilled', authorize('ADMIN', 'AGENT'), markFulfilled);

export default router;
