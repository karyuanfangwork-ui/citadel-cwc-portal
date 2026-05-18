import { Router } from 'express';
import { collateralController } from '../controllers/collateral.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createCollateralSchema,
} from '../validators/collateral.validator';

const router = Router();

router.use(authenticate);

// Application-scoped: list, create, total-value
router.get(
  '/:applicationId/collateral',
  requirePermission('credit:read'),
  collateralController.list,
);
router.post(
  '/:applicationId/collateral',
  requirePermission('credit:write'),
  validate(createCollateralSchema),
  collateralController.create,
);
router.get(
  '/:applicationId/collateral/total-value',
  requirePermission('credit:read'),
  collateralController.totalValue,
);

export default router;