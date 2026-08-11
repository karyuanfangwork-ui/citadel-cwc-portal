import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { borrowerDuplicateExceptionController } from '../controllers/borrowerDuplicateException.controller';
import { duplicateExceptionDecisionSchema, duplicateExceptionIdSchema, duplicateExceptionRequestSchema } from '../validators/borrowerDuplicateException.validator';

const router = Router();
router.use(authenticate);

router.post('/', requirePermission('credit:create'), validate(duplicateExceptionRequestSchema), borrowerDuplicateExceptionController.request);
router.get('/pending', requirePermission('credit:approve'), borrowerDuplicateExceptionController.listPending);
router.get('/:id', requirePermission('credit:read'), validate(duplicateExceptionIdSchema), borrowerDuplicateExceptionController.getOne);
router.post('/:id/decision', requirePermission('credit:approve'), validate(duplicateExceptionIdSchema), validate(duplicateExceptionDecisionSchema), borrowerDuplicateExceptionController.decision);

export default router;
