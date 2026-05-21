import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import * as ctrl from '../controllers/industryAssessment.controller';
import { createIndustryAssessmentSchema } from '../validators/industryAssessment.validator';

const router = Router();

router.get('/:appId/industry-assessment', authenticate, requirePermission('credit:read'), ctrl.get);
router.put('/:appId/industry-assessment', authenticate, requirePermission('credit:write'), validate(createIndustryAssessmentSchema), ctrl.upsert);

export default router;