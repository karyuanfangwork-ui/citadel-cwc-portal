import { Router } from 'express';
import { consentController } from '../controllers/consent.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = Router();

// All consent routes require authentication
router.use(authenticate);

// Record consent — credit:write permission
router.post(
  '/',
  requirePermission('credit:write'),
  consentController.recordConsent,
);

// Withdraw consent — credit:write permission
router.post(
  '/:id/withdraw',
  requirePermission('credit:write'),
  consentController.withdrawConsent,
);

// Get single consent record — credit:read permission
router.get(
  '/:id',
  requirePermission('credit:read'),
  consentController.getConsent,
);

// List consents for a subject — credit:read permission
router.get(
  '/subject/:subjectId',
  requirePermission('credit:read'),
  consentController.getSubjectConsents,
);

// Check if consent exists for a purpose — credit:read permission
router.get(
  '/subject/:subjectId/check',
  requirePermission('credit:read'),
  consentController.checkConsent,
);

// PDPA data-subject export — credit:read permission
router.get(
  '/export/:subjectId',
  requirePermission('credit:read'),
  consentController.exportSubjectData,
);

// Admin: list all consents — credit:admin permission
router.get(
  '/',
  requirePermission('credit:admin'),
  consentController.listConsents,
);

export default router;