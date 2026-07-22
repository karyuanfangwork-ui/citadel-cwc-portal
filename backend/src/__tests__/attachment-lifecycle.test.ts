/**
 * Task 12 governed request-attachment lifecycle.
 */

const mockRequestFindFirst = jest.fn();
const mockAttachmentCreate = jest.fn();
const mockAttachmentFindFirst = jest.fn();
const mockAttachmentUpdateMany = jest.fn();
const mockGetPresignedUrl = jest.fn();

jest.mock('../utils/prisma', () => ({
    __esModule: true,
    default: {
        request: { findFirst: mockRequestFindFirst },
        requestAttachment: {
            create: mockAttachmentCreate,
            findFirst: mockAttachmentFindFirst,
            updateMany: mockAttachmentUpdateMany,
        },
    },
}));

jest.mock('../services/s3.service', () => ({
    s3Service: { getPresignedUrl: mockGetPresignedUrl },
}));

jest.mock('../utils/logger', () => ({
    logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

import {
    getAuthorizedDownloadUrl,
    markScanResult,
    registerUpload,
} from '../services/attachmentAccess.service';

const requestScope = {
    id: 'request-1',
    tenantId: 'tenant-1',
    departmentId: 'department-it',
    requesterId: 'owner-1',
    assignedToId: null,
    isConfidential: false,
    assignedTeam: 'IT',
    status: 'SUBMITTED',
    serviceDesk: { code: 'IT' },
    approvals: [],
    participants: [],
};

const principal = {
    userId: 'owner-1',
    tenantId: 'tenant-1',
    roles: ['END_USER'],
    permissions: ['request:read'],
    departmentIds: ['department-it'],
};

describe('Task 12 attachment lifecycle', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRequestFindFirst.mockResolvedValue(requestScope);
    });

    it('registers uploads as tenant/department-bound PENDING_SCAN records', async () => {
        mockAttachmentCreate.mockImplementation(async ({ data }: any) => ({
            id: 'attachment-1',
            createdAt: new Date('2026-07-22T00:00:00Z'),
            ...data,
        }));

        const result = await registerUpload({
            principal,
            requestId: 'request-1',
            uploadedById: 'owner-1',
            file: {
                originalname: 'evidence.pdf',
                mimetype: 'application/pdf',
                size: 4,
                buffer: Buffer.from('test'),
                key: 'cwc/opaque.pdf',
            },
        });

        expect(result.attachment).toMatchObject({
            tenantId: 'tenant-1',
            departmentId: 'department-it',
            scanStatus: 'PENDING_SCAN',
            storagePath: 'cwc/opaque.pdf',
        });
        expect(result.scanRegistration.nonce).toBeTruthy();
        expect(result.attachment.scanCallbackNonceHash).not.toBe(result.scanRegistration.nonce);
        expect(result.attachment.contentHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('rejects a forged scan callback without mutating state', async () => {
        mockAttachmentFindFirst.mockResolvedValue({
            id: 'attachment-1',
            scanStatus: 'PENDING_SCAN',
            scanJobId: 'job-1',
            contentHash: 'hash-1',
            scanCallbackNonceHash: 'not-the-forged-hash',
            scanCallbackExpiresAt: new Date(Date.now() + 60_000),
            scanCallbackConsumedAt: null,
        });

        await expect(markScanResult({
            attachmentId: 'attachment-1',
            scanJobId: 'job-1',
            contentHash: 'hash-1',
            nonce: 'forged',
            timestamp: new Date(),
            result: 'CLEAN',
        })).rejects.toThrow('Invalid scan callback');
        expect(mockAttachmentUpdateMany).not.toHaveBeenCalled();
    });

    it('accepts one correctly bound scan result and marks the callback consumed', async () => {
        const nonce = 'valid-nonce';
        const { createHash } = await import('crypto');
        mockAttachmentFindFirst.mockResolvedValue({
            id: 'attachment-1',
            scanStatus: 'PENDING_SCAN',
            scanJobId: 'job-1',
            contentHash: 'hash-1',
            scanCallbackNonceHash: createHash('sha256').update(nonce).digest('hex'),
            scanCallbackExpiresAt: new Date(Date.now() + 60_000),
            scanCallbackConsumedAt: null,
        });
        mockAttachmentUpdateMany.mockResolvedValue({ count: 1 });

        await markScanResult({
            attachmentId: 'attachment-1',
            scanJobId: 'job-1',
            contentHash: 'hash-1',
            nonce,
            timestamp: new Date(),
            result: 'CLEAN',
        });

        expect(mockAttachmentUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                scanStatus: 'CLEAN',
                isScanned: true,
                scanCallbackConsumedAt: expect.any(Date),
            }),
        }));
    });

    it('rejects a replay when the compare-and-set no longer finds a pending callback', async () => {
        const nonce = 'valid-nonce';
        const { createHash } = await import('crypto');
        mockAttachmentFindFirst.mockResolvedValue({
            id: 'attachment-1',
            scanStatus: 'PENDING_SCAN',
            scanJobId: 'job-1',
            contentHash: 'hash-1',
            scanCallbackNonceHash: createHash('sha256').update(nonce).digest('hex'),
            scanCallbackExpiresAt: new Date(Date.now() + 60_000),
            scanCallbackConsumedAt: null,
        });
        mockAttachmentUpdateMany.mockResolvedValue({ count: 0 });

        await expect(markScanResult({
            attachmentId: 'attachment-1',
            scanJobId: 'job-1',
            contentHash: 'hash-1',
            nonce,
            timestamp: new Date(),
            result: 'CLEAN',
        })).rejects.toThrow('Scan callback already consumed');
    });

    it('never signs a PENDING_SCAN attachment', async () => {
        mockAttachmentFindFirst.mockResolvedValue({
            id: 'attachment-1',
            scanStatus: 'PENDING_SCAN',
            deletedAt: null,
            retentionStatus: 'ACTIVE',
            request: requestScope,
        });

        await expect(getAuthorizedDownloadUrl(principal, 'attachment-1'))
            .rejects.toThrow('Attachment not found');
        expect(mockGetPresignedUrl).not.toHaveBeenCalled();
    });

    it('signs a CLEAN attachment only after parent-resource policy authorization', async () => {
        mockAttachmentFindFirst.mockResolvedValue({
            id: 'attachment-1',
            storagePath: 'cwc/opaque.pdf',
            scanStatus: 'CLEAN',
            deletedAt: null,
            retentionStatus: 'ACTIVE',
            request: requestScope,
        });
        mockGetPresignedUrl.mockResolvedValue('https://signed.example/opaque');

        await expect(getAuthorizedDownloadUrl(principal, 'attachment-1'))
            .resolves.toBe('https://signed.example/opaque');
        expect(mockGetPresignedUrl).toHaveBeenCalledWith('cwc/opaque.pdf', 0.25);
    });

    it('conceals a CLEAN attachment from a principal outside the parent request scope', async () => {
        mockAttachmentFindFirst.mockResolvedValue({
            id: 'attachment-1',
            storagePath: 'cwc/opaque.pdf',
            scanStatus: 'CLEAN',
            deletedAt: null,
            retentionStatus: 'ACTIVE',
            request: requestScope,
        });

        await expect(getAuthorizedDownloadUrl({
            ...principal,
            userId: 'outsider-1',
            departmentIds: ['department-hr'],
        }, 'attachment-1')).rejects.toThrow('Attachment not found');
        expect(mockGetPresignedUrl).not.toHaveBeenCalled();
    });
});
