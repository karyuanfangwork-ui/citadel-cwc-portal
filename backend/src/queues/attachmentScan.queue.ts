import { Queue } from 'bullmq';
import { getRedisConnectionConfig } from '../utils/redis';

export const ATTACHMENT_SCAN_QUEUE_NAME = process.env.ATTACHMENT_SCAN_QUEUE_NAME
    || 'attachment.malware-scan';

export interface AttachmentScanJobData {
    attachmentId: string;
    tenantId: string;
    scanJobId: string;
    contentHash: string;
    nonce: string;
}

export const attachmentScanQueue = new Queue<AttachmentScanJobData>(ATTACHMENT_SCAN_QUEUE_NAME, {
    connection: getRedisConnectionConfig(),
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
    },
});

export async function dispatchAttachmentScan(data: AttachmentScanJobData): Promise<void> {
    await attachmentScanQueue.add('scan', data, { jobId: data.scanJobId });
}
