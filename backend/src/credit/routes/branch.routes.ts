import { Router } from 'express';
import { branchController } from '../controllers/branch.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createBranchSchema, updateBranchSchema } from '../validators/branch.validator';

const router = Router();

router.use(authenticate);

/**
 * GET /branches
 * Requires: credit:read
 */
router.get('/', requirePermission('credit:read'), branchController.list);

/**
 * GET /branches/:id
 * Requires: credit:read
 */
router.get('/:id', requirePermission('credit:read'), branchController.getOne);

/**
 * POST /branches
 * Requires: credit:admin
 */
router.post('/', requirePermission('credit:admin'), validate(createBranchSchema), branchController.create);

/**
 * PATCH /branches/:id
 * Requires: credit:admin
 */
router.patch('/:id', requirePermission('credit:admin'), validate(updateBranchSchema), branchController.update);

/**
 * PATCH /branches/:id/deactivate
 * Requires: credit:admin
 */
router.patch('/:id/deactivate', requirePermission('credit:admin'), branchController.deactivate);

export default router;
