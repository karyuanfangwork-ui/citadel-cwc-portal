import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { triggerRescreen, getRescreenHistory, reviewRescreenEvent } from '../controllers/amlRescreen.controller';

// ---------------------------------------------------------------------------
// §2.8 — AML Rescreen Event Routes
// ---------------------------------------------------------------------------

const router = Router();

// Borrower-scoped routes
router.post(
  '/borrowers/:borrowerId/aml-rescreen',
  authenticate,
  requirePermission('credit:aml_rescreen:create'),
  triggerRescreen,
);
router.get(
  '/borrowers/:borrowerId/aml-rescreen',
  authenticate,
  requirePermission('credit:aml_rescreen:read'),
  getRescreenHistory,
);

// Event-scoped routes
router.patch(
  '/aml-rescreen/:eventId/review',
  authenticate,
  requirePermission('credit:aml_rescreen:review'),
  reviewRescreenEvent,
);

export default router;