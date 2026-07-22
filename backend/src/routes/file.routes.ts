import { Router } from 'express';
import { fileController } from '../controllers/file.controller';
import { authenticate, requireServiceApiKey } from '../middleware/auth.middleware';

const router = Router();

router.get('/attachments/:attachmentId/download', authenticate, fileController.downloadFile);
router.patch('/attachments/:attachmentId/scan-result', requireServiceApiKey, fileController.markScanResult);

export default router;
