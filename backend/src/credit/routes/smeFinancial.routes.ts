/**
 * P2-3: SME Financial Assessment Routes
 *
 * Routes for SME-specific financial assessment endpoints.
 */

import { Router } from 'express';
import { getSmeAssessment, getDualAssessment, validateStatementType, recommendStatementType } from '../controllers/smeFinancial.controller';
import { requirePermission } from '../../middleware/auth.middleware';

const router = Router();

// SME financial assessment endpoints
router.get('/assessment/:borrowerProfileId', requirePermission('credit:read'), getSmeAssessment);
router.get('/dual-assessment/:borrowerProfileId', requirePermission('credit:read'), getDualAssessment);
router.post('/validate-statement-type', requirePermission('credit:read'), validateStatementType);
router.post('/recommend-statement-type/:borrowerProfileId', requirePermission('credit:read'), recommendStatementType);

export default router;