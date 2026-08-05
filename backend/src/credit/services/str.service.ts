import prisma from '../../utils/prisma';
import { StrStatus } from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CreateStrData {
  applicationId?: string;
  subjectName: string;
  subjectIdType?: string;
  subjectIdNumber?: string;
  grounds: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH';
  assignedToId?: string;
  amlRescreenEventId?: string;
  notes?: string;
}

export interface UpdateStrData {
  subjectName?: string;
  subjectIdType?: string;
  subjectIdNumber?: string;
  grounds?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH';
  assignedToId?: string;
  notes?: string;
}

export interface FileStrData {
  filingReference: string;
  filingDate?: Date;
}

export interface ListStrFilters {
  status?: StrStatus;
  severity?: string;
  applicationId?: string;
  page?: number;
  limit?: number;
}

// ── Service ────────────────────────────────────────────────────────────────

class StrService {
  /** Create a draft STR */
  async createStr(data: CreateStrData) {
    const str = await prisma.suspiciousTransaction.create({
      data: {
        applicationId: data.applicationId ?? null,
        subjectName: data.subjectName,
        subjectIdType: data.subjectIdType ?? null,
        subjectIdNumber: data.subjectIdNumber ?? null,
        grounds: data.grounds,
        severity: data.severity ?? null,
        assignedToId: data.assignedToId ?? null,
        amlRescreenEventId: data.amlRescreenEventId ?? null,
        notes: data.notes ?? null,
        status: 'DRAFT',
      },
    });
    logger.info('STR created', { strId: str.id, subjectName: data.subjectName });
    return str;
  }

  /** Update a draft or under-review STR */
  async updateStr(id: string, data: UpdateStrData) {
    const existing = await prisma.suspiciousTransaction.findUnique({ where: { id } });
    if (!existing) throw new AppError('STR not found', 404);
    if (existing.status === 'FILED' || existing.status === 'ACKNOWLEDGED' || existing.status === 'CLOSED') {
      throw new AppError('Cannot modify STR after filing', 400);
    }

    return prisma.suspiciousTransaction.update({
      where: { id },
      data: {
        ...(data.subjectName !== undefined && { subjectName: data.subjectName }),
        ...(data.subjectIdType !== undefined && { subjectIdType: data.subjectIdType }),
        ...(data.subjectIdNumber !== undefined && { subjectIdNumber: data.subjectIdNumber }),
        ...(data.grounds !== undefined && { grounds: data.grounds }),
        ...(data.severity !== undefined && { severity: data.severity }),
        ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });
  }

  /** File STR with authority — transitions DRAFT/UNDER_REVIEW → FILED */
  async fileStr(id: string, data: FileStrData) {
    const existing = await prisma.suspiciousTransaction.findUnique({ where: { id } });
    if (!existing) throw new AppError('STR not found', 404);
    if (existing.status === 'FILED' || existing.status === 'ACKNOWLEDGED' || existing.status === 'CLOSED') {
      throw new AppError('STR already filed', 400);
    }

    const filed = await prisma.suspiciousTransaction.update({
      where: { id },
      data: {
        status: 'FILED',
        filingReference: data.filingReference,
        filingDate: data.filingDate ?? new Date(),
      },
    });
    logger.info('STR filed with authority', { strId: id, filingReference: data.filingReference });
    return filed;
  }

  /** Acknowledge STR — FILED → ACKNOWLEDGED */
  async acknowledgeStr(id: string, reviewedById: string) {
    const existing = await prisma.suspiciousTransaction.findUnique({ where: { id } });
    if (!existing) throw new AppError('STR not found', 404);
    if (existing.status !== 'FILED') {
      throw new AppError('Only FILED STRs can be acknowledged', 400);
    }

    return prisma.suspiciousTransaction.update({
      where: { id },
      data: {
        status: 'ACKNOWLEDGED',
        reviewedById,
        reviewedAt: new Date(),
      },
    });
  }

  /** Close STR — any status → CLOSED */
  async closeStr(id: string, reason: string) {
    const existing = await prisma.suspiciousTransaction.findUnique({ where: { id } });
    if (!existing) throw new AppError('STR not found', 404);
    if (existing.status === 'CLOSED') {
      throw new AppError('STR already closed', 400);
    }

    return prisma.suspiciousTransaction.update({
      where: { id },
      data: {
        status: 'CLOSED',
        notes: existing.notes
          ? `${existing.notes}\n[CLOSED] ${reason}`
          : `[CLOSED] ${reason}`,
      },
    });
  }

  /** Transition to UNDER_REVIEW — DRAFT → UNDER_REVIEW */
  async submitForReview(id: string) {
    const existing = await prisma.suspiciousTransaction.findUnique({ where: { id } });
    if (!existing) throw new AppError('STR not found', 404);
    if (existing.status !== 'DRAFT') {
      throw new AppError('Only DRAFT STRs can be submitted for review', 400);
    }

    return prisma.suspiciousTransaction.update({
      where: { id },
      data: { status: 'UNDER_REVIEW' },
    });
  }

  /** Get a single STR */
  async getStr(id: string) {
    const str = await prisma.suspiciousTransaction.findUnique({
      where: { id },
      include: {
        application: { select: { id: true, applicationNo: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        amlRescreenEvent: { select: { id: true, outcome: true, actionTaken: true } },
        attachments: true,
      },
    });
    if (!str) throw new AppError('STR not found', 404);
    return str;
  }

  /** List STRs with filters */
  async listStrs(filters: ListStrFilters) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.severity) where.severity = filters.severity;
    if (filters.applicationId) where.applicationId = filters.applicationId;

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.suspiciousTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.suspiciousTransaction.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  /** Link STR to an AML rescreen event */
  async linkAmlRescreenEvent(strId: string, eventId: string) {
    const existing = await prisma.suspiciousTransaction.findUnique({ where: { id: strId } });
    if (!existing) throw new AppError('STR not found', 404);

    return prisma.suspiciousTransaction.update({
      where: { id: strId },
      data: { amlRescreenEventId: eventId },
    });
  }

  /** Add attachment to STR */
  async addAttachment(strId: string, data: { fileName: string; fileUrl: string; documentId?: string; uploadedById?: string }) {
    const existing = await prisma.suspiciousTransaction.findUnique({ where: { id: strId } });
    if (!existing) throw new AppError('STR not found', 404);

    return prisma.strAttachment.create({
      data: {
        strId,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        documentId: data.documentId ?? null,
        uploadedById: data.uploadedById ?? null,
      },
    });
  }
}

export const strService = new StrService();