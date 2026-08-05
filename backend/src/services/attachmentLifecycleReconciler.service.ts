import { config } from '../config';
import { runWithExecutionScope, withSystemScope } from '../lib/execution-scope';
import { dispatchAttachmentScan } from '../queues/attachmentScan.queue';
import { s3Service } from './s3.service';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';

const RECONCILIATION_BATCH_SIZE = 100;
let reconciliationRunning = false;

export async function reconcileAttachmentLifecycle(): Promise<void> {
    const pendingScans = await withSystemScope('attachment-scan-reconciliation', () => (
        prisma.requestAttachment.findMany({
            where: {
                deletedAt: null,
                scanStatus: 'PENDING_SCAN',
                scanJobId: { not: null },
                contentHash: { not: null },
            },
            select: {
                id: true,
                tenantId: true,
                scanJobId: true,
                contentHash: true,
            },
            orderBy: { createdAt: 'asc' },
            take: RECONCILIATION_BATCH_SIZE,
        })
    ));

    for (const attachment of pendingScans) {
        if (!attachment.scanJobId || !attachment.contentHash) continue;
        try {
            await dispatchAttachmentScan({
                attachmentId: attachment.id,
                tenantId: attachment.tenantId,
                scanJobId: attachment.scanJobId,
                contentHash: attachment.contentHash,
            });
        } catch (error) {
            logger.error('[AttachmentScanner] Pending scan reconciliation failed', {
                attachmentId: attachment.id,
                error,
            });
        }
    }

    const pendingDeletions = await withSystemScope('attachment-deletion-reconciliation', () => (
        prisma.requestAttachment.findMany({
            where: { retentionStatus: 'PENDING_DELETION' },
            select: { id: true, tenantId: true, storagePath: true },
            orderBy: { createdAt: 'asc' },
            take: RECONCILIATION_BATCH_SIZE,
        })
    ));

    for (const attachment of pendingDeletions) {
        try {
            await runWithExecutionScope({
                kind: 'system',
                tenantId: attachment.tenantId,
                jobName: 'attachment-deletion-reconciliation',
                runId: attachment.id,
            }, async () => {
                await s3Service.deleteObject(attachment.storagePath);
                await prisma.requestAttachment.updateMany({
                    where: { id: attachment.id, retentionStatus: 'PENDING_DELETION' },
                    data: { retentionStatus: 'DELETED', deletedAt: new Date() },
                });
            });
        } catch (error) {
            logger.error('[AttachmentScanner] Pending object deletion failed', {
                attachmentId: attachment.id,
                error,
            });
        }
    }
}

export function startAttachmentLifecycleReconciler(): () => void {
    const tick = async () => {
        if (reconciliationRunning) return;
        reconciliationRunning = true;
        try {
            await reconcileAttachmentLifecycle();
        } catch (error) {
            logger.error('[AttachmentScanner] Lifecycle reconciliation failed', { error });
        } finally {
            reconciliationRunning = false;
        }
    };

    void tick();
    const configuredInterval = config.attachmentScanner.reconciliationIntervalMs;
    const intervalMs = Number.isFinite(configuredInterval) && configuredInterval >= 5000
        ? configuredInterval
        : 60000;
    const timer = setInterval(() => void tick(), intervalMs);
    timer.unref();
    return () => clearInterval(timer);
}
