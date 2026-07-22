import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import * as path from 'path';
import { AppError } from '../middleware/error.middleware';
import { dispatchAttachmentScan } from '../queues/attachmentScan.queue';
import { policyService } from '../security/policy.service';
import { PolicyPrincipal, ResourceDescriptor } from '../security/policy.types';
import { logger } from '../utils/logger';
import prisma from '../utils/prisma';
import { s3Service } from './s3.service';

const SCAN_CALLBACK_TTL_MS = 15 * 60 * 1000;
const SCAN_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

export interface RegisterUploadInput {
    principal: PolicyPrincipal;
    requestId: string;
    uploadedById: string;
    activityId?: string;
    classification?: 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
    file: {
        originalname: string;
        mimetype: string;
        size: number;
        buffer: Buffer;
        key?: string;
    };
}

export interface MarkScanResultInput {
    attachmentId: string;
    scanJobId: string;
    contentHash: string;
    nonce: string;
    timestamp: Date;
    result: 'CLEAN' | 'INFECTED' | 'SCAN_FAILED';
}

function sha256(value: Buffer | string): string {
    return createHash('sha256').update(value).digest('hex');
}

function safeHashMatch(actualValue: string, expectedHash: string): boolean {
    const actual = Buffer.from(sha256(actualValue), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function requestDescriptor(request: any): ResourceDescriptor {
    return {
        type: 'request',
        id: request.id,
        tenantId: request.tenantId ?? undefined,
        departmentId: request.departmentId ?? undefined,
        ownerId: request.requesterId ?? undefined,
        assignedToId: request.assignedToId ?? undefined,
        isConfidential: request.isConfidential,
        assignedTeam: request.assignedTeam ?? undefined,
        serviceDeskCode: request.serviceDesk?.code ?? undefined,
        status: request.status ?? undefined,
        approverIds: request.approvals?.map((approval: any) => approval.approverId) ?? [],
        participantIds: request.participants?.map((participant: any) => participant.userId) ?? [],
    };
}

export async function registerUpload(input: RegisterUploadInput) {
    if (!input.file.key || !input.file.buffer) {
        throw new AppError('Uploaded file metadata is incomplete', 400);
    }

    const request = await prisma.request.findFirst({
        where: { id: input.requestId, deletedAt: null },
        select: {
            id: true,
            tenantId: true,
            departmentId: true,
            requesterId: true,
            assignedToId: true,
            isConfidential: true,
            assignedTeam: true,
            status: true,
            serviceDesk: { select: { code: true } },
            approvals: { select: { approverId: true } },
            participants: { select: { userId: true } },
        },
    });
    if (!request) throw new AppError('Request not found', 404);
    if (!request.tenantId || !request.departmentId) {
        throw new AppError('Request ownership scope is not configured', 409);
    }
    const decision = policyService.authorize(input.principal, 'update', requestDescriptor(request));
    if (!decision.allowed) throw new AppError('Request not found', 404);

    const contentHash = sha256(input.file.buffer);
    const scanJobId = randomUUID();
    const nonce = randomBytes(32).toString('base64url');
    const scanCallbackNonceHash = sha256(nonce);
    const scanCallbackExpiresAt = new Date(Date.now() + SCAN_CALLBACK_TTL_MS);
    const classification = request.isConfidential
        ? 'CONFIDENTIAL'
        : (input.classification ?? 'INTERNAL');

    const attachment = await prisma.requestAttachment.create({
        data: {
            tenantId: request.tenantId,
            departmentId: request.departmentId,
            requestId: request.id,
            uploadedById: input.uploadedById,
            activityId: input.activityId,
            fileName: input.file.originalname,
            fileSize: BigInt(input.file.size),
            fileType: path.extname(input.file.originalname).replace('.', '').toLowerCase() || null,
            mimeType: input.file.mimetype,
            storagePath: input.file.key,
            storageUrl: input.file.key,
            contentHash,
            classification,
            isScanned: false,
            scanResult: null,
            scanStatus: 'PENDING_SCAN',
            scanJobId,
            scanCallbackNonceHash,
            scanCallbackExpiresAt,
            retentionStatus: 'ACTIVE',
        },
    });

    try {
        await dispatchAttachmentScan({
            attachmentId: attachment.id,
            tenantId: request.tenantId,
            scanJobId,
            contentHash,
            nonce,
        });
    } catch {
        const failedAt = new Date();
        try {
            await s3Service.deleteObject(attachment.storagePath);
            await prisma.requestAttachment.deleteMany({ where: { id: attachment.id } });
        } catch (cleanupError) {
            logger.error('[AttachmentScanner] Dispatch cleanup failed; object queued for deletion', {
                attachmentId: attachment.id,
                cleanupError,
            });
            await prisma.requestAttachment.updateMany({
                where: { id: attachment.id, scanStatus: 'PENDING_SCAN' },
                data: {
                    scanStatus: 'SCAN_FAILED',
                    scanResult: 'SCANNER_DISPATCH_FAILED',
                    isScanned: true,
                    scanCompletedAt: failedAt,
                    scanCallbackConsumedAt: failedAt,
                    retentionStatus: 'PENDING_DELETION',
                    retentionUntil: failedAt,
                },
            });
        }
        throw new AppError('Attachment scanner is unavailable', 503);
    }

    return {
        attachment,
        scanRegistration: {
            attachmentId: attachment.id,
            scanJobId,
            contentHash,
            nonce,
            expiresAt: scanCallbackExpiresAt,
        },
    };
}

export async function markScanResult(input: MarkScanResultInput) {
    const attachment = await prisma.requestAttachment.findFirst({
        where: { id: input.attachmentId, deletedAt: null },
        select: {
            id: true,
            scanStatus: true,
            scanJobId: true,
            contentHash: true,
            scanCallbackNonceHash: true,
            scanCallbackExpiresAt: true,
            scanCallbackConsumedAt: true,
        },
    });

    const callbackAge = Math.abs(Date.now() - input.timestamp.getTime());
    const callbackValid = attachment
        && attachment.scanStatus === 'PENDING_SCAN'
        && !attachment.scanCallbackConsumedAt
        && attachment.scanJobId === input.scanJobId
        && attachment.contentHash === input.contentHash
        && attachment.scanCallbackNonceHash
        && attachment.scanCallbackExpiresAt
        && attachment.scanCallbackExpiresAt.getTime() >= Date.now()
        && callbackAge <= SCAN_TIMESTAMP_SKEW_MS
        && safeHashMatch(input.nonce, attachment.scanCallbackNonceHash);

    if (!callbackValid) throw new AppError('Invalid scan callback', 403);

    const completedAt = new Date();
    const updated = await prisma.requestAttachment.updateMany({
        where: {
            id: input.attachmentId,
            scanStatus: 'PENDING_SCAN',
            scanJobId: input.scanJobId,
            contentHash: input.contentHash,
            scanCallbackConsumedAt: null,
        },
        data: {
            scanStatus: input.result,
            isScanned: true,
            scanResult: input.result,
            scanCompletedAt: completedAt,
            scanCallbackConsumedAt: completedAt,
        },
    });
    if (updated.count !== 1) throw new AppError('Scan callback already consumed', 409);

    return { attachmentId: input.attachmentId, scanStatus: input.result, scanCompletedAt: completedAt };
}

export async function getAuthorizedAttachment(principal: PolicyPrincipal, attachmentId: string) {
    const attachment = await prisma.requestAttachment.findFirst({
        where: { id: attachmentId, deletedAt: null },
        include: {
            request: {
                select: {
                    id: true,
                    tenantId: true,
                    departmentId: true,
                    requesterId: true,
                    assignedToId: true,
                    isConfidential: true,
                    assignedTeam: true,
                    status: true,
                    serviceDesk: { select: { code: true } },
                    approvals: { select: { approverId: true } },
                    participants: { select: { userId: true } },
                },
            },
        },
    });

    if (!attachment
        || attachment.scanStatus !== 'CLEAN'
        || attachment.retentionStatus !== 'ACTIVE'
        || (attachment.retentionUntil && attachment.retentionUntil.getTime() <= Date.now())) {
        throw new AppError('Attachment not found', 404);
    }

    const decision = policyService.authorize(principal, 'download', requestDescriptor(attachment.request));
    if (!decision.allowed) throw new AppError('Attachment not found', 404);
    return attachment;
}

export async function getAuthorizedDownloadUrl(principal: PolicyPrincipal, attachmentId: string): Promise<string> {
    const attachment = await getAuthorizedAttachment(principal, attachmentId);
    return s3Service.getPresignedUrl(attachment.storagePath, 0.25);
}

export async function getAttachmentScanTarget(attachmentId: string, scanJobId: string) {
    return prisma.requestAttachment.findFirst({
        where: { id: attachmentId, scanJobId, deletedAt: null },
        select: {
            id: true,
            tenantId: true,
            storagePath: true,
            contentHash: true,
            scanStatus: true,
            quarantinePath: true,
            quarantinedAt: true,
            sourceDeletedAt: true,
        },
    });
}

export async function quarantineInfectedAttachment(attachmentId: string): Promise<void> {
    const attachment = await prisma.requestAttachment.findFirst({
        where: { id: attachmentId, scanStatus: 'INFECTED', deletedAt: null },
        select: {
            id: true,
            tenantId: true,
            storagePath: true,
            contentHash: true,
            quarantinePath: true,
            quarantinedAt: true,
            sourceDeletedAt: true,
        },
    });
    if (!attachment) throw new AppError('Infected attachment not found', 404);
    if (attachment.sourceDeletedAt) return;

    const quarantinePath = attachment.quarantinePath
        ?? `quarantine/${attachment.tenantId}/${attachment.id}/${attachment.contentHash}`;
    if (!attachment.quarantinePath) {
        await s3Service.copyToQuarantine(attachment.storagePath, quarantinePath);

        const copied = await prisma.requestAttachment.updateMany({
            where: { id: attachment.id, scanStatus: 'INFECTED', quarantinePath: null },
            data: {
                quarantinePath,
                quarantinedAt: new Date(),
            },
        });
        if (copied.count !== 1) throw new AppError('Attachment quarantine state changed', 409);
    }

    await s3Service.deleteObject(attachment.storagePath);
    const sourceDeletedAt = new Date();
    const completed = await prisma.requestAttachment.updateMany({
        where: {
            id: attachment.id,
            scanStatus: 'INFECTED',
            quarantinePath,
            sourceDeletedAt: null,
        },
        data: { sourceDeletedAt, scanResult: 'INFECTED' },
    });
    if (completed.count !== 1) throw new AppError('Attachment quarantine completion changed', 409);
}

export async function markQuarantineFailure(attachmentId: string, scanJobId: string): Promise<boolean> {
    const updated = await prisma.requestAttachment.updateMany({
        where: {
            id: attachmentId,
            scanJobId,
            scanStatus: 'INFECTED',
            sourceDeletedAt: null,
        },
        data: { scanResult: 'QUARANTINE_FAILED' },
    });
    return updated.count === 1;
}
