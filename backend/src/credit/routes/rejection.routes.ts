import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { cloneFromRejected, listRejectionReasons } from '../controllers/rejection.controller';

const router = Router();

router.use(authenticate);

// Rejection workflow
router.get('/rejection-reasons', requirePermission('credit:read'), listRejectionReasons);
router.post('/:appId/clone', requirePermission('credit:write'), cloneFromRejected);

export default router;