import { Readable } from 'stream';

const mockGetTarget = jest.fn();
const mockMarkWorkerScanResult = jest.fn();
const mockMarkQuarantineFailure = jest.fn();
const mockQuarantine = jest.fn();
const mockStreamObject = jest.fn();
const mockScanStream = jest.fn();

jest.mock('../queues/attachmentScan.queue', () => ({
    ATTACHMENT_SCAN_QUEUE_NAME: 'attachment.malware-scan',
}));

jest.mock('../lib/execution-scope', () => ({
    runWithExecutionScope: (_scope: unknown, fn: () => Promise<unknown>) => fn(),
}));

jest.mock('../services/attachmentAccess.service', () => ({
    getAttachmentScanTarget: mockGetTarget,
    markQuarantineFailure: mockMarkQuarantineFailure,
    markWorkerScanResult: mockMarkWorkerScanResult,
    quarantineInfectedAttachment: mockQuarantine,
}));

jest.mock('../services/s3.service', () => ({
    s3Service: { streamObject: mockStreamObject },
}));

jest.mock('../services/clamAv.service', () => ({
    clamAvService: { scanStream: mockScanStream },
}));

jest.mock('../utils/logger', () => ({
    logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

import { markTerminalScanFailure, processAttachmentScan } from '../workers/attachmentScan.worker';

const job = {
    attachmentId: 'attachment-1',
    tenantId: 'tenant-1',
    scanJobId: 'job-1',
    contentHash: 'a'.repeat(64),
};

const target = {
    id: job.attachmentId,
    tenantId: job.tenantId,
    storagePath: 'cwc/object.pdf',
    contentHash: job.contentHash,
    scanStatus: 'PENDING_SCAN',
    quarantinePath: null,
};

describe('Task 12 attachment scanner worker', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetTarget.mockResolvedValue(target);
        mockStreamObject.mockResolvedValue(Readable.from(Buffer.from('file')));
        mockMarkWorkerScanResult.mockResolvedValue(undefined);
        mockMarkQuarantineFailure.mockResolvedValue(false);
        mockQuarantine.mockResolvedValue(undefined);
    });

    it('streams an object through ClamAV and records a CLEAN result', async () => {
        mockScanStream.mockResolvedValue({ status: 'CLEAN' });

        await processAttachmentScan(job);

        expect(mockStreamObject).toHaveBeenCalledWith('cwc/object.pdf');
        expect(mockMarkWorkerScanResult).toHaveBeenCalledWith(expect.objectContaining({
            attachmentId: job.attachmentId,
            result: 'CLEAN',
        }));
        expect(mockQuarantine).not.toHaveBeenCalled();
    });

    it('quarantines an INFECTED object after consuming the bound callback', async () => {
        mockScanStream.mockResolvedValue({ status: 'INFECTED', signature: 'Eicar-Signature' });

        await processAttachmentScan(job);

        expect(mockMarkWorkerScanResult).toHaveBeenCalledWith(expect.objectContaining({ result: 'INFECTED' }));
        expect(mockQuarantine).toHaveBeenCalledWith(job.attachmentId);
    });

    it('retries quarantine without rescanning after an earlier move failure', async () => {
        mockGetTarget.mockResolvedValue({ ...target, scanStatus: 'INFECTED' });

        await processAttachmentScan(job);

        expect(mockQuarantine).toHaveBeenCalledWith(job.attachmentId);
        expect(mockStreamObject).not.toHaveBeenCalled();
        expect(mockScanStream).not.toHaveBeenCalled();
    });

    it('rejects a queue payload that does not match immutable attachment metadata', async () => {
        mockGetTarget.mockResolvedValue({ ...target, contentHash: 'b'.repeat(64) });

        await expect(processAttachmentScan(job)).rejects.toThrow('Attachment scan job binding mismatch');
        expect(mockScanStream).not.toHaveBeenCalled();
    });

    it('records terminal quarantine failure without reusing the consumed callback', async () => {
        mockMarkQuarantineFailure.mockResolvedValue(true);
        const failedJob = {
            data: job,
            attemptsMade: 3,
            opts: { attempts: 3 },
        } as unknown as Parameters<typeof markTerminalScanFailure>[0];

        await markTerminalScanFailure(failedJob);

        expect(mockMarkQuarantineFailure).toHaveBeenCalledWith(job.attachmentId, job.scanJobId);
        expect(mockMarkWorkerScanResult).not.toHaveBeenCalled();
    });
});
