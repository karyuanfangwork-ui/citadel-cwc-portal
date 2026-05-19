import { Response } from 'express';
import multer from 'multer';
import path from 'path';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { creditDocumentService, computeSha256 } from '../services/creditDocument.service';
import { requireUser } from '../utils/requireUser';

// ---------------------------------------------------------------------------
// Multer configuration for document uploads
// ---------------------------------------------------------------------------
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
  fileFilter: (_req, file, cb) => {
    // Allow common document types
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/tiff',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/zip',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(`Unsupported file type: ${file.mimetype}`, 400));
    }
  },
});

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------
class CreditDocumentController {
  // ===========================================================================
  // Credit Document CRUD
  // ===========================================================================

  /**
   * GET /credit-documents
   * List credit documents with pagination and filters.
   */
  list = asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      page,
      limit,
      applicationId,
      borrowerProfileId,
      classification,
      isAvClean,
      search,
    } = req.query as any;

    const result = await creditDocumentService.listDocuments({
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      applicationId: applicationId as string | undefined,
      borrowerProfileId: borrowerProfileId as string | undefined,
      classification: classification as any,
      isAvClean: isAvClean !== undefined ? isAvClean === 'true' : undefined,
      search: search as string | undefined,
    });

    res.json({ status: 'success', data: result });
  });

  /**
   * GET /credit-documents/:id
   * Get a single credit document.
   */
  getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const doc = await creditDocumentService.getDocument(id);

    if (!doc) {
      throw new AppError('Document not found', 404);
    }

    res.json({ status: 'success', data: { document: doc } });
  });

  /**
   * POST /credit-documents/upload
   * Upload a new credit document (multipart/form-data).
   */
  upload = [
    upload.single('file'),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      if (!req.file) {
        throw new AppError('No file uploaded', 400);
      }

      const { borrowerProfileId, applicationId, classification, description } = req.body;
      const user = requireUser(req);

      if (!borrowerProfileId) {
        throw new AppError('borrowerProfileId is required', 400);
      }
      if (!classification) {
        throw new AppError('classification is required', 400);
      }

      const sha256Hash = computeSha256(req.file.buffer);

      const doc = await creditDocumentService.uploadDocument({
        borrowerProfileId,
        applicationId: applicationId || null,
        classification,
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        sha256Hash,
        uploadedById: user.id,
        description: description || null,
      });

      res.status(201).json({ status: 'success', data: { document: doc } });
    }),
  ];

  /**
   * PATCH /credit-documents/:id
   * Update document metadata (classification, description, AV status).
   */
  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const doc = await creditDocumentService.updateDocument(id, req.body);

    if (!doc) {
      throw new AppError('Document not found', 404);
    }

    res.json({ status: 'success', data: { document: doc } });
  });

  /**
   * DELETE /credit-documents/:id
   * Soft-delete a credit document.
   */
  delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const user = requireUser(req);
    const doc = await creditDocumentService.deleteDocument(id, user.id);

    if (!doc) {
      throw new AppError('Document not found', 404);
    }

    res.json({ status: 'success', message: 'Document deleted successfully' });
  });

  // ===========================================================================
  // Document Versioning
  // ===========================================================================

  /**
   * POST /credit-documents/:id/replace
   * Replace a document (creates a new version).
   */
  replace = [
    upload.single('file'),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const id = String(req.params.id);

      if (!req.file) {
        throw new AppError('No file uploaded', 400);
      }

      const { changeSummary } = req.body;
      const sha256Hash = computeSha256(req.file.buffer);

      const doc = await creditDocumentService.replaceDocument(id, {
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        sha256Hash,
        changeSummary: changeSummary || null,
      });

      if (!doc) {
        throw new AppError('Document not found', 404);
      }

      res.json({ status: 'success', data: { document: doc } });
    }),
  ];

  /**
   * GET /credit-documents/:id/versions
   * List all versions for a document.
   */
  listVersions = asyncHandler(async (req: AuthRequest, res: Response) => {
    const documentId = String(req.params.id);
    const versions = await creditDocumentService.listVersions(documentId);

    if (versions === null) {
      throw new AppError('Document not found', 404);
    }

    res.json({ status: 'success', data: { versions } });
  });

  /**
   * GET /credit-documents/:id/versions/:version
   * Get a specific version of a document.
   */
  getVersion = asyncHandler(async (req: AuthRequest, res: Response) => {
    const documentId = String(req.params.id);
    const version = parseInt(String(req.params.version), 10);

    if (isNaN(version)) {
      throw new AppError('Version must be a number', 400);
    }

    const ver = await creditDocumentService.getVersion(documentId, version);

    if (!ver) {
      throw new AppError('Version not found', 404);
    }

    res.json({ status: 'success', data: { version: ver } });
  });

  // ===========================================================================
  // SHA-256 Hash
  // ===========================================================================

  /**
   * GET /credit-documents/:id/hash
   * Get the SHA-256 hash for a document.
   */
  getHash = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const doc = await creditDocumentService.getDocumentHash(id);

    if (!doc) {
      throw new AppError('Document not found', 404);
    }

    res.json({ status: 'success', data: { hash: doc } });
  });

  // ===========================================================================
  // AV Scan Status
  // ===========================================================================

  /**
   * PATCH /credit-documents/:id/av-status
   * Update the AV scan status of a document.
   */
  updateAvStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const { isAvClean, sha256Hash } = req.body;

    const doc = await creditDocumentService.updateAvStatus(id, isAvClean, sha256Hash);

    if (!doc) {
      throw new AppError('Document not found', 404);
    }

    res.json({ status: 'success', data: { document: doc } });
  });

  // ===========================================================================
  // Download (presigned URL)
  // ===========================================================================

  /**
   * GET /credit-documents/:id/download
   * Get a presigned download URL for the current version.
   */
  download = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const url = await creditDocumentService.getDownloadUrl(id);

    if (!url) {
      throw new AppError('Document not found', 404);
    }

    res.json({ status: 'success', data: { downloadUrl: url } });
  });

  /**
   * GET /credit-documents/:id/versions/:version/download
   * Get a presigned download URL for a specific version.
   */
  downloadVersion = asyncHandler(async (req: AuthRequest, res: Response) => {
    const documentId = String(req.params.id);
    const version = parseInt(String(req.params.version), 10);

    if (isNaN(version)) {
      throw new AppError('Version must be a number', 400);
    }

    const url = await creditDocumentService.getVersionDownloadUrl(documentId, version);

    if (!url) {
      throw new AppError('Version not found', 404);
    }

    res.json({ status: 'success', data: { downloadUrl: url } });
  });

  // ===========================================================================
  // Document Requirement Checklist
  // ===========================================================================

  /**
   * GET /applications/:applicationId/document-requirements
   * List document requirements for an application.
   */
  listRequirements = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const { page, limit, isMandatory, isCollected } = req.query as any;

    const result = await creditDocumentService.listRequirements({
      applicationId,
      page: Number(page) || 1,
      limit: Number(limit) || 50,
      isMandatory: isMandatory === 'true' ? true : isMandatory === 'false' ? false : undefined,
      isCollected: isCollected === 'true' ? true : isCollected === 'false' ? false : undefined,
    });

    res.json({ status: 'success', data: result });
  });

  /**
   * GET /applications/:applicationId/document-requirements/summary
   * Get checklist summary for an application.
   */
  getChecklistSummary = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const summary = await creditDocumentService.getChecklistSummary(applicationId);

    res.json({ status: 'success', data: summary });
  });

  /**
   * POST /document-requirements
   * Create a single document requirement.
   */
  createRequirement = asyncHandler(async (req: AuthRequest, res: Response) => {
    const requirement = await creditDocumentService.createRequirement(req.body);
    res.status(201).json({ status: 'success', data: { requirement } });
  });

  /**
   * POST /applications/:applicationId/document-requirements/batch
   * Batch-create document requirements for an application.
   */
  batchCreateRequirements = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const { items } = req.body;

    const result = await creditDocumentService.batchCreateRequirements(applicationId, items);

    res.status(201).json({ status: 'success', data: { created: result.count } });
  });

  /**
   * GET /document-requirements/:id
   * Get a single document requirement.
   */
  getRequirement = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const requirement = await creditDocumentService.getRequirement(id);

    if (!requirement) {
      throw new AppError('Document requirement not found', 404);
    }

    res.json({ status: 'success', data: { requirement } });
  });

  /**
   * PATCH /document-requirements/:id
   * Update a document requirement.
   */
  updateRequirement = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const requirement = await creditDocumentService.updateRequirement(id, req.body);

    if (!requirement) {
      throw new AppError('Document requirement not found', 404);
    }

    res.json({ status: 'success', data: { requirement } });
  });

  /**
   * DELETE /document-requirements/:id
   * Delete a document requirement.
   */
  deleteRequirement = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const requirement = await creditDocumentService.deleteRequirement(id);

    if (!requirement) {
      throw new AppError('Document requirement not found', 404);
    }

    res.json({ status: 'success', message: 'Document requirement deleted successfully' });
  });
}

export const creditDocumentController = new CreditDocumentController();