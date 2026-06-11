import * as crypto from 'crypto';
import prisma from '../../utils/prisma';
import { Prisma, DocumentClass } from '@prisma/client';
import { s3Service } from '../../services/s3.service';
import { AuditChainService } from './auditChain.service';
import { requireEditableState, requireDeletableState } from './stateGuard.util';
import { AppError } from '../../middleware/error.middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadCreditDocumentData {
  applicationId?: string | null;
  borrowerProfileId: string;
  classification: DocumentClass;
  fileName: string;
  filePath: string;
  fileSize?: number | null;
  mimeType?: string | null;
  sha256Hash?: string | null;
  isAvClean?: boolean | null;
  uploadedById: string;
  description?: string | null;
}

export interface UpdateCreditDocumentData {
  classification?: DocumentClass;
  description?: string | null;
  /** @deprecated isAvClean must NOT be set via updateDocument — use updateAvStatus() instead */
  isAvClean?: boolean | null;
}

export interface ReplaceCreditDocumentData {
  fileName: string;
  filePath: string;
  fileSize?: number | null;
  mimeType?: string | null;
  sha256Hash?: string | null;
  changeSummary?: string | null;
}

export interface ListCreditDocumentsOptions {
  page?: number;
  limit?: number;
  applicationId?: string;
  borrowerProfileId?: string;
  classification?: DocumentClass;
  isAvClean?: boolean | null;
  search?: string;
}

export interface CreateDocumentRequirementData {
  applicationId: string;
  documentClass: DocumentClass;
  label: string;
  isMandatory?: boolean;
  sortOrder?: number;
}

export interface UpdateDocumentRequirementData {
  label?: string;
  isMandatory?: boolean;
  isCollected?: boolean;
  collectedDocId?: string | null;
  sortOrder?: number;
}

export interface ListDocumentRequirementsOptions {
  applicationId: string;
  page?: number;
  limit?: number;
  isMandatory?: boolean;
  isCollected?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute SHA-256 hex digest of a buffer (file contents).
 */
export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class CreditDocumentService {
  // ===========================================================================
  // Credit Document CRUD
  // ===========================================================================

  /**
   * List credit documents with pagination and filters.
   */
  async listDocuments(options: ListCreditDocumentsOptions) {
    const {
      page = 1,
      limit = 20,
      applicationId,
      borrowerProfileId,
      classification,
      isAvClean,
      search,
    } = options;

    const skip = (page - 1) * limit;

    const where: Prisma.CreditDocumentWhereInput = {
      deletedAt: null,
    };

    if (applicationId) {
      where.applicationId = applicationId;
    }
    if (borrowerProfileId) {
      where.borrowerProfileId = borrowerProfileId;
    }
    if (classification) {
      where.classification = classification;
    }
    if (isAvClean !== undefined && isAvClean !== null) {
      where.isAvClean = isAvClean;
    }
    if (search) {
      where.OR = [
        { fileName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [documents, total] = await Promise.all([
      prisma.creditDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          _count: { select: { versions: true } },
        },
      }),
      prisma.creditDocument.count({ where }),
    ]);

    return {
      documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single credit document by ID.
   */
  async getDocument(id: string) {
    return prisma.creditDocument.findFirst({
      where: { id, deletedAt: null },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        versions: { orderBy: { version: 'desc' } },
        application: { select: { id: true, applicationNo: true } },
        borrowerProfile: { select: { id: true } },
      },
    });
  }

  /**
   * Upload a new credit document and create its first version record.
   */
  async uploadDocument(data: UploadCreditDocumentData) {
    if (data.applicationId) {
      const app = await prisma.creditApplication.findUnique({
        where: { id: data.applicationId },
        select: { state: true },
      });
      if (!app) {
        throw new Error(`Application not found: ${data.applicationId}`);
      }
      requireEditableState(app.state, 'upload document');
    }

    const doc = await prisma.creditDocument.create({
      data: {
        applicationId: data.applicationId ?? undefined,
        borrowerProfileId: data.borrowerProfileId,
        classification: data.classification,
        fileName: data.fileName,
        filePath: data.filePath,
        fileSize: data.fileSize ?? null,
        mimeType: data.mimeType ?? null,
        sha256Hash: data.sha256Hash ?? null,
        isAvClean: data.isAvClean ?? null,
        uploadedById: data.uploadedById,
        description: data.description ?? null,
        versions: {
          create: {
            version: 1,
            filePath: data.filePath,
            fileName: data.fileName,
            fileSize: data.fileSize ?? null,
            sha256Hash: data.sha256Hash ?? null,
          },
        },
      },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        versions: { orderBy: { version: 'desc' } },
      },
    });

    // Emit audit event if document is linked to a credit application
    if (data.applicationId) {
      await AuditChainService.appendEvent(
        data.applicationId,
        'DOCUMENT_UPLOADED',
        data.uploadedById,
        'upload',
        undefined,
        'DOCUMENT_UPLOADED',
        { documentId: doc.id, fileName: data.fileName, classification: data.classification },
      );
    }

    return doc;
  }

  /**
   * Update metadata on a credit document (classification, description).
   * NOTE: isAvClean is intentionally excluded here — it must only be set
   * via the dedicated updateAvStatus() method called by the AV scan service.
   */
  async updateDocument(id: string, data: UpdateCreditDocumentData, actorId?: string) {
    const existing = await prisma.creditDocument.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return null;
    }

    if (existing.applicationId) {
      const app = await prisma.creditApplication.findUnique({
        where: { id: existing.applicationId },
        select: { state: true },
      });
      if (!app) {
        throw new Error(`Application not found: ${existing.applicationId}`);
      }
      requireEditableState(app.state, 'update document');
    }

    // Strip isAvClean — defense in depth: must not be settable via PATCH
    const { isAvClean, ...updateData } = data as any;

    const prismaData: Prisma.CreditDocumentUpdateInput = {};

    if (updateData.classification !== undefined) prismaData.classification = updateData.classification;
    if (updateData.description !== undefined) prismaData.description = updateData.description;

    const doc = await prisma.creditDocument.update({
      where: { id },
      data: prismaData,
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { versions: true } },
      },
    });

    // Emit audit event if document is linked to a credit application
    if (existing.applicationId) {
      await AuditChainService.appendEvent(
        existing.applicationId,
        'DOCUMENT_UPDATED',
        actorId ?? null,
        'update',
        undefined,
        'DOCUMENT_UPDATED',
        { documentId: id, fileName: existing.fileName },
      );
    }

    return doc;
  }

  /**
   * Soft-delete a credit document.
   * Emits a DOCUMENT_DELETED audit event when the document is linked to an application.
   */
  async deleteDocument(id: string, actorId?: string) {
    const existing = await prisma.creditDocument.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return null;
    }

    if (existing.applicationId) {
      const app = await prisma.creditApplication.findUnique({
        where: { id: existing.applicationId },
        select: { state: true },
      });
      if (!app) {
        throw new Error(`Application not found: ${existing.applicationId}`);
      }
      requireDeletableState(app.state, 'delete document');
    }

    const deleted = await prisma.creditDocument.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Emit audit event if the document is linked to a credit application
    if (existing.applicationId) {
      await AuditChainService.appendEvent(
        existing.applicationId,
        'DOCUMENT_DELETED',
        actorId ?? null,
        'delete',
        undefined,
        undefined,
        { documentId: existing.id, fileName: existing.fileName },
      );
    }

    return deleted;
  }

  // ===========================================================================
  // Document Versioning
  // ===========================================================================

  /**
   * Replace (re-upload) a document — creates a new version and updates the
   * current file pointer on the document.
   */
  async replaceDocument(id: string, data: ReplaceCreditDocumentData) {
    const existing = await prisma.creditDocument.findFirst({
      where: { id, deletedAt: null },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });

    if (!existing) {
      return null;
    }

    const currentMaxVersion = existing.versions.length > 0 ? existing.versions[0].version : 0;
    const nextVersion = currentMaxVersion + 1;

    // Create new version row and update the document's current file pointer
    const doc = await prisma.creditDocument.update({
      where: { id },
      data: {
        fileName: data.fileName,
        filePath: data.filePath,
        fileSize: data.fileSize ?? null,
        mimeType: data.mimeType ?? existing.mimeType,
        sha256Hash: data.sha256Hash ?? null,
        isAvClean: null, // reset AV scan status on replacement
        versions: {
          create: {
            version: nextVersion,
            filePath: data.filePath,
            fileName: data.fileName,
            fileSize: data.fileSize ?? null,
            sha256Hash: data.sha256Hash ?? null,
            changeSummary: data.changeSummary ?? null,
          },
        },
      },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        versions: { orderBy: { version: 'desc' } },
      },
    });

    return doc;
  }

  /**
   * List all versions for a document.
   */
  async listVersions(documentId: string) {
    const existing = await prisma.creditDocument.findFirst({
      where: { id: documentId, deletedAt: null },
    });

    if (!existing) {
      return null;
    }

    return prisma.creditDocumentVersion.findMany({
      where: { documentId },
      orderBy: { version: 'desc' },
    });
  }

  /**
   * Get a specific version of a document.
   */
  async getVersion(documentId: string, version: number) {
    return prisma.creditDocumentVersion.findFirst({
      where: { documentId, version },
    });
  }

  // ===========================================================================
  // SHA-256 Hash
  // ===========================================================================

  /**
   * Get the SHA-256 hash for a document (current version).
   */
  async getDocumentHash(id: string) {
    const doc = await prisma.creditDocument.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, sha256Hash: true, fileName: true, filePath: true },
    });

    return doc;
  }

  /**
   * Verify a document's SHA-256 hash against a provided buffer.
   * Returns true if the computed hash matches the stored hash.
   */
  async verifyDocumentHash(id: string, buffer: Buffer): Promise<{ match: boolean; storedHash: string | null; computedHash: string }> {
    const doc = await prisma.creditDocument.findFirst({
      where: { id, deletedAt: null },
      select: { sha256Hash: true },
    });

    if (!doc) {
      throw new Error('Document not found');
    }

    const computedHash = computeSha256(buffer);
    return {
      match: doc.sha256Hash === computedHash,
      storedHash: doc.sha256Hash,
      computedHash,
    };
  }

  // ===========================================================================
  // AV Scan Status
  // ===========================================================================

  /**
   * Update the AV scan status of a document.
   * Typically called by a webhook or background job after an AV scan completes.
   */
  async updateAvStatus(id: string, isAvClean: boolean, sha256Hash?: string) {
    const existing = await prisma.creditDocument.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return null;
    }

    const updateData: Prisma.CreditDocumentUpdateInput = {
      isAvClean,
    };

    if (sha256Hash !== undefined) {
      updateData.sha256Hash = sha256Hash;
    }

    return prisma.creditDocument.update({
      where: { id },
      data: updateData,
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  // ===========================================================================
  // Document Verification
  // ===========================================================================

  async verifyDocument(id: string, verifiedById: string) {
    const existing = await prisma.creditDocument.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return null;
    return prisma.creditDocument.update({
      where: { id },
      data: { verificationStatus: 'VERIFIED', verifiedById, verifiedAt: new Date(), rejectionReason: null },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  async rejectDocument(id: string, verifiedById: string, rejectionReason: string) {
    const existing = await prisma.creditDocument.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return null;
    return prisma.creditDocument.update({
      where: { id },
      data: { verificationStatus: 'REJECTED', verifiedById, verifiedAt: new Date(), rejectionReason },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  // ===========================================================================
  // Document Download (presigned URL via S3)
  // ===========================================================================

  /**
   * Generate a presigned download URL for the current file of a document.
   * Blocks downloads where isAvClean === false (virus scan failed).
   * Allows isAvClean === null (not yet scanned).
   * Audit-logs every successful download via AuditChainService.
   */
  async getDownloadUrl(id: string, userId: string): Promise<string | null> {
    const doc = await prisma.creditDocument.findFirst({
      where: { id, deletedAt: null },
      select: {
        filePath: true,
        fileName: true,
        mimeType: true,
        isAvClean: true,
        applicationId: true,
        borrowerProfileId: true,
      },
    });

    if (!doc) {
      return null;
    }

    // Block downloads of documents that failed virus scan
    if (doc.isAvClean === false) {
      throw new AppError('Document failed virus scan', 403);
    }

    const overrides: Record<string, string> = {
      'response-content-disposition': `attachment; filename="${doc.fileName}"`,
    };
    if (doc.mimeType) {
      overrides['response-content-type'] = doc.mimeType;
    }

    const url = await s3Service.getPresignedUrl(doc.filePath, 0.25, overrides);

    // Audit-log the download
    const scopeId = doc.applicationId ?? doc.borrowerProfileId;
    await AuditChainService.appendEvent(
      scopeId,
      'DOCUMENT_DOWNLOADED',
      userId,
      'DOWNLOAD',
      null,
      null,
      { docId: id, filename: doc.fileName },
    );

    return url;
  }

  /**
   * Generate a presigned download URL for a specific version of a document.
   * Blocks downloads where the parent document has isAvClean === false.
   * Allows isAvClean === null (not yet scanned).
   * Audit-logs every successful download via AuditChainService.
   */
  async getVersionDownloadUrl(documentId: string, version: number, userId: string): Promise<string | null> {
    // Fetch parent document to check AV status and get scope info
    const parentDoc = await prisma.creditDocument.findFirst({
      where: { id: documentId, deletedAt: null },
      select: { isAvClean: true, applicationId: true, borrowerProfileId: true },
    });

    if (!parentDoc) {
      return null;
    }

    // Block downloads of documents that failed virus scan
    if (parentDoc.isAvClean === false) {
      throw new AppError('Document failed virus scan', 403);
    }

    const ver = await prisma.creditDocumentVersion.findFirst({
      where: { documentId, version },
    });

    if (!ver) {
      return null;
    }

    const url = await s3Service.getPresignedUrl(ver.filePath, 0.25);

    // Audit-log the download
    const scopeId = parentDoc.applicationId ?? parentDoc.borrowerProfileId;
    await AuditChainService.appendEvent(
      scopeId,
      'DOCUMENT_DOWNLOADED',
      userId,
      'DOWNLOAD',
      null,
      null,
      { docId: documentId, version, filename: ver.fileName },
    );

    return url;
  }

  // ===========================================================================
  // Document Requirement Checklist
  // ===========================================================================

  /**
   * List document requirements for an application.
   * Enriches each requirement with its linked document info via a separate query,
   * since collectedDocId is a scalar FK without a Prisma relation.
   */
  async listRequirements(options: ListDocumentRequirementsOptions) {
    const { applicationId, page = 1, limit = 50, isMandatory, isCollected } = options;

    const skip = (page - 1) * limit;

    const where: Prisma.DocumentRequirementWhereInput = {
      applicationId,
    };

    if (isMandatory !== undefined) {
      where.isMandatory = isMandatory;
    }
    if (isCollected !== undefined) {
      where.isCollected = isCollected;
    }

    const [requirements, total] = await Promise.all([
      prisma.documentRequirement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.documentRequirement.count({ where }),
    ]);

    // Enrich with linked document metadata for requirements that have a collectedDocId
    const docIds = requirements
      .map((r) => r.collectedDocId)
      .filter((id): id is string => id !== null);

    const linkedDocs = docIds.length > 0
      ? await prisma.creditDocument.findMany({
          where: { id: { in: docIds } },
          select: { id: true, fileName: true, classification: true, isAvClean: true, sha256Hash: true },
        })
      : [];

    const docMap = new Map(linkedDocs.map((d) => [d.id, d]));

    const enriched = requirements.map((req) => ({
      ...req,
      linkedDoc: req.collectedDocId ? docMap.get(req.collectedDocId) ?? null : null,
    }));

    // Compute checklist progress
    const totalMandatory = await prisma.documentRequirement.count({
      where: { applicationId, isMandatory: true },
    });
    const collectedMandatory = await prisma.documentRequirement.count({
      where: { applicationId, isMandatory: true, isCollected: true },
    });

    return {
      requirements: enriched,
      progress: {
        totalMandatory,
        collectedMandatory,
        completionPct: totalMandatory > 0 ? Math.round((collectedMandatory / totalMandatory) * 100) : 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single document requirement.
   */
  async getRequirement(id: string) {
    const req = await prisma.documentRequirement.findUnique({
      where: { id },
    });

    if (!req) return null;

    // Enrich with linked document if available
    let linkedDoc = null;
    if (req.collectedDocId) {
      linkedDoc = await prisma.creditDocument.findUnique({
        where: { id: req.collectedDocId },
        select: { id: true, fileName: true, classification: true, isAvClean: true, sha256Hash: true },
      });
    }

    return { ...req, linkedDoc };
  }

  /**
   * Create a document requirement entry.
   */
  async createRequirement(data: CreateDocumentRequirementData) {
    return prisma.documentRequirement.create({
      data: {
        applicationId: data.applicationId,
        documentClass: data.documentClass,
        label: data.label,
        isMandatory: data.isMandatory ?? true,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  /**
   * Batch-create document requirements for an application (e.g., from a template).
   */
  async batchCreateRequirements(
    applicationId: string,
    items: Omit<CreateDocumentRequirementData, 'applicationId'>[],
  ) {
    const data = items.map((item, index) => ({
      applicationId,
      documentClass: item.documentClass,
      label: item.label,
      isMandatory: item.isMandatory ?? true,
      sortOrder: item.sortOrder ?? index,
    }));

    const result = await prisma.documentRequirement.createMany({
      data,
      skipDuplicates: true,
    });

    return result;
  }

  /**
   * Update a document requirement (e.g., mark as collected, link to uploaded doc).
   */
  async updateRequirement(id: string, data: UpdateDocumentRequirementData) {
    const existing = await prisma.documentRequirement.findUnique({
      where: { id },
    });

    if (!existing) {
      return null;
    }

    const updateData: Prisma.DocumentRequirementUpdateInput = {};

    if (data.label !== undefined) updateData.label = data.label;
    if (data.isMandatory !== undefined) updateData.isMandatory = data.isMandatory;
    if (data.isCollected !== undefined) updateData.isCollected = data.isCollected;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    if (data.collectedDocId !== undefined) {
      updateData.collectedDocId = data.collectedDocId ?? null;
      // Auto-set isCollected when linking a document
      if (data.collectedDocId && data.isCollected === undefined) {
        updateData.isCollected = true;
      }
    }

    const updated = await prisma.documentRequirement.update({
      where: { id },
      data: updateData,
    });

    // Enrich with linked document metadata
    let linkedDoc = null;
    if (updated.collectedDocId) {
      linkedDoc = await prisma.creditDocument.findUnique({
        where: { id: updated.collectedDocId },
        select: { id: true, fileName: true, classification: true, isAvClean: true, sha256Hash: true },
      });
    }

    return { ...updated, linkedDoc };
  }

  /**
   * Delete a document requirement.
   */
  async deleteRequirement(id: string) {
    const existing = await prisma.documentRequirement.findUnique({
      where: { id },
    });

    if (!existing) {
      return null;
    }

    return prisma.documentRequirement.delete({
      where: { id },
    });
  }

  /**
   * Get checklist summary for an application — how many mandatory documents
   * are collected vs outstanding.
   */
  async getChecklistSummary(applicationId: string) {
    const [totalMandatory, collectedMandatory, totalOptional, collectedOptional] =
      await Promise.all([
        prisma.documentRequirement.count({
          where: { applicationId, isMandatory: true },
        }),
        prisma.documentRequirement.count({
          where: { applicationId, isMandatory: true, isCollected: true },
        }),
        prisma.documentRequirement.count({
          where: { applicationId, isMandatory: false },
        }),
        prisma.documentRequirement.count({
          where: { applicationId, isMandatory: false, isCollected: true },
        }),
      ]);

    // Find outstanding mandatory requirements
    const outstanding = await prisma.documentRequirement.findMany({
      where: { applicationId, isMandatory: true, isCollected: false },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, documentClass: true, label: true, sortOrder: true },
    });

    return {
      mandatory: {
        total: totalMandatory,
        collected: collectedMandatory,
        outstanding: totalMandatory - collectedMandatory,
        completionPct: totalMandatory > 0 ? Math.round((collectedMandatory / totalMandatory) * 100) : 0,
      },
      optional: {
        total: totalOptional,
        collected: collectedOptional,
        outstanding: totalOptional - collectedOptional,
        completionPct: totalOptional > 0 ? Math.round((collectedOptional / totalOptional) * 100) : 0,
      },
      allMandatoryCollected: totalMandatory > 0 && collectedMandatory >= totalMandatory,
      outstandingItems: outstanding,
    };
  }
}

export const creditDocumentService = new CreditDocumentService();