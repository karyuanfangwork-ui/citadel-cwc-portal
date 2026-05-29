import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { creditPiiReadLimiter, creditExportLimiter } from '../../middleware/rateLimit.middleware';
import { securityController } from '../controllers/security.controller';
import { clamAvController } from '../controllers/clamav.controller';
import {
  auditVerifySchema,
  piiLogsQuerySchema,
  exportRequestSchema,
  scanDocumentSchema,
} from '../validators/security.validator';

const router = Router();

// All security routes require authentication
router.use(authenticate);

/**
 * POST /credit/security/audit-verify
 * Verify audit chain integrity for a credit application.
 * Requires: credit:read
 */
router.post(
  '/audit-verify',
  requirePermission('credit:read'),
  validate(auditVerifySchema),
  securityController.verifyAuditChain,
);

/**
 * GET /credit/security/pii-logs
 * Get PII read-access logs with filters and pagination.
 * Requires: credit:admin
 * Rate-limited: 10/min/user (creditPiiReadLimiter)
 */
router.get(
  '/pii-logs',
  creditPiiReadLimiter,
  requirePermission('credit:admin'),
  validate(piiLogsQuerySchema),
  securityController.getPiiLogs,
);

/**
 * POST /credit/security/export
 * Request a PII data export with permission check and reason capture.
 * Requires: credit:export
 * Rate-limited: 5/min/user (creditExportLimiter)
 */
router.post(
  '/export',
  creditExportLimiter,
  requirePermission('credit:export'),
  validate(exportRequestSchema),
  securityController.requestExport,
);

/**
 * POST /credit/security/scan-document
 * Scan a credit document for viruses using ClamAV.
 * Requires: credit:write
 */
router.post(
  '/scan-document',
  requirePermission('credit:write'),
  validate(scanDocumentSchema),
  clamAvController.scanDocument,
);

export default router;