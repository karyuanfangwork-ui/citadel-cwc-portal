import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { z } from 'zod';
import * as ctrl from '../controllers/retailIncome.controller';

const router = Router();

const dsrPreviewSchema = z.object({
  monthlyGrossIncome: z.number().finite().nonnegative(),
  hirePurchaseCommitment: z.number().finite().nonnegative().optional().default(0),
  creditCardCommitment: z.number().finite().nonnegative().optional().default(0),
  existingLoanCommitment: z.number().finite().nonnegative().optional().default(0),
  otherCommitments: z.number().finite().nonnegative().optional().default(0),
  proposedInstalment: z.number().finite().nonnegative().optional().default(0),
  epfMonthlyAmount: z.number().finite().nonnegative().optional().default(0),
  monthlyTaxDeduction: z.number().finite().nonnegative().optional().default(0),
  monthlySocsoDeduction: z.number().finite().nonnegative().optional().default(0),
});

router.post('/retail-income/dsr-preview', authenticate, requirePermission('credit:read'), validate(dsrPreviewSchema), ctrl.previewDsr);

router.get('/:appId/retail-income', authenticate, requirePermission('credit:read'), ctrl.get);
router.put('/:appId/retail-income', authenticate, requirePermission('credit:write'), ctrl.upsert);
router.patch('/:appId/retail-income/verify', authenticate, requirePermission('credit:write'), ctrl.verify);

export default router;
