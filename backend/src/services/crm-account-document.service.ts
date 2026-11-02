import crypto from 'crypto';
import path from 'path';
import { Readable } from 'stream';
import { AppError } from '../middleware/error.middleware';
import { isPdf } from '../utils/file-signature';
import { logger } from '../utils/logger';
import prisma from '../utils/prisma';
import { applyOwnerScope } from './crm-scope.service';
import { s3Service } from './s3.service';

export const MAX_ACCOUNT_DOCUMENT_SIZE = 10 * 1024 * 1024;
export const MAX_ACCOUNT_DOCUMENTS_PER_UPLOAD = 5;

export type AccountDocumentFile = Pick<Express.Multer.File, 'originalname' | 'mimetype' | 'size' | 'buffer'>;

const documentSelect = {
  id: true,
  accountId: true,
  fileName: true,
  mimeType: true,
  fileSize: true,
  createdAt: true,
  uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;

export function validateAccountDocumentFile(file: AccountDocumentFile): void {
  if (!file.size || !file.buffer.length) {
    throw new AppError(`Document is empty: ${file.originalname}`, 400);
  }
  if (file.mimetype !== 'application/pdf' || path.extname(file.originalname).toLowerCase() !== '.pdf') {
    throw new AppError(`Only PDF documents are allowed: ${file.originalname}`, 400);
  }
  if (file.size > MAX_ACCOUNT_DOCUMENT_SIZE || file.buffer.length > MAX_ACCOUNT_DOCUMENT_SIZE) {
    throw new AppError(`Document exceeds the 10 MB limit: ${file.originalname}`, 400);
  }
  if (!isPdf(file.buffer)) {
    throw new AppError(`Uploaded file is not a valid PDF: ${file.originalname}`, 400);
  }
}

function sanitizeFileName(fileName: string): string {
  const sanitized = path.basename(fileName).replace(/[\x00-\x1f\x7f"\\/]/g, '_').trim();
  return (sanitized || 'document.pdf').slice(0, 255);
}

async function visibleAccount(accountId: string, visibleOwnerIds: string[] | null, actorTenantId: string | null = null) {
  const account = await prisma.crmAccount.findFirst({
    where: applyOwnerScope({
      id: accountId,
      deletedAt: null,
      ...(actorTenantId ? { tenantId: actorTenantId } : {}),
    }, visibleOwnerIds),
    select: { id: true, tenantId: true },
  });
  if (!account) throw new AppError('Account not found', 404);
  return account;
}

export async function listAccountDocuments(
  accountId: string,
  visibleOwnerIds: string[] | null,
  pagination: { page: number; limit: number; skip: number },
  actorTenantId: string | null = null,
) {
  const account = await visibleAccount(accountId, visibleOwnerIds, actorTenantId);
  const where = { accountId, tenantId: account.tenantId, deletedAt: null };
  const [documents, total] = await Promise.all([
    prisma.crmAccountDocument.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: pagination.skip,
      take: pagination.limit,
      select: documentSelect,
    }),
    prisma.crmAccountDocument.count({ where }),
  ]);
  return {
    documents,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
}

export async function uploadAccountDocuments(
  accountId: string,
  userId: string,
  files: AccountDocumentFile[],
  visibleOwnerIds: string[] | null,
  actorTenantId: string | null = null,
) {
  if (!files.length) throw new AppError('At least one PDF document is required', 400);
  if (files.length > MAX_ACCOUNT_DOCUMENTS_PER_UPLOAD) {
    throw new AppError(`You can upload a maximum of ${MAX_ACCOUNT_DOCUMENTS_PER_UPLOAD} documents at once`, 400);
  }
  files.forEach(validateAccountDocumentFile);

  const account = await visibleAccount(accountId, visibleOwnerIds, actorTenantId);
  const prepared = files.map((file) => ({
    file,
    fileName: sanitizeFileName(file.originalname),
    contentHash: crypto.createHash('sha256').update(file.buffer).digest('hex'),
    storageKey: `crm/accounts/${accountId}/${crypto.randomUUID()}.pdf`,
  }));
  if (new Set(prepared.map((item) => item.contentHash)).size !== prepared.length) {
    throw new AppError('The same document was selected more than once', 409);
  }

  const existing = await prisma.crmAccountDocument.findFirst({
    where: {
      accountId,
      tenantId: account.tenantId,
      deletedAt: null,
      contentHash: { in: prepared.map((item) => item.contentHash) },
    },
    select: { id: true },
  });
  if (existing) throw new AppError('This document has already been uploaded to the account', 409);

  const uploadedKeys: string[] = [];
  try {
    for (const item of prepared) {
      await s3Service.uploadBuffer(item.storageKey, item.file.buffer, 'application/pdf');
      uploadedKeys.push(item.storageKey);
    }

    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`crm-account-documents:${accountId}`}))`;
      const duplicate = await tx.crmAccountDocument.findFirst({
        where: {
          accountId,
          tenantId: account.tenantId,
          deletedAt: null,
          contentHash: { in: prepared.map((item) => item.contentHash) },
        },
        select: { id: true },
      });
      if (duplicate) throw new AppError('This document has already been uploaded to the account', 409);

      const documents = [];
      for (const item of prepared) {
        documents.push(await tx.crmAccountDocument.create({
          data: {
            tenantId: account.tenantId,
            accountId,
            uploadedById: userId,
            fileName: item.fileName,
            storageKey: item.storageKey,
            mimeType: 'application/pdf',
            fileSize: item.file.size,
            contentHash: item.contentHash,
          },
          select: documentSelect,
        }));
      }
      return { documents };
    });
  } catch (error) {
    await Promise.allSettled(uploadedKeys.map((key) => s3Service.deleteObject(key)));
    throw error;
  }
}

export async function getAccountDocumentStream(
  accountId: string,
  documentId: string,
  visibleOwnerIds: string[] | null,
  actorTenantId: string | null = null,
): Promise<{ document: { id: string; fileName: string; fileSize: number }; stream: Readable }> {
  const account = await visibleAccount(accountId, visibleOwnerIds, actorTenantId);
  const document = await prisma.crmAccountDocument.findFirst({
    where: { id: documentId, accountId, tenantId: account.tenantId, deletedAt: null },
    select: { id: true, fileName: true, fileSize: true, storageKey: true },
  });
  if (!document) throw new AppError('Document not found', 404);
  try {
    const stream = await s3Service.streamObject(document.storageKey);
    return { document, stream };
  } catch (error: any) {
    logger.warn('CRM account document storage object could not be read', { documentId, accountId, errorName: error?.name });
    if (error?.name === 'NoSuchKey' || error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404) {
      throw new AppError('Document not found', 404);
    }
    throw new AppError('Document is temporarily unavailable', 502);
  }
}

export async function deleteAccountDocument(
  accountId: string,
  documentId: string,
  visibleOwnerIds: string[] | null,
  actorTenantId: string | null = null,
) {
  const account = await visibleAccount(accountId, visibleOwnerIds, actorTenantId);
  const document = await prisma.crmAccountDocument.findFirst({
    where: { id: documentId, accountId, tenantId: account.tenantId, deletedAt: null },
    select: { id: true, accountId: true, storageKey: true },
  });
  if (!document) throw new AppError('Document not found', 404);
  await prisma.crmAccountDocument.update({ where: { id: document.id }, data: { deletedAt: new Date() } });
  try {
    await s3Service.deleteObject(document.storageKey);
  } catch (error: any) {
    logger.warn('Soft-deleted CRM account document object could not be removed', {
      documentId,
      accountId,
      errorName: error?.name,
    });
  }
  return { id: document.id, accountId: document.accountId };
}
