import { Router } from 'express';
import { financialController } from '../controllers/financial.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createStatementSchema,
  listStatementsQuerySchema,
  trendAnalysisQuerySchema,
} from '../validators/financial.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// Nested under /borrowers/:borrowerProfileId
// ============================================================================

/**
 * GET /borrowers/:borrowerProfileId/financials
 * List financial statements for a borrower
 * Requires: credit:read
 */
router.get(
  '/:borrowerProfileId/financials',
  requirePermission('credit:read'),
  validate(listStatementsQuerySchema),
  financialController.listStatements,
);

/**
 * POST /borrowers/:borrowerProfileId/financials
 * Create a new financial statement
 * Requires: credit:write
 */
router.post(
  '/:borrowerProfileId/financials',
  requirePermission('credit:write'),
  validate(createStatementSchema),
  financialController.createStatement,
);

/**
 * GET /borrowers/:borrowerProfileId/trends
 * Trend analysis for a borrower's financial ratios
 * Requires: credit:read
 */
router.get(
  '/:borrowerProfileId/trends',
  requirePermission('credit:read'),
  validate(trendAnalysisQuerySchema),
  financialController.getTrendAnalysis,
);

/**
 * GET /borrowers/:borrowerProfileId/exposure
 * Exposure aggregation for a borrower
 * Requires: credit:read
 */
router.get(
  '/:borrowerProfileId/exposure',
  requirePermission('credit:read'),
  financialController.getExposure,
);

export default router;