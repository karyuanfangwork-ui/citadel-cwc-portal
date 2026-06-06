import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import * as ctrl from '../controllers/disbursement.controller';

const router = Router();

router.post('/:appId/disbursement', authenticate, requirePermission('credit:write'), ctrl.createDisbursement);
router.get('/:appId/disbursement', authenticate, requirePermission('credit:read'), ctrl.getDisbursement);
router.post('/:appId/disbursement/approve', authenticate, requirePermission('credit:approve'), ctrl.approveDisbursement);
router.post('/:appId/disbursement/disburse', authenticate, requirePermission('credit:disburse'), ctrl.confirmDisbursement);
router.post('/:appId/disbursement/cancel', authenticate, requirePermission('credit:approve'), ctrl.cancelDisbursement);
router.get('/:appId/disbursement/readiness', authenticate, requirePermission('credit:read'), ctrl.getDisbursementReadiness);

export default router;