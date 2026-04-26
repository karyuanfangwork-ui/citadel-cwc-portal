import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
    submitChargeback,
    fromEntityDecision,
    toEntityDecision,
    markConfirmed,
    completeChargeback,
} from '../controllers/chargeback-workflow.controller';

const router = Router();
router.use(authenticate);

// Inter-Company Chargeback Workflow
// Agent submits chargeback to From Entity approver
router.post('/requests/:id/submit', authorize('ADMIN', 'AGENT'), submitChargeback);
// From Entity approver approves/rejects (controller verifies designated approver)
router.post('/requests/:id/from-entity-decision', authenticate, fromEntityDecision);
// To Entity approver approves/rejects (controller verifies designated approver)
router.post('/requests/:id/to-entity-decision', authenticate, toEntityDecision);
// Finance agent marks as confirmed (moves to awaiting confirmation)
router.post('/requests/:id/mark-confirmed', authorize('ADMIN', 'AGENT'), markConfirmed);
// Finance agent completes the chargeback
router.post('/requests/:id/complete', authorize('ADMIN', 'AGENT'), completeChargeback);

export default router;