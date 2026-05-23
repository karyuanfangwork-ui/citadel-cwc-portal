import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getPolicyExplanation } from '../controllers/policyExplainer.controller';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/approvals/policy-explainer
 * @desc    Get a human-readable explanation of why the current user is the approver
 * @query   type — 'itsm' | 'credit'
 * @query   id   — requestId (ITSM) or applicationId (credit)
 * @access  Private
 */
router.get('/policy-explainer', getPolicyExplanation);

export default router;