import { Request, Response } from 'express';
import { s3Service } from '../services/s3.service';
import { logger } from '../utils/logger';

export const fileController = {
    async downloadFile(req: Request, res: Response) {
        try {
            const key = (req.params as any)[0] || req.params.key;
            if (!key) {
                return res.status(400).json({ status: 'error', message: 'File key is required' });
            }
            const url = await s3Service.getPresignedUrl(key, 0.25);
            return res.redirect(url);
        } catch (error) {
            logger.error(`Error generating download URL for key ${req.params.key}: ${error}`);
            return res.status(500).json({ status: 'error', message: 'Could not generate download link' });
        }
    },

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
