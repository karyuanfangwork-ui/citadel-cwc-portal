import { Router } from 'express';
import { requirePermission } from '../../middleware/auth.middleware';
import { validateUUID } from '../../middleware/uuidValidate.middleware';
import { listPolicyEvaluations, getPolicyEvaluationDetail } from '../controllers/policyResult.controller';

const router = Router();

router.get('/:applicationId/policy-results', validateUUID('applicationId'), requirePermission('credit:read'), listPolicyEvaluations);
router.get('/:applicationId/policy-results/:evaluationId', validateUUID('applicationId'), validateUUID('evaluationId'), requirePermission('credit:read'), getPolicyEvaluationDetail);

export default router;
