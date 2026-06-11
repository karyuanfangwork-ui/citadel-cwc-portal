import { Router } from 'express';
import { collateralController } from '../controllers/collateral.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import {
  createCollateralSchema,
} from '../validators/collateral.validator';
import { collateralService } from '../services/collateral.service';

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

// P1-4 — LTV Gate
router.get(
  '/facilities/:facilityId/ltv',
  requirePermission('credit:read'),
  collateralController.computeLtv,
);
router.get(
  '/:applicationId/ltv',
  requirePermission('credit:read'),
  collateralController.computeApplicationLtv,
);

// §7.1 — Collateral Cross-Application Linking
router.post(
  '/collateral/:collateralId/link',
  requirePermission('credit:write'),
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.id;
    const { applicationId } = req.body;
    const result = await collateralService.linkToApplication(req.params.collateralId as string, applicationId, userId);
    res.status(201).json({ status: 'success', data: result });
  }),
);

router.delete(
  '/collateral/:collateralId/link/:applicationId',
  requirePermission('credit:write'),
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.id;
    await collateralService.unlinkFromApplication(req.params.collateralId as string, req.params.applicationId as string, userId);
    res.status(204).send();
  }),
);

router.get(
  '/collateral/:collateralId/linked-apps',
  requirePermission('credit:read'),
  asyncHandler(async (req, res) => {
    const result = await collateralService.getLinkedApplications(req.params.collateralId as string);
    res.json({ status: 'success', data: result });
  }),
);

router.get(
  '/:applicationId/linked-collateral',
  requirePermission('credit:read'),
  asyncHandler(async (req, res) => {
    const result = await collateralService.getLinkedCollateral(req.params.applicationId as string);
    res.json({ status: 'success', data: result });
  }),
);

export default router;