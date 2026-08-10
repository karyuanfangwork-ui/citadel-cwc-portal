import { Queue } from 'bullmq';
import { getRedisConnectionConfig } from '../utils/redis';

export const ATTACHMENT_SCAN_QUEUE_NAME = process.env.ATTACHMENT_SCAN_QUEUE_NAME
    || 'attachment.malware-scan';

export interface AttachmentScanJobData {
    attachmentId: string;
    tenantId: string;
    scanJobId: string;
    contentHash: string;
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

/** Close the BullMQ-owned attachment-scan queue connection. */
export async function closeAttachmentScanQueue(): Promise<void> {
    const client = attachmentScanQueue.client;
    try {
        await attachmentScanQueue.close();
    } catch {
        /* already closed */
    } finally {
        try {
            (await client).disconnect();
        } catch {
            /* client was never initialized */
        }
    }
}

export async function dispatchAttachmentScan(data: AttachmentScanJobData): Promise<void> {
    const existing = await attachmentScanQueue.getJob(data.scanJobId);
    if (existing) {
        const state = await existing.getState();
        if (!['completed', 'failed'].includes(state)) return;
        await existing.remove();
    }
    await attachmentScanQueue.add('scan', data, { jobId: data.scanJobId });
}
