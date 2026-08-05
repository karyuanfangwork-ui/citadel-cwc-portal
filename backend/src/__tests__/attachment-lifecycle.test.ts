/**
 * Task 12 governed request-attachment lifecycle.
 */

const mockRequestFindFirst = jest.fn();
const mockAttachmentCreate = jest.fn();
const mockAttachmentFindFirst = jest.fn();
const mockAttachmentUpdateMany = jest.fn();
const mockAttachmentDeleteMany = jest.fn();
const mockGetPresignedUrl = jest.fn();
const mockCopyToQuarantine = jest.fn();
const mockDeleteObject = jest.fn();
const mockDispatchAttachmentScan = jest.fn();

jest.mock('../utils/prisma', () => ({
    __esModule: true,
    default: {
        request: { findFirst: mockRequestFindFirst },
        requestAttachment: {
            create: mockAttachmentCreate,
            findFirst: mockAttachmentFindFirst,
            updateMany: mockAttachmentUpdateMany,
            deleteMany: mockAttachmentDeleteMany,
        },
    },
}));

jest.mock('../services/s3.service', () => ({
    s3Service: {
        getPresignedUrl: mockGetPresignedUrl,
        copyToQuarantine: mockCopyToQuarantine,
        deleteObject: mockDeleteObject,
    },
}));

jest.mock('../queues/attachmentScan.queue', () => ({
    dispatchAttachmentScan: mockDispatchAttachmentScan,
}));

jest.mock('../utils/logger', () => ({
    logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

import {
    getAuthorizedCustomFieldUploadUrl,
    getAuthorizedDownloadUrl,
    markScanResult,
    markWorkerScanResult,
    quarantineInfectedAttachment,
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
        mockDispatchAttachmentScan.mockResolvedValue(undefined);
        mockDeleteObject.mockResolvedValue(undefined);
        mockAttachmentDeleteMany.mockResolvedValue({ count: 1 });
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
        expect(mockDispatchAttachmentScan).toHaveBeenCalledWith(expect.objectContaining({
            attachmentId: 'attachment-1',
            tenantId: 'tenant-1',
            scanJobId: result.scanRegistration.scanJobId,
            contentHash: result.scanRegistration.contentHash,
        }));
    });

    it('marks registration failed when scanner dispatch is unavailable', async () => {
        mockAttachmentCreate.mockImplementation(async ({ data }: any) => ({ id: 'attachment-1', ...data }));
        mockAttachmentUpdateMany.mockResolvedValue({ count: 1 });
        mockDispatchAttachmentScan.mockRejectedValue(new Error('redis unavailable'));

        await expect(registerUpload({
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
        })).rejects.toThrow('Attachment scanner is unavailable');

        expect(mockDeleteObject).toHaveBeenCalledWith('cwc/opaque.pdf');
        expect(mockAttachmentDeleteMany).toHaveBeenCalledWith({ where: { id: 'attachment-1' } });
        expect(mockAttachmentUpdateMany).not.toHaveBeenCalled();
    });

    it('marks dispatch-failed objects for deletion when object cleanup fails', async () => {
        mockAttachmentCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
            id: 'attachment-1',
            ...data,
        }));
        mockAttachmentUpdateMany.mockResolvedValue({ count: 1 });
        mockDispatchAttachmentScan.mockRejectedValue(new Error('redis unavailable'));
        mockDeleteObject.mockRejectedValue(new Error('object store unavailable'));

        await expect(registerUpload({
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
        })).rejects.toThrow('Attachment scanner is unavailable');

        expect(mockAttachmentUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                scanStatus: 'SCAN_FAILED',
                retentionStatus: 'PENDING_DELETION',
                retentionUntil: expect.any(Date),
            }),
        }));
        expect(mockAttachmentDeleteMany).not.toHaveBeenCalled();
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

    it('allows a delayed internal worker result without relying on callback expiry', async () => {
        mockAttachmentUpdateMany.mockResolvedValue({ count: 1 });

        await markWorkerScanResult({
            attachmentId: 'attachment-1',
            scanJobId: 'job-1',
            contentHash: 'hash-1',
            result: 'CLEAN',
        });

        expect(mockAttachmentFindFirst).not.toHaveBeenCalled();
        expect(mockAttachmentUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                scanJobId: 'job-1',
                scanStatus: 'PENDING_SCAN',
            }),
            data: expect.objectContaining({ scanStatus: 'CLEAN' }),
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

    it('signs a custom-field upload only when its storage key belongs to an authorized request', async () => {
        mockRequestFindFirst.mockResolvedValue({
            ...requestScope,
            customFields: {
                receipt: {
                    s3Key: 'cwc/custom-field.pdf',
                    fileName: 'receipt.pdf',
                    mimeType: 'application/pdf',
                },
            },
        });
        mockGetPresignedUrl.mockResolvedValue('https://signed.example/custom-field');

        await expect(getAuthorizedCustomFieldUploadUrl(principal, 'request-1', 'cwc/custom-field.pdf', true))
            .resolves.toBe('https://signed.example/custom-field');
        expect(mockGetPresignedUrl).toHaveBeenCalledWith(
            'cwc/custom-field.pdf',
            0.25,
            { 'response-content-disposition': 'inline' },
        );
    });

    it('does not sign a custom-field upload key that is absent from the request payload', async () => {
        mockRequestFindFirst.mockResolvedValue({
            ...requestScope,
            customFields: {
                receipt: { s3Key: 'cwc/other.pdf', fileName: 'other.pdf' },
            },
        });

        await expect(getAuthorizedCustomFieldUploadUrl(principal, 'request-1', 'cwc/custom-field.pdf'))
            .rejects.toThrow('Attachment not found');
        expect(mockGetPresignedUrl).not.toHaveBeenCalled();
    });

    it('never signs a CLEAN attachment after its retention deadline', async () => {
        mockAttachmentFindFirst.mockResolvedValue({
            id: 'attachment-1',
            storagePath: 'cwc/opaque.pdf',
            scanStatus: 'CLEAN',
            deletedAt: null,
            retentionStatus: 'ACTIVE',
            retentionUntil: new Date(Date.now() - 1_000),
            request: requestScope,
        });

        await expect(getAuthorizedDownloadUrl(principal, 'attachment-1'))
            .rejects.toThrow('Attachment not found');
        expect(mockGetPresignedUrl).not.toHaveBeenCalled();
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

    it('moves an INFECTED object to quarantine and records deletion evidence', async () => {
        mockAttachmentFindFirst.mockResolvedValue({
            id: 'attachment-1',
            tenantId: 'tenant-1',
            storagePath: 'cwc/opaque.pdf',
            contentHash: 'a'.repeat(64),
            scanStatus: 'INFECTED',
            quarantinePath: null,
            quarantinedAt: null,
            sourceDeletedAt: null,
        });
        mockAttachmentUpdateMany.mockResolvedValue({ count: 1 });
        mockCopyToQuarantine.mockResolvedValue(undefined);

        await quarantineInfectedAttachment('attachment-1');

        const quarantinePath = `quarantine/tenant-1/attachment-1/${'a'.repeat(64)}`;
        expect(mockCopyToQuarantine).toHaveBeenCalledWith('cwc/opaque.pdf', quarantinePath);
        expect(mockAttachmentUpdateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
            data: {
                quarantinePath,
                quarantinedAt: expect.any(Date),
            },
        }));
        expect(mockDeleteObject).toHaveBeenCalledWith('cwc/opaque.pdf');
        expect(mockAttachmentUpdateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
            data: expect.objectContaining({
                sourceDeletedAt: expect.any(Date),
                scanResult: 'INFECTED',
            }),
        }));
    });

    it('resumes source deletion after quarantine evidence was persisted', async () => {
        const quarantinePath = `quarantine/tenant-1/attachment-1/${'a'.repeat(64)}`;
        mockAttachmentFindFirst.mockResolvedValue({
            id: 'attachment-1',
            tenantId: 'tenant-1',
            storagePath: 'cwc/opaque.pdf',
            contentHash: 'a'.repeat(64),
            scanStatus: 'INFECTED',
            quarantinePath,
            quarantinedAt: new Date(),
            sourceDeletedAt: null,
        });
        mockAttachmentUpdateMany.mockResolvedValue({ count: 1 });

        await quarantineInfectedAttachment('attachment-1');

        expect(mockCopyToQuarantine).not.toHaveBeenCalled();
        expect(mockDeleteObject).toHaveBeenCalledWith('cwc/opaque.pdf');
        expect(mockAttachmentUpdateMany).toHaveBeenCalledTimes(1);
    });
});
