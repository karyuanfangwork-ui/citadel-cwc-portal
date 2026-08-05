import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { config } from '../src/config';
import { runWithExecutionScope, withSystemScope } from '../src/lib/execution-scope';
import { attachmentScanQueue } from '../src/queues/attachmentScan.queue';
import {
    getAuthorizedDownloadUrl,
    registerUpload,
} from '../src/services/attachmentAccess.service';
import { s3Service } from '../src/services/s3.service';
import { startAttachmentScanWorker } from '../src/workers/attachmentScan.worker';
import prisma from '../src/utils/prisma';

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

async function ensureBucket(): Promise<void> {
    const client = new S3Client({
        region: config.s3.region,
        endpoint: config.s3.endpoint,
        credentials: {
            accessKeyId: config.s3.accessKey,
            secretAccessKey: config.s3.secretKey,
        },
        forcePathStyle: config.s3.forcePathStyle,
    });
    try {
        await client.send(new CreateBucketCommand({ Bucket: config.s3.bucket }));
    } catch (error: any) {
        if (!['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes(error?.name)) throw error;
    } finally {
        client.destroy();
    }
}

async function main(): Promise<void> {
    if (config.env === 'production') throw new Error('Scanner smoke test is disabled in production');

    await ensureBucket();
    const stale = await withSystemScope('attachment-scanner-smoke-stale-cleanup', () =>
        prisma.requestAttachment.findMany({
            where: { storagePath: { startsWith: 'task12-smoke/' } },
            select: { id: true, storagePath: true, quarantinePath: true, scanJobId: true },
        }));
    for (const attachment of stale) {
        if (attachment.scanJobId) {
            const job = await attachmentScanQueue.getJob(attachment.scanJobId);
            if (job) await job.remove().catch(() => undefined);
        }
        await s3Service.deleteObject(attachment.storagePath).catch(() => undefined);
        if (attachment.quarantinePath) await s3Service.deleteObject(attachment.quarantinePath).catch(() => undefined);
    }
    if (stale.length > 0) {
        await withSystemScope('attachment-scanner-smoke-stale-delete', () =>
            prisma.requestAttachment.deleteMany({ where: { id: { in: stale.map((item) => item.id) } } }));
    }

    const request = await withSystemScope('attachment-scanner-smoke-fixture', () =>
        prisma.request.findFirst({
            where: {
                deletedAt: null,
                tenantId: { not: null },
                departmentId: { not: null },
            },
            select: {
                id: true,
                tenantId: true,
                departmentId: true,
                requesterId: true,
            },
        }));
    if (!request?.tenantId || !request.departmentId) {
        throw new Error('No canonically-owned request is available for the scanner smoke test');
    }

    const objectKey = `task12-smoke/${randomUUID()}.txt`;
    const payload = Buffer.from(EICAR);
    let attachmentId: string | undefined;
    let quarantinePath: string | undefined;
    let scanJobId: string | undefined;
    const worker = startAttachmentScanWorker();
    if (!worker) throw new Error('Attachment scanner worker is disabled');

    try {
        await s3Service.uploadBuffer(objectKey, payload, 'text/plain');
        const registration = await runWithExecutionScope({
            kind: 'system',
            tenantId: request.tenantId,
            jobName: 'attachment-scanner-smoke-register',
            runId: randomUUID(),
        }, () => registerUpload({
            principal: {
                userId: request.requesterId,
                tenantId: request.tenantId!,
                roles: ['END_USER'],
                permissions: ['request:read', 'request:update'],
                departmentIds: [request.departmentId!],
            },
            requestId: request.id,
            uploadedById: request.requesterId,
            file: {
                originalname: 'eicar.txt',
                mimetype: 'text/plain',
                size: payload.length,
                buffer: payload,
                key: objectKey,
            },
        }));

        attachmentId = registration.attachment.id;
        scanJobId = registration.scanRegistration.scanJobId;
        quarantinePath = `quarantine/${request.tenantId}/${attachmentId}/${registration.scanRegistration.contentHash}`;

        let stored = null;
        for (let attempt = 0; attempt < 60; attempt += 1) {
            stored = await runWithExecutionScope({
                kind: 'system',
                tenantId: request.tenantId,
                jobName: 'attachment-scanner-smoke-verify',
                runId: randomUUID(),
            }, () => prisma.requestAttachment.findUnique({ where: { id: attachmentId } }));
            if (stored?.scanStatus === 'INFECTED' && stored.sourceDeletedAt) break;
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
        if (!stored || stored.scanStatus !== 'INFECTED' || !stored.quarantinePath
            || !stored.quarantinedAt || !stored.sourceDeletedAt) {
            throw new Error('Infected attachment did not reach evidenced quarantine state');
        }
        if (stored.quarantinePath !== quarantinePath) {
            throw new Error('Infected attachment used an unexpected quarantine object key');
        }

        await runWithExecutionScope({
            kind: 'system',
            tenantId: request.tenantId,
            jobName: 'attachment-scanner-smoke-download-denial',
            runId: randomUUID(),
        }, () => getAuthorizedDownloadUrl({
                userId: request.requesterId,
                tenantId: request.tenantId!,
                roles: ['END_USER'],
                permissions: ['request:read'],
                departmentIds: [request.departmentId!],
            }, attachmentId!).then(
                () => { throw new Error('Infected attachment unexpectedly produced a download URL'); },
                (error) => {
                    if (error?.statusCode !== 404) throw error;
                },
            ));

        let originalDeleted = false;
        try {
            await s3Service.streamObject(objectKey);
        } catch {
            originalDeleted = true;
        }
        if (!originalDeleted) throw new Error('Original infected storage object was not deleted');
        await s3Service.streamObject(quarantinePath);

        console.log(JSON.stringify({
            status: stored.scanStatus,
            quarantined: true,
            sourceDeleted: true,
            downloadDenied: true,
        }));
    } finally {
        await worker.close();
        if (scanJobId) {
            const job = await attachmentScanQueue.getJob(scanJobId);
            if (job) await job.remove().catch(() => undefined);
        }
        if (attachmentId) {
            await withSystemScope('attachment-scanner-smoke-cleanup', () =>
                prisma.requestAttachment.deleteMany({ where: { id: attachmentId } }));
        }
        await s3Service.deleteObject(objectKey).catch(() => undefined);
        if (quarantinePath) await s3Service.deleteObject(quarantinePath).catch(() => undefined);
        await attachmentScanQueue.close();
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
