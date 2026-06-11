import { Router } from 'express';
import { creditDocumentController } from '../controllers/creditDocument.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { assertBorrowerAccess } from '../middleware/assertBorrowerAccess.middleware';
import {
  listCreditDocumentsSchema,
  updateCreditDocumentSchema,
  replaceCreditDocumentSchema,
  updateAvStatusSchema,
  rejectDocumentSchema,
  listDocumentRequirementsSchema,
  createDocumentRequirementSchema,
  batchCreateDocumentRequirementsSchema,
  updateDocumentRequirementSchema,
} from '../validators/creditDocument.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==============================================================================
// Credit Documents
// ==============================================================================

/**
 * GET /credit-documents
 * List credit documents with pagination and filters
 * Requires: credit:read
 */
router.get(
  '/credit-documents',
  requirePermission('credit:read'),
  validate(listCreditDocumentsSchema),
  creditDocumentController.list,
);

/**
 * GET /credit-documents/:id
 * Get a single credit document
 * Requires: credit:read
 */
router.get(
  '/credit-documents/:id',
  requirePermission('credit:read'),
  creditDocumentController.getOne,
);

/**
 * POST /credit-documents/upload
 * Upload a new credit document (multipart/form-data)
 * Requires: credit:write
 */
router.post(
  '/credit-documents/upload',
  requirePermission('credit:write'),
  ...creditDocumentController.upload,
);

/**
 * PATCH /credit-documents/:id
 * Update document metadata
 * Requires: credit:write
 */
router.patch(
  '/credit-documents/:id',
  requirePermission('credit:write'),
  validate(updateCreditDocumentSchema),
  creditDocumentController.update,
);

/**
 * DELETE /credit-documents/:id
 * Soft-delete a credit document
 * Requires: credit:admin
 */
router.delete(
  '/credit-documents/:id',
  requirePermission('credit:admin'),
  creditDocumentController.delete,
);

// ==============================================================================
// Document Versioning
// ==============================================================================

/**
 * POST /credit-documents/:id/replace
 * Replace a document with a new version (multipart/form-data)
 * Requires: credit:write
 */
router.post(
  '/credit-documents/:id/replace',
  requirePermission('credit:write'),
  validate(replaceCreditDocumentSchema),
  ...creditDocumentController.replace,
);

/**
 * GET /credit-documents/:id/versions
 * List all versions of a document
 * Requires: credit:read
 */
router.get(
  '/credit-documents/:id/versions',
  requirePermission('credit:read'),
  creditDocumentController.listVersions,
);

/**
 * GET /credit-documents/:id/versions/:version
 * Get a specific version of a document
 * Requires: credit:read
 */
router.get(
  '/credit-documents/:id/versions/:version',
  requirePermission('credit:read'),
  creditDocumentController.getVersion,
);

// ==============================================================================
// SHA-256 Hash
// ==============================================================================

/**
 * GET /credit-documents/:id/hash
 * Get the SHA-256 hash for a document
 * Requires: credit:read
 */
router.get(
  '/credit-documents/:id/hash',
  requirePermission('credit:read'),
  creditDocumentController.getHash,
);

// ==============================================================================
// AV Scan Status
// ==============================================================================

/**
 * POST /credit-documents/:id/verify
 * Mark a document as verified
 * Requires: credit:write
 */
router.post(
  '/credit-documents/:id/verify',
  requirePermission('credit:write'),
  creditDocumentController.verify,
);

/**
 * POST /credit-documents/:id/reject
 * Reject a document with a reason
 * Requires: credit:write
 */
router.post(
  '/credit-documents/:id/reject',
  requirePermission('credit:write'),
  validate(rejectDocumentSchema),
  creditDocumentController.reject,
);

/**
 * PATCH /credit-documents/:id/av-status
 * Update AV scan status of a document
 * Requires: credit:admin
 *
 * TODO(security): This endpoint should be protected by an API key or service-to-service
 * auth mechanism (e.g. X-API-Key header) rather than a user-facing permission, since
 * it is intended to be called only by the AV scan service / webhook. The current
 * credit:admin permission still allows any admin user to bypass AV scanning.
 */
router.patch(
  '/credit-documents/:id/av-status',
  requirePermission('credit:admin'),
  validate(updateAvStatusSchema),
  creditDocumentController.updateAvStatus,
);

// ==============================================================================
// Document Download (presigned URL)
// ==============================================================================

/**
 * GET /credit-documents/:id/download
 * Get a presigned download URL for the current version
 * Requires: credit:read
 */
router.get(
  '/credit-documents/:id/download',
  requirePermission('credit:read'),
  assertBorrowerAccess(),
  creditDocumentController.download,
);

/**
 * GET /credit-documents/:id/versions/:version/download
 * Get a presigned download URL for a specific version
 * Requires: credit:read
 */
router.get(
  '/credit-documents/:id/versions/:version/download',
  requirePermission('credit:read'),
  assertBorrowerAccess(),
  creditDocumentController.downloadVersion,
);

// ==============================================================================
// Document Requirements (per application)
// ==============================================================================

/**
 * GET /applications/:applicationId/document-requirements
 * List document requirements for an application
 * Requires: credit:read
 */
router.get(
  '/applications/:applicationId/document-requirements',
  requirePermission('credit:read'),
  validate(listDocumentRequirementsSchema),
  creditDocumentController.listRequirements,
);

/**
 * GET /applications/:applicationId/document-requirements/summary
 * Get checklist summary for an application
 * Requires: credit:read
 */
router.get(
  '/applications/:applicationId/document-requirements/summary',
  requirePermission('credit:read'),
  creditDocumentController.getChecklistSummary,
);

/**
 * POST /applications/:applicationId/document-requirements/batch
 * Batch-create document requirements
 * Requires: credit:write
 */
router.post(
  '/applications/:applicationId/document-requirements/batch',
  requirePermission('credit:write'),
  validate(batchCreateDocumentRequirementsSchema),
  creditDocumentController.batchCreateRequirements,
);

// ==============================================================================
// Document Requirements (top-level CRUD)
// ==============================================================================

/**
 * POST /document-requirements
 * Create a single document requirement
 * Requires: credit:write
 */
router.post(
  '/document-requirements',
  requirePermission('credit:write'),
  validate(createDocumentRequirementSchema),
  creditDocumentController.createRequirement,
);

/**
 * GET /document-requirements/:id
 * Get a single document requirement
 * Requires: credit:read
 */
router.get(
  '/document-requirements/:id',
  requirePermission('credit:read'),
  creditDocumentController.getRequirement,
);

/**
 * PATCH /document-requirements/:id
 * Update a document requirement
 * Requires: credit:write
 */
router.patch(
  '/document-requirements/:id',
  requirePermission('credit:write'),
  validate(updateDocumentRequirementSchema),
  creditDocumentController.updateRequirement,
);

/**
 * DELETE /document-requirements/:id
 * Delete a document requirement
 * Requires: credit:admin
 */
router.delete(
  '/document-requirements/:id',
  requirePermission('credit:admin'),
  creditDocumentController.deleteRequirement,
);

export default router;