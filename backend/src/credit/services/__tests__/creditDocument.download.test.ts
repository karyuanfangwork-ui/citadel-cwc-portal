/**
 * Tests for document download gating and audit logging (Task 11 — F10).
 * Covers:
 *   - AV-flagged documents are blocked (isAvClean === false → 403)
 *   - Unscanned documents are allowed (isAvClean === null)
 *   - Clean documents are allowed (isAvClean === true)
 *   - Successful downloads are audit-logged via AuditChainService
 *   - Version downloads also enforce AV gating and audit logging
 */

// Mock prisma
jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditDocument: {
      findFirst: jest.fn(),
    },
    creditDocumentVersion: {
      findFirst: jest.fn(),
    },
    creditAuditEvent: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Mock s3Service
jest.mock('../../../services/s3.service', () => ({
  s3Service: {
    getPresignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/presigned-url'),
  },
}));

// Mock AuditChainService.appendEvent
jest.mock('../auditChain.service', () => ({
  AuditChainService: {
    appendEvent: jest.fn().mockResolvedValue('audit-event-id'),
  },
}));

import prisma from '../../../utils/prisma';
import { s3Service } from '../../../services/s3.service';
import { AuditChainService } from '../auditChain.service';
import { creditDocumentService } from '../creditDocument.service';
import { AppError } from '../../../middleware/error.middleware';

const mockedDocFindFirst = prisma.creditDocument.findFirst as jest.Mock;
const mockedVersionFindFirst = prisma.creditDocumentVersion.findFirst as jest.Mock;
const mockedS3GetPresignedUrl = s3Service.getPresignedUrl as jest.Mock;
const mockedAppendEvent = AuditChainService.appendEvent as jest.Mock;

const cleanDoc = {
  filePath: '/uploads/doc.pdf',
  fileName: 'doc.pdf',
  mimeType: 'application/pdf',
  isAvClean: true,
  applicationId: 'app-1',
  borrowerProfileId: 'bp-1',
};

const flaggedDoc = {
  filePath: '/uploads/malware.exe',
  fileName: 'malware.exe',
  mimeType: 'application/x-msdos-program',
  isAvClean: false,
  applicationId: 'app-1',
  borrowerProfileId: 'bp-1',
};

const unscannedDoc = {
  filePath: '/uploads/unscanned.doc',
  fileName: 'unscanned.doc',
  mimeType: 'application/msword',
  isAvClean: null,
  applicationId: 'app-1',
  borrowerProfileId: 'bp-1',
};

const standaloneDoc = {
  filePath: '/uploads/standalone.pdf',
  fileName: 'standalone.pdf',
  mimeType: 'application/pdf',
  isAvClean: true,
  applicationId: null,
  borrowerProfileId: 'bp-2',
};

const versionRow = {
  id: 'ver-1',
  documentId: 'doc-1',
  version: 2,
  filePath: '/uploads/doc-v2.pdf',
  fileName: 'doc-v2.pdf',
};

describe('getDownloadUrl — AV gating and audit logging (F10)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedS3GetPresignedUrl.mockResolvedValue('https://s3.example.com/presigned-url');
  });

  it('returns null when document is not found', async () => {
    mockedDocFindFirst.mockResolvedValue(null);

    const result = await creditDocumentService.getDownloadUrl('nonexistent', 'user-1');

    expect(result).toBeNull();
    expect(mockedAppendEvent).not.toHaveBeenCalled();
  });

  it('throws 403 AppError when isAvClean === false', async () => {
    mockedDocFindFirst.mockResolvedValue(flaggedDoc);

    await expect(
      creditDocumentService.getDownloadUrl('doc-flagged', 'user-1'),
    ).rejects.toThrow(AppError);

    await expect(
      creditDocumentService.getDownloadUrl('doc-flagged', 'user-1'),
    ).rejects.toMatchObject({ statusCode: 403, message: 'Document failed virus scan' });

    expect(mockedS3GetPresignedUrl).not.toHaveBeenCalled();
    expect(mockedAppendEvent).not.toHaveBeenCalled();
  });

  it('allows download when isAvClean === true (clean)', async () => {
    mockedDocFindFirst.mockResolvedValue(cleanDoc);

    const result = await creditDocumentService.getDownloadUrl('doc-clean', 'user-1');

    expect(result).toBe('https://s3.example.com/presigned-url');
    expect(mockedS3GetPresignedUrl).toHaveBeenCalled();
    expect(mockedAppendEvent).toHaveBeenCalledWith(
      'app-1',
      'DOCUMENT_DOWNLOADED',
      'user-1',
      'DOWNLOAD',
      null,
      null,
      { docId: 'doc-clean', filename: 'doc.pdf' },
    );
  });

  it('allows download when isAvClean === null (unscanned)', async () => {
    mockedDocFindFirst.mockResolvedValue(unscannedDoc);

    const result = await creditDocumentService.getDownloadUrl('doc-unscanned', 'user-1');

    expect(result).toBe('https://s3.example.com/presigned-url');
    expect(mockedS3GetPresignedUrl).toHaveBeenCalled();
    expect(mockedAppendEvent).toHaveBeenCalledWith(
      'app-1',
      'DOCUMENT_DOWNLOADED',
      'user-1',
      'DOWNLOAD',
      null,
      null,
      { docId: 'doc-unscanned', filename: 'unscanned.doc' },
    );
  });

  it('uses borrowerProfileId as scope when applicationId is null', async () => {
    mockedDocFindFirst.mockResolvedValue(standaloneDoc);

    const result = await creditDocumentService.getDownloadUrl('doc-standalone', 'user-2');

    expect(result).toBe('https://s3.example.com/presigned-url');
    expect(mockedAppendEvent).toHaveBeenCalledWith(
      'bp-2',
      'DOCUMENT_DOWNLOADED',
      'user-2',
      'DOWNLOAD',
      null,
      null,
      { docId: 'doc-standalone', filename: 'standalone.pdf' },
    );
  });

  it('passes correct content-disposition and content-type overrides to S3', async () => {
    mockedDocFindFirst.mockResolvedValue(cleanDoc);

    await creditDocumentService.getDownloadUrl('doc-clean', 'user-1');

    const overrides = mockedS3GetPresignedUrl.mock.calls[0][2];
    expect(overrides['response-content-disposition']).toBe('attachment; filename="doc.pdf"');
    expect(overrides['response-content-type']).toBe('application/pdf');
  });
});

describe('getVersionDownloadUrl — AV gating and audit logging (F10)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedS3GetPresignedUrl.mockResolvedValue('https://s3.example.com/presigned-url');
  });

  it('returns null when parent document is not found', async () => {
    mockedDocFindFirst.mockResolvedValue(null);

    const result = await creditDocumentService.getVersionDownloadUrl('nonexistent', 2, 'user-1');

    expect(result).toBeNull();
    expect(mockedAppendEvent).not.toHaveBeenCalled();
  });

  it('returns null when version is not found (but parent doc exists)', async () => {
    mockedDocFindFirst.mockResolvedValue(cleanDoc);
    mockedVersionFindFirst.mockResolvedValue(null);

    const result = await creditDocumentService.getVersionDownloadUrl('doc-1', 99, 'user-1');

    expect(result).toBeNull();
    expect(mockedAppendEvent).not.toHaveBeenCalled();
  });

  it('throws 403 AppError when parent doc has isAvClean === false', async () => {
    mockedDocFindFirst.mockResolvedValue(flaggedDoc);

    await expect(
      creditDocumentService.getVersionDownloadUrl('doc-flagged', 1, 'user-1'),
    ).rejects.toThrow(AppError);

    await expect(
      creditDocumentService.getVersionDownloadUrl('doc-flagged', 1, 'user-1'),
    ).rejects.toMatchObject({ statusCode: 403, message: 'Document failed virus scan' });

    expect(mockedS3GetPresignedUrl).not.toHaveBeenCalled();
    expect(mockedAppendEvent).not.toHaveBeenCalled();
  });

  it('allows version download when parent doc isAvClean === true', async () => {
    mockedDocFindFirst.mockResolvedValue(cleanDoc);
    mockedVersionFindFirst.mockResolvedValue(versionRow);

    const result = await creditDocumentService.getVersionDownloadUrl('doc-1', 2, 'user-1');

    expect(result).toBe('https://s3.example.com/presigned-url');
    expect(mockedAppendEvent).toHaveBeenCalledWith(
      'app-1',
      'DOCUMENT_DOWNLOADED',
      'user-1',
      'DOWNLOAD',
      null,
      null,
      { docId: 'doc-1', version: 2, filename: 'doc-v2.pdf' },
    );
  });

  it('allows version download when parent doc isAvClean === null (unscanned)', async () => {
    mockedDocFindFirst.mockResolvedValue(unscannedDoc);
    mockedVersionFindFirst.mockResolvedValue(versionRow);

    const result = await creditDocumentService.getVersionDownloadUrl('doc-1', 2, 'user-1');

    expect(result).toBe('https://s3.example.com/presigned-url');
    expect(mockedAppendEvent).toHaveBeenCalled();
  });

  it('uses borrowerProfileId as scope when applicationId is null for version download', async () => {
    mockedDocFindFirst.mockResolvedValue(standaloneDoc);
    mockedVersionFindFirst.mockResolvedValue(versionRow);

    const result = await creditDocumentService.getVersionDownloadUrl('doc-s', 2, 'user-2');

    expect(result).toBe('https://s3.example.com/presigned-url');
    expect(mockedAppendEvent).toHaveBeenCalledWith(
      'bp-2',
      'DOCUMENT_DOWNLOADED',
      'user-2',
      'DOWNLOAD',
      null,
      null,
      { docId: 'doc-s', version: 2, filename: 'doc-v2.pdf' },
    );
  });
});