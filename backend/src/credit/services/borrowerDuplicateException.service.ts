import crypto from 'node:crypto';
import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/error.middleware';
import { normalizeIdentity } from '../utils/identityNormalization';

export type DuplicateExceptionSegment = 'INDIVIDUAL' | 'SME' | 'CORPORATE';
export type DuplicateExceptionDecision = 'APPROVE' | 'REJECT';

const rawFingerprintKey = process.env.CREDIT_HMAC_KEY || process.env.JWT_SECRET;
if (!rawFingerprintKey) {
  throw new Error('CREDIT_HMAC_KEY or JWT_SECRET is required for duplicate exception fingerprints');
}
const fingerprintKey: string = rawFingerprintKey;

export function computeDuplicateIdentityFingerprint(segment: DuplicateExceptionSegment, identityValue: string): string {
  const canonical = `${segment}:${normalizeIdentity(identityValue)}`;
  return crypto.createHmac('sha256', fingerprintKey).update(canonical).digest('hex');
}

function safeException(exception: any) {
  return {
    id: exception.id,
    draftId: exception.draftId,
    requestedById: exception.requestedById,
    decidedById: exception.decidedById,
    matchedBorrowerId: exception.matchedBorrowerId,
    segment: exception.segment,
    category: exception.category,
    justification: exception.justification,
    supportingReference: exception.supportingReference,
    status: exception.status,
    decisionComment: exception.decisionComment,
    expiresAt: exception.expiresAt,
    decidedAt: exception.decidedAt,
    consumedAt: exception.consumedAt,
    createdAt: exception.createdAt,
    updatedAt: exception.updatedAt,
    identityFingerprintPrefix: exception.identityFingerprint?.slice(0, 12),
  };
}

function maskExceptionIdentifier(borrower: { nricPassport?: string | null; registrationNumber?: string | null }, segment: DuplicateExceptionSegment) {
  const value = segment === 'INDIVIDUAL' ? borrower.nricPassport : borrower.registrationNumber;
  if (!value) return null;
  return `${value.slice(0, 2)}${'•'.repeat(Math.max(0, value.length - 4))}${value.slice(-2)}`;
}

async function appendAudit(tx: any, action: string, actorId: string, resourceId: string, metadata: Record<string, unknown>) {
  await tx.auditLog.create({
    data: {
      userId: actorId,
      action,
      resourceType: 'BorrowerDuplicateException',
      resourceId,
      newValues: metadata,
    },
  });
}

export class BorrowerDuplicateExceptionService {
  async request(input: {
    draftId: string;
    requestedById: string;
    matchedBorrowerId: string;
    segment: DuplicateExceptionSegment;
    identityValue: string;
    category: string;
    justification: string;
    supportingReference?: string | null;
  }) {
    const identityFingerprint = computeDuplicateIdentityFingerprint(input.segment, input.identityValue);
    return prisma.$transaction(async (tx) => {
      const draft = await tx.creditApplicationDraft.findUnique({ where: { id: input.draftId }, select: { userId: true } });
      if (!draft) throw new AppError('Borrower draft not found', 404);
      if (draft.userId !== input.requestedById) throw new AppError('Borrower draft does not belong to requester', 403);
      const borrower = await tx.borrowerProfile.findFirst({ where: { id: input.matchedBorrowerId, deletedAt: null }, select: { id: true } });
      if (!borrower) throw new AppError('Matched borrower not found', 404);

      const existing = await tx.borrowerDuplicateException.findFirst({
        where: { draftId: input.draftId, identityFingerprint, status: { in: ['PENDING', 'APPROVED'] } },
        select: { id: true },
      });
      if (existing) throw new AppError('An active duplicate exception already exists for this draft identity', 409);

      const exception = await tx.borrowerDuplicateException.create({
        data: {
          draftId: input.draftId,
          requestedById: input.requestedById,
          matchedBorrowerId: input.matchedBorrowerId,
          segment: input.segment,
          identityFingerprint,
          category: input.category,
          justification: input.justification,
          supportingReference: input.supportingReference ?? undefined,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      await appendAudit(tx, 'BORROWER_DUPLICATE_EXCEPTION_REQUESTED', input.requestedById, exception.id, {
        exceptionId: exception.id,
        matchedBorrowerId: input.matchedBorrowerId,
        draftId: input.draftId,
        segment: input.segment,
        category: input.category,
        statusFrom: null,
        statusTo: 'PENDING',
        fingerprintPrefix: identityFingerprint.slice(0, 12),
      });
      return safeException(exception);
    });
  }

  async getById(id: string, actorId: string, canApprove: boolean) {
    const exception = await prisma.borrowerDuplicateException.findUnique({ where: { id } });
    if (!exception) throw new AppError('Duplicate exception not found', 404);
    if (!canApprove && exception.requestedById !== actorId) throw new AppError('Duplicate exception not found', 404);
    return safeException(exception);
  }

  async listPending(page = 1, limit = 25, branchId?: string | null) {
    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    const where = {
      status: 'PENDING' as const,
      ...(branchId !== undefined ? { requestedBy: { branchId } } : {}),
    };
    const [exceptions, total] = await Promise.all([
      prisma.borrowerDuplicateException.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        include: {
          requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          matchedBorrower: { select: { id: true, borrowerNumber: true, name: true, nricPassport: true, registrationNumber: true } },
        },
      }),
      prisma.borrowerDuplicateException.count({ where }),
    ]);
    return {
      items: exceptions.map((exception: any) => ({
        ...safeException(exception),
        requester: {
          id: exception.requestedBy.id,
          name: `${exception.requestedBy.firstName ?? ''} ${exception.requestedBy.lastName ?? ''}`.trim() || exception.requestedBy.email,
        },
        matchedBorrower: {
          id: exception.matchedBorrower.id,
          borrowerNumber: exception.matchedBorrower.borrowerNumber,
          name: exception.matchedBorrower.name,
          maskedIdentifier: maskExceptionIdentifier(exception.matchedBorrower, exception.segment),
        },
      })),
      pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) },
    };
  }

  async decide(id: string, actorId: string, decision: DuplicateExceptionDecision, comment?: string) {
    return prisma.$transaction(async (tx) => {
      const exception = await tx.borrowerDuplicateException.findUnique({ where: { id } });
      if (!exception) throw new AppError('Duplicate exception not found', 404);
      if (decision === 'APPROVE' && exception.requestedById === actorId) {
        throw new AppError('The requester cannot approve their own duplicate exception', 403);
      }
      if (exception.status !== 'PENDING') throw new AppError('Only pending duplicate exceptions can be decided', 409);
      if (exception.expiresAt && exception.expiresAt <= new Date()) {
        await tx.borrowerDuplicateException.update({ where: { id }, data: { status: 'EXPIRED' } });
        throw new AppError('Duplicate exception request has expired', 409);
      }

      const status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      const updated = await tx.borrowerDuplicateException.update({
        where: { id },
        data: {
          status,
          decidedById: actorId,
          decisionComment: comment ?? null,
          decidedAt: new Date(),
          expiresAt: decision === 'APPROVE' ? new Date(Date.now() + 24 * 60 * 60 * 1000) : exception.expiresAt,
        },
      });
      await appendAudit(tx, decision === 'APPROVE' ? 'BORROWER_DUPLICATE_EXCEPTION_APPROVED' : 'BORROWER_DUPLICATE_EXCEPTION_REJECTED', actorId, id, {
        exceptionId: id,
        matchedBorrowerId: exception.matchedBorrowerId,
        segment: exception.segment,
        category: exception.category,
        statusFrom: 'PENDING',
        statusTo: status,
        fingerprintPrefix: exception.identityFingerprint.slice(0, 12),
      });
      return safeException(updated);
    });
  }

  async consumeApproved(tx: any, input: { id: string; requesterId: string; matchedBorrowerId: string; segment: DuplicateExceptionSegment; identityValue: string }) {
    const fingerprint = computeDuplicateIdentityFingerprint(input.segment, input.identityValue);
    const exception = await tx.borrowerDuplicateException.findUnique({ where: { id: input.id } });
    if (!exception) throw new AppError('Duplicate exception not found', 404);
    if (exception.status !== 'APPROVED') throw new AppError('Duplicate exception is not approved or has already been consumed', 409);
    if (exception.expiresAt && exception.expiresAt <= new Date()) {
      await tx.borrowerDuplicateException.update({ where: { id: input.id }, data: { status: 'EXPIRED' } });
      throw new AppError('Duplicate exception approval has expired', 409);
    }
    if (exception.requestedById !== input.requesterId || exception.matchedBorrowerId !== input.matchedBorrowerId || exception.segment !== input.segment || exception.identityFingerprint !== fingerprint) {
      throw new AppError('Duplicate exception does not match this borrower draft', 409);
    }
    const consumed = await tx.borrowerDuplicateException.updateMany({
      where: { id: input.id, status: 'APPROVED', consumedAt: null },
      data: { status: 'CONSUMED', consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw new AppError('Duplicate exception approval was already consumed', 409);
    await appendAudit(tx, 'BORROWER_DUPLICATE_EXCEPTION_CONSUMED', input.requesterId, input.id, {
      exceptionId: input.id,
      matchedBorrowerId: input.matchedBorrowerId,
      segment: input.segment,
      statusFrom: 'APPROVED',
      statusTo: 'CONSUMED',
      fingerprintPrefix: fingerprint.slice(0, 12),
    });
  }
}

export const borrowerDuplicateExceptionService = new BorrowerDuplicateExceptionService();
