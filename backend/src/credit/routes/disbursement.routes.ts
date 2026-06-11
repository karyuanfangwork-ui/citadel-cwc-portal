import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { z } from 'zod';
import * as ctrl from '../controllers/disbursement.controller';

// ── Validators ─────────────────────────────────────────────────────────

const createDisbursementSchema = z.object({
  body: z.object({
    totalAmount: z.number().positive('totalAmount must be a positive number'),
    currency: z.string().length(3, 'Currency must be a 3-letter ISO 4217 code').optional().default('MYR'),
    disbursementMethod: z.string().max(100).optional(),
    beneficiaryBank: z.string().max(200).optional(),
    beneficiaryAccount: z.string().max(50).optional(),
    referenceNote: z.string().max(2000).optional(),
  }),
});

const cancelDisbursementSchema = z.object({
  body: z.object({
    reason: z.string().min(1, 'Cancellation reason is required').max(2000).optional(),
  }),
});

// ── Routes ────────────────────────────────────────────────────────────

const router = Router();

router.post('/:appId/disbursement', authenticate, requirePermission('credit:write'), validate(createDisbursementSchema), ctrl.createDisbursement);
router.get('/:appId/disbursement', authenticate, requirePermission('credit:read'), ctrl.getDisbursement);
router.post('/:appId/disbursement/approve', authenticate, requirePermission('credit:approve'), ctrl.approveDisbursement);
router.post('/:appId/disbursement/disburse', authenticate, requirePermission('credit:disburse'), ctrl.confirmDisbursement);
router.post('/:appId/disbursement/cancel', authenticate, requirePermission('credit:approve'), validate(cancelDisbursementSchema), ctrl.cancelDisbursement);
router.get('/:appId/disbursement/readiness', authenticate, requirePermission('credit:read'), ctrl.getDisbursementReadiness);

export default router;