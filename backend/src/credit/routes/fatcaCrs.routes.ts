import { Router } from 'express';
import { fatcaCrsController } from '../controllers/fatcaCrs.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { upsertFatcaCrsSchema } from '../validators/fatcaCrs.validator';
import { assertBorrowerAccess } from '../middleware/assertBorrowerAccess.middleware';

const router = Router();

router.use(authenticate);

/**
 * GET /borrowers/:borrowerId/fatca-crs
 * Requires: credit:read
 */
router.get(
  '/:borrowerId/fatca-crs',
  requirePermission('credit:read'),
  assertBorrowerAccess(),
  fatcaCrsController.get,
);

/**
 * PUT /borrowers/:borrowerId/fatca-crs
 * Requires: credit:write
 */
router.put(
  '/:borrowerId/fatca-crs',
  requirePermission('credit:write'),
  assertBorrowerAccess(),
  validate(upsertFatcaCrsSchema),
  fatcaCrsController.upsert,
);

/**
 * PATCH /borrowers/:borrowerId/fatca-crs/verify
 * Requires: credit:approve
 */
router.patch(
  '/:borrowerId/fatca-crs/verify',
  requirePermission('credit:approve'),
  assertBorrowerAccess(),
  fatcaCrsController.verify,
);

export default router;
