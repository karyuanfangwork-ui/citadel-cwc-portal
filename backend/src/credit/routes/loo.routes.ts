import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { generateLoo, regenerateLoo, getLooStatus, getLooDocument } from '../controllers/loo.controller';

const router = Router();

router.use(authenticate);

// LOO (Letter of Offer) generation
router.post('/:appId/loo/generate', requirePermission('credit:approve'), generateLoo);
router.get('/:appId/loo/status', requirePermission('credit:read'), getLooStatus);
router.post('/:appId/loo/regenerate', requirePermission('credit:approve'), regenerateLoo);
router.get('/:appId/loo/document', requirePermission('credit:read'), getLooDocument);

export default router;