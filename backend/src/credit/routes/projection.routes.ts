import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { projectionController } from '../controllers/projection.controller';

const router = Router();
router.use(authenticate);

router.get('/:applicationId/cashflow-projection', requirePermission('credit:read'), projectionController.get);
router.put('/:applicationId/cashflow-projection', requirePermission('credit:write'), projectionController.upsertHeader);
router.put('/:applicationId/cashflow-projection/lines', requirePermission('credit:write'), projectionController.upsertLines);

export default router;
