import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import * as ctrl from '../controllers/creditAi.controller';

const router = Router();

// A6 — Duplicate detection
router.get('/:appId/ai/duplicates', authenticate, requirePermission('credit:read'), ctrl.checkDuplicates);

// A5 — Red flags
router.post('/:appId/ai/red-flags', authenticate, requirePermission('credit:read'), ctrl.generateRedFlags);

// A4 — Risk narrative
router.post('/:appId/ai/narrative', authenticate, requirePermission('credit:read'), ctrl.generateNarrative);

// A13 — Compliance check
router.post('/:appId/ai/compliance', authenticate, requirePermission('credit:read'), ctrl.runComplianceCheck);

// A15 — Auto-exception detection
router.post('/:appId/ai/exceptions', authenticate, requirePermission('credit:read'), ctrl.detectExceptions);

// AI interaction audit trail
router.get('/:appId/ai/interactions', authenticate, requirePermission('credit:read'), ctrl.getInteractions);

// Human override (governance capture)
router.post('/:appId/ai/overrides', authenticate, requirePermission('credit:write'), ctrl.recordOverride);

export default router;