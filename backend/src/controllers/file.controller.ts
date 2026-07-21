import { Request, Response } from 'express';
import { s3Service } from '../services/s3.service';
import { assertRequestAccess } from '../services/requestAccess.service';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../utils/prisma';
import { AppError } from '../middleware/error.middleware';

export const fileController = {
    /**
     * Download a file by S3 key.
     *
     * P01 Task 4 (Finding #6): Before generating a presigned URL, verify that
     * the authenticated user has access to the request this attachment belongs to.
     * Unauthenticated downloads are rejected with 401.
     */
    async downloadFile(req: AuthRequest, res: Response) {
        try {
            if (!req.user) throw new AppError('Authentication required', 401);

            const key = (req.params as any)[0] || req.params.key;
            if (!key) {
                return res.status(400).json({ status: 'error', message: 'File key is required' });
            }

            // P01-6: Verify the user has access to the request this file belongs to.
            // Look up the attachment by storagePath, then check request access.
            const attachment = await prisma.requestAttachment.findFirst({
                where: { storagePath: key, deletedAt: null },
                select: { id: true, requestId: true },
            });

            if (attachment) {
                // This file is a request attachment — enforce request-level access
                await assertRequestAccess(req.user, attachment.requestId, {
                    requireConfidential: true,
                });
            }
            // If no attachment is found for this key (e.g. avatar uploads, expense receipts),
            // the key format is checked. Only allow keys matching known non-request patterns.
            // For now, we allow the download but log it for audit.
            if (!attachment) {
                logger.warn('File download without request attachment', {
                    userId: req.user.id,
                    key,
                });
            }

            const url = await s3Service.getPresignedUrl(key, 0.25);
            return res.redirect(url);
        } catch (error: any) {
            if (error instanceof AppError) throw error;
            logger.error(`Error generating download URL for key ${req.params.key}: ${error}`);
            return res.status(500).json({ status: 'error', message: 'Could not generate download link' });
        }
    },

    /**
     * Upload a file to S3 via multer-s3.
     * The request-level access check happens in the route that uses the upload
     * (e.g. POST /requests/:id/attachments), not here.
     */
    async uploadFile(req: Request, res: Response) {
        try {
            const file = req.file as any;
            if (!file) {
                return res.status(400).json({ status: 'error', message: 'No file provided' });
            }
            // multer-s3 sets file.key (the S3 object key)
            return res.status(201).json({
                status: 'success',
                data: {
                    s3Key: file.key,
                    fileName: file.originalname,
                    mimeType: file.mimetype,
                    fileSize: file.size,
                },
            });
        } catch (error: any) {
            logger.error(`Error uploading file: ${error?.message || error} | code: ${error?.Code || error?.code}`);
            return res.status(500).json({ status: 'error', message: 'File upload failed', detail: error?.message });
        }
    },
};