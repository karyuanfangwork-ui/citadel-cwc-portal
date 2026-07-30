import { Response } from 'express';
import { z } from 'zod';
import * as path from 'path';
import * as crypto from 'crypto';
import { AuthRequest } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { getAuthorizedCustomFieldUploadUrl, getAuthorizedDownloadUrl, markScanResult } from '../services/attachmentAccess.service';
import { principalFromAuth } from '../security/resource-scope.service';
import { s3Service } from '../services/s3.service';
import { assertAllowedUploadSignature } from '../utils/file-signature';
import { logger } from '../utils/logger';

const scanResultSchema = z.object({
    scanJobId: z.string().uuid(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    nonce: z.string().min(32).max(256),
    timestamp: z.string().datetime(),
    result: z.enum(['CLEAN', 'INFECTED', 'SCAN_FAILED']),
}).strict();

export const fileController = {
    /**
     * Upload a file to S3 and return the key + metadata.
     * Used by the create-request wizard for pre-request file uploads
     * (file-type custom fields). Files are stored in S3 immediately;
     * the s3Key is later embedded in customFields when the request is created.
     */
    async uploadFile(req: AuthRequest, res: Response) {
        try {
            if (!req.user) throw new AppError('Authentication required', 401);

            const file = req.file;
            if (!file) {
                throw new AppError('No file uploaded', 400);
            }

            // Validate file signature matches declared MIME type
            if (!assertAllowedUploadSignature(file.buffer, file.originalname, file.mimetype)) {
                throw new AppError(
                    `Uploaded file content does not match the declared type for ${file.originalname}`,
                    400,
                );
            }

            // Generate S3 key
            const ext = path.extname(file.originalname).toLowerCase();
            const key = `cwc/${crypto.randomUUID()}${ext}`;

            // Upload to S3
            await s3Service.uploadBuffer(key, file.buffer, file.mimetype);

            logger.info(
                `[UPLOAD] File uploaded via /files/upload: ${key} | ${file.originalname} | ${file.mimetype} | ${(file.size / 1024).toFixed(1)}KB | by ${req.user.email}`,
            );

            res.status(201).json({
                status: 'success',
                data: {
                    s3Key: key,
                    fileName: file.originalname,
                    mimeType: file.mimetype,
                    fileSize: file.size,
                },
            });
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError('File upload failed', 500);
        }
    },

    /**
     * Download by opaque attachment ID. Raw storage keys are never accepted.
     */
    async downloadFile(req: AuthRequest, res: Response) {
        try {
            if (!req.user) throw new AppError('Authentication required', 401);

            const attachmentId = String(req.params.attachmentId || '');
            if (!attachmentId) throw new AppError('Attachment not found', 404);
            const url = await getAuthorizedDownloadUrl(principalFromAuth(req.user), attachmentId);
            return res.redirect(url);
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError('Could not generate download link', 500);
        }
    },

    /**
     * Download a pre-request custom-field upload by S3 key.
     * These uploads are stored directly in request.customFields, so access is
     * authorized against the parent request and the key must be present in that
     * request's custom field payload.
     */
    async downloadUploadedFile(req: AuthRequest, res: Response) {
        try {
            if (!req.user) throw new AppError('Authentication required', 401);

            const storageKey = decodeURIComponent(String(req.params[0] || ''));
            const requestId = String(req.query.requestId || '');
            if (!storageKey || !requestId) throw new AppError('Attachment not found', 404);

            const url = await getAuthorizedCustomFieldUploadUrl(
                principalFromAuth(req.user),
                requestId,
                storageKey,
                req.query.inline === 'true',
            );
            return res.redirect(url);
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError('Could not generate download link', 500);
        }
    },

    async markScanResult(req: AuthRequest, res: Response) {
        const parsed = scanResultSchema.parse(req.body);
        const result = await markScanResult({
            attachmentId: String(req.params.attachmentId),
            ...parsed,
            timestamp: new Date(parsed.timestamp),
        });
        return res.json({ status: 'success', data: result });
    },
};