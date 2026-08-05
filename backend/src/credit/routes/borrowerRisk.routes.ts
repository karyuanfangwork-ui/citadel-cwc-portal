import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import {
  listBorrowerRiskHistory,
  getLatestBorrowerRisk,
} from '../controllers/borrowerRisk.controller';

const router = Router();

// P2.5 — Borrower Risk History (immutable, separate from application score runs)
// Static route (latest) before parameterized routes
router.get('/borrower-profiles/:borrowerProfileId/risk-latest', authenticate, requirePermission('credit:read'), getLatestBorrowerRisk);
router.get('/borrower-profiles/:borrowerProfileId/risk-history', authenticate, requirePermission('credit:read'), listBorrowerRiskHistory);

export default router;