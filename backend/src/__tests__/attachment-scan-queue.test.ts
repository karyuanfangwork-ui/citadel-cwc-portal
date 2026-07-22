const mockAdd = jest.fn();
const mockGetJob = jest.fn();

jest.mock('bullmq', () => ({
    Queue: jest.fn().mockImplementation(() => ({
        add: mockAdd,
        getJob: mockGetJob,
    })),
}));

jest.mock('../utils/redis', () => ({
    getRedisConnectionConfig: () => ({ host: 'localhost', port: 6379 }),
}));

import { dispatchAttachmentScan } from '../queues/attachmentScan.queue';

const scan = {
    attachmentId: 'attachment-1',
    tenantId: 'tenant-1',
    scanJobId: 'job-1',
    contentHash: 'a'.repeat(64),
};

describe('Task 12 attachment scan dispatch reconciliation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAdd.mockResolvedValue(undefined);
    });

    it('does not duplicate a live scan job', async () => {
        mockGetJob.mockResolvedValue({ getState: jest.fn().mockResolvedValue('active') });

        await dispatchAttachmentScan(scan);

        expect(mockAdd).not.toHaveBeenCalled();
    });

    it('replaces a terminal job when the database lifecycle is still pending', async () => {
        const remove = jest.fn().mockResolvedValue(undefined);
        mockGetJob.mockResolvedValue({
            getState: jest.fn().mockResolvedValue('failed'),
            remove,
        });

        await dispatchAttachmentScan(scan);

        expect(remove).toHaveBeenCalled();
        expect(mockAdd).toHaveBeenCalledWith('scan', scan, { jobId: scan.scanJobId });
    });
});
