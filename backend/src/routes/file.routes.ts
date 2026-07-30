import { Router } from 'express';
import { fileController } from '../controllers/file.controller';
import { authenticate, requireServiceApiKey } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { uploadSingleFile } from '../middleware/upload.middleware';

const router = Router();

/**
 * @route   POST /api/v1/files/upload
 * @desc    Upload a file to S3 (for file-type custom fields in request creation)
 * @access  Private — authenticated users
 */
router.post('/upload', authenticate, uploadSingleFile('file'), asyncHandler(fileController.uploadFile));

router.get('/attachments/:attachmentId/download', authenticate, asyncHandler(fileController.downloadFile));
router.patch('/attachments/:attachmentId/scan-result', requireServiceApiKey, asyncHandler(fileController.markScanResult));

export default router;
