import { Router } from 'express';
import { fileController } from '../controllers/file.controller';
import { authenticate, requireServiceApiKey } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

router.get('/attachments/:attachmentId/download', authenticate, asyncHandler(fileController.downloadFile));
router.patch('/attachments/:attachmentId/scan-result', requireServiceApiKey, asyncHandler(fileController.markScanResult));

export default router;
