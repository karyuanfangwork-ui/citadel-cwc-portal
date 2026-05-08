import { Router } from 'express';
import { fileController } from '../controllers/file.controller';
import { authenticate } from '../middleware/auth.middleware';
import { uploadSingleFile } from '../middleware/upload.middleware';

const router = Router();

// All file access requires authentication
router.use(authenticate);

router.get('/download/*', fileController.downloadFile);
router.post('/upload', uploadSingleFile('file'), fileController.uploadFile);

export default router;
