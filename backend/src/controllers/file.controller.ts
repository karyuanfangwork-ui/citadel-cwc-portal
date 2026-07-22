import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { getAuthorizedDownloadUrl, markScanResult } from '../services/attachmentAccess.service';
import { principalFromAuth } from '../security/resource-scope.service';

const scanResultSchema = z.object({
    scanJobId: z.string().uuid(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    nonce: z.string().min(32).max(256),
    timestamp: z.string().datetime(),
    result: z.enum(['CLEAN', 'INFECTED', 'SCAN_FAILED']),
}).strict();

export const fileController = {
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