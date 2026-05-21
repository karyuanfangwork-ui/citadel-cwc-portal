import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { exposureSummaryController } from '../controllers/exposureSummary.controller';

const router = Router();

router.use(authenticate);

// GET /applications/:applicationId/exposure-summary
router.get('/:applicationId/exposure-summary', requirePermission('credit:read'), exposureSummaryController.get);

// PUT /applications/:applicationId/exposure-summary
router.put('/:applicationId/exposure-summary', requirePermission('credit:write'), exposureSummaryController.upsert);

export default router;
