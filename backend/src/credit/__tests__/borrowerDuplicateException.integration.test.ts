jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    creditApplicationDraft: { findUnique: jest.fn() },
    borrowerProfile: { findFirst: jest.fn() },
    borrowerDuplicateException: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    auditLog: { create: jest.fn() },
  },
}));

import prisma from '../../utils/prisma';
import {
  borrowerDuplicateExceptionService,
  computeDuplicateIdentityFingerprint,
} from '../services/borrowerDuplicateException.service';

const db = prisma as any;
const pending = {
  id: '00000000-0000-0000-0000-000000000001',
  draftId: '00000000-0000-0000-0000-000000000002',
  requestedById: '00000000-0000-0000-0000-000000000003',
  decidedById: null,
  matchedBorrowerId: '00000000-0000-0000-0000-000000000004',
  segment: 'INDIVIDUAL',
  identityFingerprint: computeDuplicateIdentityFingerprint('INDIVIDUAL', '900101-10-1234'),
  category: 'DISTINCT PERSON',
  justification: 'Manual KYC review confirms this is a distinct person.',
  supportingReference: null,
  status: 'PENDING',
  decisionComment: null,
  expiresAt: new Date(Date.now() + 86_400_000),
  decidedAt: null,
  consumedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
  db.$transaction.mockImplementation(async (callback: any) => callback(db));
  db.auditLog.create.mockResolvedValue({ id: 'audit-1' });
});

describe('borrower duplicate exception governance', () => {
  it('stores only an HMAC fingerprint and allows a create-permission request', async () => {
    db.creditApplicationDraft.findUnique.mockResolvedValue({ userId: pending.requestedById });
    db.borrowerProfile.findFirst.mockResolvedValue({ id: pending.matchedBorrowerId });
    db.borrowerDuplicateException.findFirst.mockResolvedValue(null);
    db.borrowerDuplicateException.create.mockResolvedValue(pending);

    const result = await borrowerDuplicateExceptionService.request({
      draftId: pending.draftId,
      requestedById: pending.requestedById,
      matchedBorrowerId: pending.matchedBorrowerId,
      segment: 'INDIVIDUAL',
      identityValue: '900101-10-1234',
      category: 'DISTINCT PERSON',
      justification: pending.justification,
    });

    expect(result.identityFingerprintPrefix).toHaveLength(12);
    const createData = db.borrowerDuplicateException.create.mock.calls[0][0].data;
    expect(createData.identityFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(createData)).not.toContain('900101-10-1234');
  });

  it('blocks requester self-approval', async () => {
    db.borrowerDuplicateException.findUnique.mockResolvedValue(pending);
    await expect(
      borrowerDuplicateExceptionService.decide(pending.id, pending.requestedById, 'APPROVE'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects missing and foreign drafts before creating an exception', async () => {
    const input = {
      draftId: pending.draftId,
      requestedById: pending.requestedById,
      matchedBorrowerId: pending.matchedBorrowerId,
      segment: 'INDIVIDUAL' as const,
      identityValue: '900101-10-1234',
      category: 'DISTINCT PERSON',
      justification: pending.justification,
    };
    db.creditApplicationDraft.findUnique.mockResolvedValue(null);
    await expect(borrowerDuplicateExceptionService.request(input)).rejects.toMatchObject({ statusCode: 404 });
    db.creditApplicationDraft.findUnique.mockResolvedValue({ userId: '00000000-0000-0000-0000-000000000099' });
    await expect(borrowerDuplicateExceptionService.request(input)).rejects.toMatchObject({ statusCode: 403 });
    expect(db.borrowerDuplicateException.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate active exceptions for the same draft identity', async () => {
    db.creditApplicationDraft.findUnique.mockResolvedValue({ userId: pending.requestedById });
    db.borrowerProfile.findFirst.mockResolvedValue({ id: pending.matchedBorrowerId });
    db.borrowerDuplicateException.findFirst.mockResolvedValue({ id: pending.id });
    await expect(borrowerDuplicateExceptionService.request({
      draftId: pending.draftId,
      requestedById: pending.requestedById,
      matchedBorrowerId: pending.matchedBorrowerId,
      segment: 'INDIVIDUAL',
      identityValue: '900101-10-1234',
      category: 'DISTINCT PERSON',
      justification: pending.justification,
    })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('requires an approved, unexpired, matching exception for consumption', async () => {
    const approved = { ...pending, status: 'APPROVED', decidedById: '00000000-0000-0000-0000-000000000005' };
    db.borrowerDuplicateException.findUnique.mockResolvedValue(approved);
    db.borrowerDuplicateException.updateMany.mockResolvedValue({ count: 1 });

    await borrowerDuplicateExceptionService.consumeApproved(db, {
      id: approved.id,
      requesterId: approved.requestedById,
      matchedBorrowerId: approved.matchedBorrowerId,
      segment: approved.segment,
      identityValue: '900101-10-1234',
    });

    expect(db.borrowerDuplicateException.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'APPROVED', consumedAt: null }),
      data: expect.objectContaining({ status: 'CONSUMED' }),
    }));
    expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'BORROWER_DUPLICATE_EXCEPTION_CONSUMED' }),
    }));
  });

  it('rejects a mismatched identity fingerprint without consuming', async () => {
    const approved = { ...pending, status: 'APPROVED' };
    db.borrowerDuplicateException.findUnique.mockResolvedValue(approved);
    await expect(
      borrowerDuplicateExceptionService.consumeApproved(db, {
        id: approved.id,
        requesterId: approved.requestedById,
        matchedBorrowerId: approved.matchedBorrowerId,
        segment: 'INDIVIDUAL',
        identityValue: '900101-10-9999',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.borrowerDuplicateException.updateMany).not.toHaveBeenCalled();
  });

  it('rejects expired approvals', async () => {
    db.borrowerDuplicateException.findUnique.mockResolvedValue({ ...pending, status: 'APPROVED', expiresAt: new Date(Date.now() - 1) });
    await expect(
      borrowerDuplicateExceptionService.consumeApproved(db, {
        id: pending.id,
        requesterId: pending.requestedById,
        matchedBorrowerId: pending.matchedBorrowerId,
        segment: 'INDIVIDUAL',
        identityValue: '900101-10-1234',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.borrowerDuplicateException.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'EXPIRED' } }));
  });

  it('enforces reason length and category in the request schema', async () => {
    const { duplicateExceptionRequestSchema } = await import('../validators/borrowerDuplicateException.validator');
    expect(() => duplicateExceptionRequestSchema.parse({ body: { ...pending, identityValue: 'x', category: '', justification: 'too short' } })).toThrow();
  });
});
