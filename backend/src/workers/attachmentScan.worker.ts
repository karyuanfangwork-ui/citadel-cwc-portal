import { Job, Worker } from 'bullmq';
import { config } from '../config';
import { runWithExecutionScope } from '../lib/execution-scope';
import {
    ATTACHMENT_SCAN_QUEUE_NAME,
    AttachmentScanJobData,
} from '../queues/attachmentScan.queue';
import {
    getAttachmentScanTarget,
    markQuarantineFailure,
    markScanResult,
    quarantineInfectedAttachment,
} from '../services/attachmentAccess.service';
import { clamAvService } from '../services/clamAv.service';
import { s3Service } from '../services/s3.service';
import { getRedisConnectionConfig } from '../utils/redis';
import { logger } from '../utils/logger';

export async function processAttachmentScan(data: AttachmentScanJobData): Promise<void> {
    await runWithExecutionScope({
        kind: 'system',
        tenantId: data.tenantId,
        jobName: ATTACHMENT_SCAN_QUEUE_NAME,
        runId: data.scanJobId,
    }, async () => {
        const attachment = await getAttachmentScanTarget(data.attachmentId, data.scanJobId);
        if (!attachment) throw new Error('Attachment scan target not found');
        if (attachment.tenantId !== data.tenantId || attachment.contentHash !== data.contentHash) {
            throw new Error('Attachment scan job binding mismatch');
        }

        // A retry after a partial infected-object move must resume quarantine.
        // The one-time scanner callback was already consumed on the first attempt.
        if (attachment.scanStatus === 'INFECTED') {
            await quarantineInfectedAttachment(attachment.id);
            return;
        }
        if (attachment.scanStatus !== 'PENDING_SCAN') return;

        const stream = await s3Service.streamObject(attachment.storagePath);
        const scan = await clamAvService.scanStream(stream);
        await markScanResult({
            attachmentId: attachment.id,
            scanJobId: data.scanJobId,
            contentHash: data.contentHash,
            nonce: data.nonce,
            timestamp: new Date(),
            result: scan.status,
        });

        if (scan.status === 'INFECTED') {
            await quarantineInfectedAttachment(attachment.id);
            logger.warn('[AttachmentScanner] Infected object quarantined', {
                attachmentId: attachment.id,
                signature: scan.signature,
            });
        }
    });
}

export async function markTerminalScanFailure(job: Job<AttachmentScanJobData>): Promise<void> {
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return;

    const data = job.data;
    await runWithExecutionScope({
        kind: 'system',
        tenantId: data.tenantId,
        jobName: ATTACHMENT_SCAN_QUEUE_NAME,
        runId: data.scanJobId,
    }, async () => {
        try {
            const quarantineFailed = await markQuarantineFailure(data.attachmentId, data.scanJobId);
            if (quarantineFailed) {
                logger.error('[AttachmentScanner] Quarantine exhausted retries; failed job retained', {
                    attachmentId: data.attachmentId,
                    scanJobId: data.scanJobId,
                });
                return;
            }
            await markScanResult({
                attachmentId: data.attachmentId,
                scanJobId: data.scanJobId,
                contentHash: data.contentHash,
                nonce: data.nonce,
                timestamp: new Date(),
                result: 'SCAN_FAILED',
            });
        } catch (error) {
            logger.error('[AttachmentScanner] Could not persist terminal scan failure', {
                attachmentId: data.attachmentId,
                error,
            });
        }
    });
}

export function startAttachmentScanWorker(): Worker<AttachmentScanJobData> | null {
    if (!config.attachmentScanner.enabled) {
        logger.warn('[AttachmentScanner] Worker disabled; new attachments remain fail-closed');
        return null;
    }

    const worker = new Worker<AttachmentScanJobData>(
        ATTACHMENT_SCAN_QUEUE_NAME,
        async (job) => processAttachmentScan(job.data),
        {
            connection: getRedisConnectionConfig(),
            concurrency: config.attachmentScanner.concurrency,
        },
    );

    worker.on('failed', async (job, error) => {
        logger.error(`[AttachmentScanner] Job ${job?.id} failed: ${error.message}`);
        if (job) await markTerminalScanFailure(job);
    });
    logger.info(`[AttachmentScanner] Started (concurrency: ${config.attachmentScanner.concurrency})`);
    return worker;
}
