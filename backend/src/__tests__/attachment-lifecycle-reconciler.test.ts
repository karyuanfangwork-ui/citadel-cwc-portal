const mockFindMany = jest.fn();
const mockUpdateMany = jest.fn();
const mockDispatchAttachmentScan = jest.fn();
const mockDeleteObject = jest.fn();

jest.mock('../utils/prisma', () => ({
    __esModule: true,
    default: {
        requestAttachment: {
            findMany: mockFindMany,
            updateMany: mockUpdateMany,
        },
    },
}));

jest.mock('../lib/execution-scope', () => ({
    withSystemScope: (_jobName: string, fn: () => Promise<unknown>) => fn(),
    runWithExecutionScope: (_scope: unknown, fn: () => Promise<unknown>) => fn(),
}));

jest.mock('../queues/attachmentScan.queue', () => ({
    dispatchAttachmentScan: mockDispatchAttachmentScan,
}));

jest.mock('../services/s3.service', () => ({
    s3Service: { deleteObject: mockDeleteObject },
}));

jest.mock('../utils/logger', () => ({
    logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

import { reconcileAttachmentLifecycle } from '../services/attachmentLifecycleReconciler.service';

describe('Task 12 attachment lifecycle reconciliation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockDispatchAttachmentScan.mockResolvedValue(undefined);
        mockDeleteObject.mockResolvedValue(undefined);
        mockUpdateMany.mockResolvedValue({ count: 1 });
    });

    it('redelivers persisted pending scans after a dispatch crash window', async () => {
        mockFindMany
            .mockResolvedValueOnce([{
                id: 'attachment-1',
                tenantId: 'tenant-1',
                scanJobId: 'job-1',
                contentHash: 'a'.repeat(64),
            }])
            .mockResolvedValueOnce([]);

        await reconcileAttachmentLifecycle();

        expect(mockDispatchAttachmentScan).toHaveBeenCalledWith({
            attachmentId: 'attachment-1',
            tenantId: 'tenant-1',
            scanJobId: 'job-1',
            contentHash: 'a'.repeat(64),
        });
    });

    it('retries durable pending object deletions', async () => {
        mockFindMany
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{
                id: 'attachment-2',
                tenantId: 'tenant-1',
                storagePath: 'uploads/unscanned.bin',
            }]);

        await reconcileAttachmentLifecycle();

        expect(mockDeleteObject).toHaveBeenCalledWith('uploads/unscanned.bin');
        expect(mockUpdateMany).toHaveBeenCalledWith({
            where: { id: 'attachment-2', retentionStatus: 'PENDING_DELETION' },
            data: { retentionStatus: 'DELETED', deletedAt: expect.any(Date) },
        });
    });
});
