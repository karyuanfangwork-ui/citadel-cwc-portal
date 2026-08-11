import crypto from 'crypto';
import path from 'path';
import { Readable } from 'stream';
import { AppError } from '../middleware/error.middleware';
import { isPdf } from '../utils/file-signature';
import { s3Service } from './s3.service';
import prisma from '../utils/prisma';
import { applyOwnerScope } from './crm-scope.service';

export const MAX_LEAD_DOCUMENTS = 5;
export const MAX_LEAD_DOCUMENT_SIZE = 10 * 1024 * 1024;

const documentSelect = {
  id: true,
  leadId: true,
  fileName: true,
  mimeType: true,
  fileSize: true,
  scanStatus: true,
  scanCompletedAt: true,
  createdAt: true,
  uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;

export type LeadDocumentFile = Pick<Express.Multer.File, 'originalname' | 'mimetype' | 'size' | 'buffer'>;

function publicDocument(document: any) {
  return document;
}

function validatePdf(file: LeadDocumentFile): void {
  if (file.mimetype !== 'application/pdf' || path.extname(file.originalname).toLowerCase() !== '.pdf') {
    throw new AppError(`Only PDF documents are allowed: ${file.originalname}`, 400);
  }
  if (file.size > MAX_LEAD_DOCUMENT_SIZE) {
    throw new AppError(`Document exceeds the ${MAX_LEAD_DOCUMENT_SIZE / 1024 / 1024} MB limit: ${file.originalname}`, 400);
  }
  if (!isPdf(file.buffer)) {
    throw new AppError(`Uploaded file is not a valid PDF: ${file.originalname}`, 400);
  }
}

async function visibleLead(leadId: string, visibleOwnerIds: string[] | null) {
  const lead = await prisma.crmLead.findFirst({
    where: applyOwnerScope({ id: leadId, deletedAt: null }, visibleOwnerIds),
    select: { id: true, tenantId: true },
  });
  if (!lead) throw new AppError('Lead not found', 404);
  return lead;
}

export async function listLeadDocuments(leadId: string, visibleOwnerIds: string[] | null) {
  await visibleLead(leadId, visibleOwnerIds);
  const documents = await prisma.crmLeadDocument.findMany({
    where: { leadId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: documentSelect,
  });
  return { documents: documents.map(publicDocument), count: documents.length, maxCount: MAX_LEAD_DOCUMENTS };
}

export async function uploadLeadDocuments(
  leadId: string,
  userId: string,
  files: LeadDocumentFile[],
  visibleOwnerIds: string[] | null,
) {
  if (!files.length) throw new AppError('At least one PDF document is required', 400);
  if (files.length > MAX_LEAD_DOCUMENTS) throw new AppError(`You can upload a maximum of ${MAX_LEAD_DOCUMENTS} documents at once`, 400);
  files.forEach(validatePdf);

  const lead = await visibleLead(leadId, visibleOwnerIds);
  const uploadedKeys: string[] = [];
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`crm-lead-documents:${leadId}`}))`;
      const existingCount = await tx.crmLeadDocument.count({ where: { leadId, deletedAt: null } });
      if (existingCount + files.length > MAX_LEAD_DOCUMENTS) {
        throw new AppError(`A lead can have a maximum of ${MAX_LEAD_DOCUMENTS} documents`, 409);
      }

      const created = [];
      for (const file of files) {
        const storageKey = `crm/leads/${leadId}/${crypto.randomUUID()}.pdf`;
        uploadedKeys.push(storageKey);
        await s3Service.uploadBuffer(storageKey, file.buffer, 'application/pdf');
        const document = await tx.crmLeadDocument.create({
          data: {
            tenantId: lead.tenantId,
            leadId,
            uploadedById: userId,
            fileName: path.basename(file.originalname).slice(0, 255),
            storageKey,
            mimeType: 'application/pdf',
            fileSize: file.size,
            contentHash: crypto.createHash('sha256').update(file.buffer).digest('hex'),
            scanStatus: 'PENDING',
          },
          select: documentSelect,
        });
        created.push(document);
      }
      return created;
    });
    return { documents: result.map(publicDocument), count: (await listLeadDocuments(leadId, visibleOwnerIds)).count, maxCount: MAX_LEAD_DOCUMENTS };
  } catch (error) {
    await Promise.allSettled(uploadedKeys.map((key) => s3Service.deleteObject(key)));
    throw error;
  }
}

export async function getLeadDocumentDownloadUrl(
  leadId: string,
  documentId: string,
  visibleOwnerIds: string[] | null,
): Promise<string> {
  await visibleLead(leadId, visibleOwnerIds);
  const document = await prisma.crmLeadDocument.findFirst({
    where: { id: documentId, leadId, deletedAt: null, scanStatus: { not: 'INFECTED' } },
  });
  if (!document) throw new AppError('Document not found', 404);
  return s3Service.getPresignedUrl(document.storageKey, 0.25, { 'response-content-type': 'application/pdf' });
}

export async function getLeadDocumentStream(
  leadId: string,
  documentId: string,
  visibleOwnerIds: string[] | null,
): Promise<{ document: { fileName: string; fileSize: number }; stream: Readable }> {
  await visibleLead(leadId, visibleOwnerIds);
  const document = await prisma.crmLeadDocument.findFirst({
    where: { id: documentId, leadId, deletedAt: null, scanStatus: { not: 'INFECTED' } },
    select: { fileName: true, fileSize: true, storageKey: true },
  });
  if (!document) throw new AppError('Document not found', 404);
  return { document, stream: await s3Service.streamObject(document.storageKey) };
}

export async function deleteLeadDocument(
  leadId: string,
  documentId: string,
  visibleOwnerIds: string[] | null,
) {
  await visibleLead(leadId, visibleOwnerIds);
  const document = await prisma.crmLeadDocument.findFirst({ where: { id: documentId, leadId, deletedAt: null } });
  if (!document) throw new AppError('Document not found', 404);
  await prisma.crmLeadDocument.update({ where: { id: document.id }, data: { deletedAt: new Date() } });
  await s3Service.deleteObject(document.storageKey).catch(() => undefined);
  return document;
}
