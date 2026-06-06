import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { getPricing, upsertPricing, computePreview } from '../controllers/pricing.controller';

const router = Router();

router.use(authenticate);

// Pricing worksheet per facility
router.get('/:facilityId/pricing', requirePermission('credit:read'), getPricing);
router.put('/:facilityId/pricing', requirePermission('credit:write'), upsertPricing);
router.post('/:facilityId/pricing/compute', requirePermission('credit:read'), computePreview);

export default router;