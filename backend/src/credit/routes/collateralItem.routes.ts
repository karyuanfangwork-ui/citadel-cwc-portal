import { Router } from 'express';
import { collateralController } from '../controllers/collateral.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  updateCollateralSchema,
  createValuationSchema,
  createLienSchema,
  dischargeLienSchema,
  createInsuranceSchema,
} from '../validators/collateral.validator';

const router = Router();

router.use(authenticate);

// Single item CRUD
router.get('/:id', requirePermission('credit:read'), collateralController.getOne);
router.patch('/:id', requirePermission('credit:write'), validate(updateCollateralSchema), collateralController.update);
router.delete('/:id', requirePermission('credit:admin'), collateralController.delete);

// Valuations
router.post('/:id/valuations', requirePermission('credit:write'), validate(createValuationSchema), collateralController.addValuation);
router.get('/:id/valuations', requirePermission('credit:read'), collateralController.listValuations);

// Liens
router.post('/:id/liens', requirePermission('credit:write'), validate(createLienSchema), collateralController.addLien);
router.get('/:id/liens', requirePermission('credit:read'), collateralController.listLiens);
router.patch('/liens/:lienId/discharge', requirePermission('credit:write'), validate(dischargeLienSchema), collateralController.dischargeLien);

// Insurance
router.post('/:id/insurance', requirePermission('credit:write'), validate(createInsuranceSchema), collateralController.addInsurance);
router.get('/:id/insurance', requirePermission('credit:read'), collateralController.listInsurance);

export default router;