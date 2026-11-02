import { Readable } from 'stream';

const mockPrisma = {
  crmAccount: { findFirst: jest.fn() },
  crmAccountDocument: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};
const mockS3 = {
  uploadBuffer: jest.fn(),
  streamObject: jest.fn(),
  deleteObject: jest.fn(),
};

jest.mock('../../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../s3.service', () => ({ s3Service: mockS3 }));
jest.mock('../../utils/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } }));

import {
  deleteAccountDocument,
  getAccountDocumentStream,
  listAccountDocuments,
  MAX_ACCOUNT_DOCUMENT_SIZE,
  uploadAccountDocuments,
  validateAccountDocumentFile,
} from '../crm-account-document.service';

const pdf = (overrides: Partial<Express.Multer.File> = {}) => ({
  originalname: 'statement.pdf',
  mimetype: 'application/pdf',
  size: 8,
  buffer: Buffer.from('%PDF-1.7'),
  ...overrides,
});

const account = { id: 'account-1', tenantId: 'tenant-1' };
const document = {
  id: 'document-1', accountId: account.id, fileName: 'statement.pdf', mimeType: 'application/pdf',
  fileSize: 8, createdAt: new Date(), uploadedBy: { id: 'user-1', firstName: 'A', lastName: 'User', email: 'a@example.com' },
};

describe('crm-account-document.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.crmAccount.findFirst.mockResolvedValue(account);
    mockPrisma.crmAccountDocument.findFirst.mockResolvedValue(null);
    mockPrisma.crmAccountDocument.findMany.mockResolvedValue([]);
    mockPrisma.crmAccountDocument.count.mockResolvedValue(0);
    mockPrisma.crmAccountDocument.update.mockResolvedValue({});
    mockS3.uploadBuffer.mockResolvedValue(undefined);
    mockS3.deleteObject.mockResolvedValue(undefined);
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback({
      $executeRaw: jest.fn().mockResolvedValue(0),
      crmAccountDocument: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(document),
      },
    }));
  });

  it.each([
    ['invalid extension', { originalname: 'statement.txt' }, 'Only PDF'],
    ['invalid MIME type', { mimetype: 'text/plain' }, 'Only PDF'],
    ['invalid signature', { buffer: Buffer.from('not-a-pdf'), size: 9 }, 'not a valid PDF'],
    ['empty file', { buffer: Buffer.alloc(0), size: 0 }, 'empty'],
    ['oversized file', { buffer: Buffer.alloc(MAX_ACCOUNT_DOCUMENT_SIZE + 1), size: MAX_ACCOUNT_DOCUMENT_SIZE + 1 }, '10 MB'],
  ])('rejects %s', (_label, overrides, message) => {
    expect(() => validateAccountDocumentFile(pdf(overrides))).toThrow(message);
  });

  it('uploads a valid PDF to an opaque account key and persists only metadata', async () => {
    const result = await uploadAccountDocuments(account.id, 'user-1', [pdf()], ['user-1']);

    expect(result.documents).toEqual([document]);
    expect(mockS3.uploadBuffer).toHaveBeenCalledWith(expect.stringMatching(/^crm\/accounts\/account-1\/[0-9a-f-]+\.pdf$/), expect.any(Buffer), 'application/pdf');
  });

  it('does not persist metadata when the S3 upload fails', async () => {
    mockS3.uploadBuffer.mockRejectedValue(new Error('storage unavailable'));
    await expect(uploadAccountDocuments(account.id, 'user-1', [pdf()], null)).rejects.toThrow('storage unavailable');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('removes uploaded objects when database persistence fails', async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error('database unavailable'));
    await expect(uploadAccountDocuments(account.id, 'user-1', [pdf()], null)).rejects.toThrow('database unavailable');
    expect(mockS3.deleteObject).toHaveBeenCalledWith(expect.stringMatching(/^crm\/accounts\/account-1\//));
  });

  it('prevents duplicate content for the same active account', async () => {
    mockPrisma.crmAccountDocument.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(uploadAccountDocuments(account.id, 'user-1', [pdf()], null)).rejects.toThrow('already been uploaded');
    expect(mockS3.uploadBuffer).not.toHaveBeenCalled();
  });

  it('lists only active documents for the visible account tenant with pagination', async () => {
    mockPrisma.crmAccountDocument.findMany.mockResolvedValue([document]);
    mockPrisma.crmAccountDocument.count.mockResolvedValue(21);
    const result = await listAccountDocuments(account.id, ['user-1'], { page: 2, limit: 20, skip: 20 });

    expect(result.pagination).toEqual({ page: 2, limit: 20, total: 21, totalPages: 2 });
    expect(mockPrisma.crmAccountDocument.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { accountId: account.id, tenantId: account.tenantId, deletedAt: null }, skip: 20, take: 20,
    }));
  });

  it('returns a non-disclosing not-found response for an out-of-scope account', async () => {
    mockPrisma.crmAccount.findFirst.mockResolvedValue(null);
    await expect(listAccountDocuments(account.id, ['other-user'], { page: 1, limit: 20, skip: 0 })).rejects.toThrow('Account not found');
  });

  it('applies the authenticated tenant boundary before listing documents', async () => {
    await listAccountDocuments(account.id, null, { page: 1, limit: 20, skip: 0 }, 'tenant-1');
    expect(mockPrisma.crmAccount.findFirst).toHaveBeenCalledWith({
      where: { id: account.id, deletedAt: null, tenantId: 'tenant-1' },
      select: { id: true, tenantId: true },
    });
  });

  it('downloads only an active document belonging to the requested account and tenant', async () => {
    mockPrisma.crmAccountDocument.findFirst.mockResolvedValue({ id: document.id, fileName: document.fileName, fileSize: 8, storageKey: 'private-key' });
    mockS3.streamObject.mockResolvedValue(Readable.from('pdf'));
    const result = await getAccountDocumentStream(account.id, document.id, null);

    expect(result.document.id).toBe(document.id);
    expect(mockPrisma.crmAccountDocument.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: document.id, accountId: account.id, tenantId: account.tenantId, deletedAt: null },
    }));
  });

  it('denies download after soft deletion or for a cross-account document', async () => {
    mockPrisma.crmAccountDocument.findFirst.mockResolvedValue(null);
    await expect(getAccountDocumentStream(account.id, document.id, null)).rejects.toThrow('Document not found');
  });

  it('maps a missing storage object to a safe not-found response', async () => {
    mockPrisma.crmAccountDocument.findFirst.mockResolvedValue({ id: document.id, fileName: document.fileName, fileSize: 8, storageKey: 'missing-key' });
    mockS3.streamObject.mockRejectedValue({ name: 'NoSuchKey' });
    await expect(getAccountDocumentStream(account.id, document.id, null)).rejects.toThrow('Document not found');
  });

  it('soft-deletes metadata before removing the private object', async () => {
    mockPrisma.crmAccountDocument.findFirst.mockResolvedValue({ id: document.id, accountId: account.id, storageKey: 'private-key' });
    await deleteAccountDocument(account.id, document.id, null);
    expect(mockPrisma.crmAccountDocument.update).toHaveBeenCalledWith({ where: { id: document.id }, data: { deletedAt: expect.any(Date) } });
    expect(mockS3.deleteObject).toHaveBeenCalledWith('private-key');
  });
});
