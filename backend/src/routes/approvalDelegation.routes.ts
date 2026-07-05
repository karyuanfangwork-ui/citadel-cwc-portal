/**
 * P5-08: Approval Delegation Routes
 *
 * REST endpoints for approval delegation and reminders.
 * All routes require authentication.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    delegateApprovalAction,
    getDelegationHistory,
    getReminderHistory,
} from '../controllers/approvalDelegation.controller';

const router = Router();

router.use(authenticate);

// Delegate an approval to another user
router.post('/:approvalId/delegate', delegateApprovalAction);

// Get delegation history for an approval
router.get('/:approvalId/delegations', getDelegationHistory);

// Get reminder history for an approval
router.get('/:approvalId/reminders', getReminderHistory);

export default router;